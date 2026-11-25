import { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { DOCUMENTS } from "../../constants/documents";

import "./DocumentRequests.css";

/* =====================================================
   TYPES
===================================================== */

type RequestDoc = {
  id: string;
  request_id?: string;
  student_id?: string;
  request_method?: string;
  purpose?: string;
  number_of_copies?: number;
  total_amount?: number;
  requested_date?: string;
  requested_time?: string;
  created_at?: unknown;
  submitted_at?: unknown;
  approved_at?: unknown;
  approved_by_name?: string;
  payment_status?: string;
  payment_stub_code?: string | null;
  payment_confirmed_at?: unknown;
  processing_started_at?: unknown;
  status?: string;
  claim_code?: string | null;
  claiming_schedule_id?: string | null;
  reschedule_count?: number;
  cancellation_reason?: string;
  decline_reason?: string;
};

type DetailDoc = {
  id: string;
  request_id?: string;
  document_type?: string;
  custom_document_name?: string | null;
  quantity?: number;
  unit_price?: number | null;
  subtotal?: number | null;
};

type Row = {
  request: RequestDoc;
  displayId: string;
  studentName: string;
  studentId: string;
  documents: string[];
  status: string;
  createdMs: number;
  searchText: string;
};

type LogEntry = {
  id: string;
  actor: string;
  action: string;
  description: string;
  ms: number;
};

type MemberEntry = {
  id: string;
  studentId: string;
  name: string;
  invitation: string;
};

type Extras = {
  requestId: string;
  loading: boolean;
  error: string;
  schedule: string;
  logs: LogEntry[];
  members: MemberEntry[];
};

/* =====================================================
   CONSTANTS & HELPERS
===================================================== */

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
  "RESCHEDULED",
];

const IN_PROGRESS = [
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "RESCHEDULED",
];

const DOCUMENT_NAMES = new Map<string, string>(
  DOCUMENTS.map((item) => [item.id, item.name])
);

const normalizeId = (value: unknown) =>
  String(value || "").trim().toUpperCase();

const humanize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusLabel = (status: string) =>
  status === "READY_FOR_PICKUP"
    ? "Ready for Pickup"
    : humanize(status || "Unknown");

const statusClass = (status: string) =>
  `status-${(status || "unknown").toLowerCase().replace(/_/g, "-")}`;

const toMillis = (value: unknown): number =>
  value instanceof Timestamp ? value.toMillis() : 0;

const formatDate = (ms: number) =>
  ms
    ? new Date(ms).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const formatDateTime = (ms: number) =>
  ms
    ? new Date(ms).toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const money = (value?: number | null) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function documentName(detail: DetailDoc): string {
  if (detail.custom_document_name) {
    return detail.custom_document_name;
  }

  const type = String(detail.document_type || "");

  return (
    DOCUMENT_NAMES.get(type.toLowerCase()) ||
    type ||
    "Document"
  );
}

function accountName(data: Record<string, unknown>): string {
  const full = [data.firstName, data.lastName]
    .filter((part) => typeof part === "string" && part)
    .join(" ")
    .trim();

  return full || String(data.name || "").trim();
}

/** Stops spreadsheet apps from running cells that begin with = + - @ */
function csvCell(value: unknown): string {
  let text = String(value ?? "");

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: Row[]) {
  const header = [
    "Request ID",
    "Student ID",
    "Student",
    "Documents",
    "Copies",
    "Total Amount",
    "Payment",
    "Status",
    "Requested Claim Date",
    "Submitted",
  ];

  const lines = rows.map((row) =>
    [
      row.displayId,
      row.studentId,
      row.studentName,
      row.documents.join("; "),
      row.request.number_of_copies ?? "",
      row.request.total_amount ?? "",
      row.request.payment_status || "",
      statusLabel(row.status),
      row.request.requested_date || "",
      row.createdMs
        ? new Date(row.createdMs).toISOString()
        : "",
    ]
      .map(csvCell)
      .join(",")
  );

  const csv = "\ufeff" + [header.map(csvCell).join(","), ...lines].join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = `document-requests-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

/* =====================================================
   COMPONENT
===================================================== */

function DocumentRequests() {
  const [requests, setRequests] = useState<RequestDoc[]>([]);
  const [details, setDetails] = useState<
    Record<string, DetailDoc[]>
  >({});
  const [studentNames, setStudentNames] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState("");
  const [extras, setExtras] = useState<Extras | null>(null);

  /* ---------- live data ---------- */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "document_requests"),
      (snapshot) => {
        setRequests(
          snapshot.docs.map(
            (item) =>
              ({ id: item.id, ...item.data() }) as RequestDoc
          )
        );
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        setError(
          `Could not load document requests: ${snapshotError.message}`
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "document_request_details"),
      (snapshot) => {
        const grouped: Record<string, DetailDoc[]> = {};

        snapshot.docs.forEach((item) => {
          const data = item.data();
          const requestId = String(data.request_id || "");

          if (!requestId) return;

          (grouped[requestId] ||= []).push({
            id: item.id,
            ...data,
          } as DetailDoc);
        });

        setDetails(grouped);
      },
      (snapshotError) => {
        console.error("Could not load request details:", snapshotError);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "accounts"),
      (snapshot) => {
        const names: Record<string, string> = {};

        snapshot.docs.forEach((item) => {
          const data = item.data();
          const studentId = normalizeId(data.student_id);
          const name = accountName(data);

          if (studentId && name) names[studentId] = name;
        });

        setStudentNames(names);
      },
      (snapshotError) => {
        console.error("Could not load accounts:", snapshotError);
      }
    );

    return unsubscribe;
  }, []);

  /* ---------- derived rows ---------- */

  const rows: Row[] = useMemo(() => {
    return requests
      .map((request) => {
        const displayId = request.request_id || request.id;
        const studentId = String(request.student_id || "");
        const studentName =
          studentNames[normalizeId(studentId)] || "Unknown student";

        const documents = (
          details[displayId] || details[request.id] || []
        ).map(documentName);

        const status = String(request.status || "");

        return {
          request,
          displayId,
          studentName,
          studentId,
          documents,
          status,
          createdMs:
            toMillis(request.created_at) ||
            toMillis(request.submitted_at),
          searchText: [
            displayId,
            studentId,
            studentName,
            documents.join(" "),
            statusLabel(status),
            request.claim_code || "",
          ]
            .join(" ")
            .toLowerCase(),
        };
      })
      .sort((a, b) => b.createdMs - a.createdMs);
  }, [requests, details, studentNames]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter(
      (row) =>
        (statusFilter === "ALL" || row.status === statusFilter) &&
        (!term || row.searchText.includes(term))
    );
  }, [rows, search, statusFilter]);

  const stats = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((row) => row.status === "PENDING")
        .length,
      inProgress: rows.filter((row) =>
        IN_PROGRESS.includes(row.status)
      ).length,
      completed: rows.filter((row) => row.status === "COMPLETED")
        .length,
      closed: rows.filter((row) =>
        ["DECLINED", "CANCELLED"].includes(row.status)
      ).length,
    }),
    [rows]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(
    pageStart,
    pageStart + PAGE_SIZE
  );

  const selected = rows.find(
    (row) => row.request.id === selectedId
  );
  const selectedRequestId = selected?.displayId || "";
  const selectedScheduleId =
    selected?.request.claiming_schedule_id || "";

  /* ---------- extra data for the detail view ---------- */

  useEffect(() => {
    if (!selectedRequestId) return;

    let cancelled = false;

    const loadExtras = async () => {
      setExtras({
        requestId: selectedRequestId,
        loading: true,
        error: "",
        schedule: "",
        logs: [],
        members: [],
      });

      try {
        const [logSnap, memberSnap, scheduleSnap] =
          await Promise.all([
            getDocs(
              query(
                collection(db, "activityLogs"),
                where("request_id", "==", selectedRequestId)
              )
            ),
            getDocs(
              query(
                collection(db, "group_request_members"),
                where("request_id", "==", selectedRequestId)
              )
            ),
            selectedScheduleId
              ? getDoc(
                  doc(db, "claimingSchedules", selectedScheduleId)
                )
              : Promise.resolve(null),
          ]);

        if (cancelled) return;

        const logs: LogEntry[] = logSnap.docs
          .map((item) => {
            const data = item.data();

            return {
              id: item.id,
              actor: String(data.actor_name || "System"),
              action: humanize(String(data.action || "Activity")),
              description: String(data.description || ""),
              ms: toMillis(data.timestamp),
            };
          })
          .sort((a, b) => a.ms - b.ms);

        const members: MemberEntry[] = memberSnap.docs.map(
          (item) => {
            const data = item.data();
            const studentId = String(data.student_id || "");

            return {
              id: item.id,
              studentId,
              name:
                studentNames[normalizeId(studentId)] || "Unknown",
              invitation: String(data.invitation_status || ""),
            };
          }
        );

        let schedule = "";

        if (scheduleSnap && scheduleSnap.exists()) {
          const data = scheduleSnap.data();
          schedule = [data.claimDate, data.timeSlot]
            .filter(Boolean)
            .join(" · ");
        }

        setExtras({
          requestId: selectedRequestId,
          loading: false,
          error: "",
          schedule,
          logs,
          members,
        });
      } catch (loadError) {
        if (cancelled) return;

        console.error("Could not load request details:", loadError);

        setExtras({
          requestId: selectedRequestId,
          loading: false,
          error:
            loadError instanceof Error
              ? loadError.message
              : "Could not load more details.",
          schedule: "",
          logs: [],
          members: [],
        });
      }
    };

    loadExtras();

    return () => {
      cancelled = true;
    };
  }, [selectedRequestId, selectedScheduleId, studentNames]);

  useEffect(() => {
    if (!selectedId) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId("");
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  /* =====================================================
     RENDER
  ===================================================== */

  // Ignore extras that belong to a previously opened request.
  const activeExtras =
    extras && extras.requestId === selectedRequestId
      ? extras
      : null;

  const selectedDetails = selected
    ? details[selected.displayId] || details[selected.request.id] || []
    : [];

  return (
    <div className="requests-page">
      <div className="requests-header">
        <div>
          <h1>Document Requests</h1>
          <p>
            Monitor student document requests in real time.
            Approvals, payments and claiming are handled by the
            Registrar and Cashier.
          </p>
        </div>

        <button
          type="button"
          className="requests-refresh-button"
          onClick={() => downloadCsv(filteredRows)}
          disabled={filteredRows.length === 0}
        >
          ⬇ Export CSV
        </button>
      </div>

      {error && (
        <div className="requests-error" role="alert">
          {error}
        </div>
      )}

      <div className="requests-summary">
        <div className="request-stat">
          <span>All Requests</span>
          <strong>{stats.all}</strong>
        </div>

        <div className="request-stat pending">
          <span>Pending</span>
          <strong>{stats.pending}</strong>
        </div>

        <div className="request-stat processing">
          <span>In Progress</span>
          <strong>{stats.inProgress}</strong>
        </div>

        <div className="request-stat completed">
          <span>Completed</span>
          <strong>{stats.completed}</strong>
        </div>

        <div className="request-stat rejected">
          <span>Declined / Cancelled</span>
          <strong>{stats.closed}</strong>
        </div>
      </div>

      <div className="requests-table-card">
        <div className="requests-toolbar">
          <div className="request-search">
            <input
              type="text"
              placeholder="Search by ID, student, document or claim code..."
              value={search}
              aria-label="Search requests"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            value={statusFilter}
            aria-label="Filter by status"
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="requests-table-wrapper">
          <table className="requests-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Student</th>
                <th>Document</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="requests-empty">
                    Loading requests…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="requests-empty">
                    {rows.length === 0
                      ? "No document requests yet."
                      : "No requests match your search or filter."}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.request.id}>
                    <td>
                      <strong>{row.displayId}</strong>
                    </td>

                    <td>
                      {row.studentName}
                      <small className="request-subtext">
                        {row.studentId}
                      </small>
                    </td>

                    <td>
                      {row.documents.length === 0
                        ? "—"
                        : row.documents.length === 1
                        ? row.documents[0]
                        : `${row.documents[0]} +${
                            row.documents.length - 1
                          } more`}
                    </td>

                    <td>{formatDate(row.createdMs)}</td>

                    <td>
                      <span
                        className={`request-status ${statusClass(
                          row.status
                        )}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="request-view-button"
                        onClick={() =>
                          setSelectedId(row.request.id)
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 0 && (
          <div className="requests-pagination">
            <span>
              Showing {pageStart + 1}–
              {Math.min(pageStart + PAGE_SIZE, filteredRows.length)}{" "}
              of {filteredRows.length}
            </span>

            <div>
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                Previous
              </button>

              <span>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="request-modal-backdrop"
          onClick={() => setSelectedId("")}
        >
          <div
            className="request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="request-modal-header">
              <div>
                <h2 id="request-modal-title">
                  {selected.displayId}
                </h2>
                <span
                  className={`request-status ${statusClass(
                    selected.status
                  )}`}
                >
                  {statusLabel(selected.status)}
                </span>
              </div>

              <button
                type="button"
                aria-label="Close"
                className="request-modal-close"
                onClick={() => setSelectedId("")}
              >
                ×
              </button>
            </div>

            <dl className="request-facts">
              <div>
                <dt>Student</dt>
                <dd>
                  {selected.studentName}
                  <small>{selected.studentId}</small>
                </dd>
              </div>

              <div>
                <dt>Request type</dt>
                <dd>
                  {selected.request.request_method === "WITH_OTHERS"
                    ? "Group request"
                    : "Individual"}
                </dd>
              </div>

              <div>
                <dt>Purpose</dt>
                <dd>{selected.request.purpose || "—"}</dd>
              </div>

              <div>
                <dt>Submitted</dt>
                <dd>{formatDateTime(selected.createdMs)}</dd>
              </div>

              <div>
                <dt>Requested claim date</dt>
                <dd>
                  {[
                    selected.request.requested_date,
                    selected.request.requested_time,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>

              <div>
                <dt>Assigned claim slot</dt>
                <dd>
                  {(activeExtras ? activeExtras.loading : true)
                    ? "Loading…"
                    : activeExtras?.schedule || "Not assigned yet"}
                </dd>
              </div>

              <div>
                <dt>Payment</dt>
                <dd>
                  {selected.request.payment_status
                    ? humanize(selected.request.payment_status)
                    : "Not yet billed"}
                  <small>
                    {money(selected.request.total_amount)}
                  </small>
                </dd>
              </div>

              <div>
                <dt>Approved by</dt>
                <dd>
                  {selected.request.approved_by_name || "—"}
                  <small>
                    {formatDateTime(
                      toMillis(selected.request.approved_at)
                    )}
                  </small>
                </dd>
              </div>

              <div>
                <dt>Payment stub</dt>
                <dd>{selected.request.payment_stub_code || "—"}</dd>
              </div>

              <div>
                <dt>Claim code</dt>
                <dd>{selected.request.claim_code || "—"}</dd>
              </div>
            </dl>

            {(selected.request.decline_reason ||
              selected.request.cancellation_reason) && (
              <div className="request-reason">
                <strong>
                  {selected.request.decline_reason
                    ? "Decline reason"
                    : "Cancellation reason"}
                </strong>
                <p>
                  {selected.request.decline_reason ||
                    selected.request.cancellation_reason}
                </p>
              </div>
            )}

            <h3>Requested documents</h3>

            {selectedDetails.length === 0 ? (
              <p className="request-muted">
                No document details found.
              </p>
            ) : (
              <table className="request-mini-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetails.map((detail) => (
                    <tr key={detail.id}>
                      <td>{documentName(detail)}</td>
                      <td>{detail.quantity ?? 1}</td>
                      <td>
                        {detail.subtotal == null
                          ? "To be quoted"
                          : money(detail.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeExtras && activeExtras.members.length > 0 && (
              <>
                <h3>Group members</h3>
                <ul className="request-list">
                  {activeExtras.members.map((member) => (
                    <li key={member.id}>
                      <span>
                        {member.name}
                        <small>{member.studentId}</small>
                      </span>
                      <span className="request-muted">
                        {humanize(member.invitation || "pending")}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3>Activity</h3>

            {(activeExtras ? activeExtras.loading : true) ? (
              <p className="request-muted">Loading activity…</p>
            ) : activeExtras?.error ? (
              <p className="request-muted" role="alert">
                Could not load activity: {activeExtras.error}
              </p>
            ) : activeExtras && activeExtras.logs.length > 0 ? (
              <ul className="request-timeline">
                {activeExtras.logs.map((log) => (
                  <li key={log.id}>
                    <strong>{log.action}</strong>
                    <span>{log.description}</span>
                    <small>
                      {log.actor} · {formatDateTime(log.ms)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="request-muted">
                No activity recorded for this request yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentRequests;
