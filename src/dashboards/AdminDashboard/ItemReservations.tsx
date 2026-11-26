import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  collection,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

import { db } from "../../../firebase";

import "./ItemReservations.css";

/* =====================================================
   TYPES
===================================================== */

type ReservationDoc = Record<string, unknown> & { id: string };

type ItemLine = {
  key: string;
  name: string;
  size: string;
  quantity: number;
  channel: string;
  subtotal: number;
};

type StatusKey =
  | "pending"
  | "unpaid"
  | "approved"
  | "claimed"
  | "cancelled"
  | "other";

type Row = {
  id: string;
  displayId: string;
  studentId: string;
  studentName: string;
  mobile: string;
  program: string;
  status: StatusKey;
  rawStatus: string;
  items: ItemLine[];
  total: number;
  pickupDate: string;
  pickupTime: string;
  createdMs: number;
  claimedMs: number;
  paymentStatus: string;
  paymentCode: string;
  claimStubId: string;
  cancellationReason: string;
  searchText: string;
};

/* =====================================================
   CONSTANTS & HELPERS
===================================================== */

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<StatusKey, string> = {
  pending: "Pending",
  unpaid: "Unpaid",
  approved: "Approved",
  claimed: "Claimed",
  cancelled: "Cancelled",
  other: "Other",
};

// Existing stylesheet class for each status.
const STATUS_CLASSES: Record<StatusKey, string> = {
  pending: "pending",
  unpaid: "unpaid",
  approved: "approved",
  claimed: "completed",
  cancelled: "cancelled",
  other: "other",
};

const FILTER_OPTIONS: StatusKey[] = [
  "pending",
  "unpaid",
  "approved",
  "claimed",
  "cancelled",
];

/**
 * Reservations are stored with mixed spellings
 * ("PENDING", "Pending", "approved", "Cancelled", ...),
 * so compare them case-insensitively.
 */
function normalizeStatus(raw: unknown): StatusKey {
  const value = String(raw || "").trim().toLowerCase();

  if (value === "pending") return "pending";
  if (value === "unpaid") return "unpaid";
  if (value === "approved") return "approved";
  if (value === "claimed") return "claimed";
  if (value === "cancelled" || value === "canceled")
    return "cancelled";

  return value ? "other" : "pending";
}

const normalizeId = (value: unknown) =>
  String(value || "").trim().toUpperCase();

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const humanize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toMillis = (value: unknown): number =>
  value instanceof Timestamp ? value.toMillis() : 0;

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

const formatDate = (ms: number) =>
  ms
    ? new Date(ms).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const money = (value: number) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function accountName(data: Record<string, unknown>): string {
  const full = [data.firstName, data.lastName]
    .filter((part) => typeof part === "string" && part)
    .join(" ")
    .trim();

  return full || text(data.name);
}

/** Stops spreadsheet apps from running cells that begin with = + - @ */
function csvCell(value: unknown): string {
  let cell = String(value ?? "");

  if (/^[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }

  return `"${cell.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: Row[]) {
  const header = [
    "Reservation ID",
    "Student ID",
    "Student",
    "Items",
    "Total Amount",
    "Status",
    "Pickup Date",
    "Pickup Time",
    "Created",
  ];

  const lines = rows.map((row) =>
    [
      row.displayId,
      row.studentId,
      row.studentName,
      row.items
        .map(
          (item) =>
            `${item.name}${item.size ? ` (${item.size})` : ""} x${
              item.quantity
            }`
        )
        .join("; "),
      row.total,
      STATUS_LABELS[row.status],
      row.pickupDate,
      row.pickupTime,
      row.createdMs ? new Date(row.createdMs).toISOString() : "",
    ]
      .map(csvCell)
      .join(",")
  );

  const csv =
    "\ufeff" +
    [header.map(csvCell).join(","), ...lines].join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = `item-reservations-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Items live in two places depending on who created the reservation:
 *  - office entries keep an `items` array on the reservation itself
 *  - student reservations store lines in `itemReservationDetails`
 * Read whichever exists.
 */
function buildItems(
  reservation: ReservationDoc,
  detailLines: Record<string, unknown>[]
): ItemLine[] {
  const embedded = Array.isArray(reservation.items)
    ? (reservation.items as Record<string, unknown>[])
    : [];

  if (embedded.length > 0) {
    return embedded.map((item, index) => ({
      key: `${reservation.id}-e${index}`,
      name: text(item.itemName) || "Item",
      size: text(item.size),
      quantity: num(item.quantity),
      channel: item.purchaseType === "Walk-in" ? "Walk-in" : "Online",
      subtotal:
        num(item.subtotal) || num(item.price) * num(item.quantity),
    }));
  }

  return detailLines.map((item, index) => ({
    key: `${reservation.id}-d${index}`,
    name: text(item.itemName) || "Item",
    size: text(item.size),
    quantity: num(item.quantity),
    channel: "Online",
    subtotal:
      num(item.subtotal) || num(item.unitPrice) * num(item.quantity),
  }));
}

/* =====================================================
   COMPONENT
===================================================== */

function ItemReservations() {
  const [reservations, setReservations] = useState<
    ReservationDoc[]
  >([]);
  const [detailLines, setDetailLines] = useState<
    Record<string, Record<string, unknown>[]>
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

  /* ---------- live data ---------- */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "itemReservations"),
      (snapshot) => {
        setReservations(
          snapshot.docs.map((item) => ({
            ...item.data(),
            id: item.id,
          }))
        );
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        setError(
          `Could not load item reservations: ${snapshotError.message}`
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "itemReservationDetails"),
      (snapshot) => {
        const grouped: Record<string, Record<string, unknown>[]> =
          {};

        snapshot.docs.forEach((item) => {
          const data = item.data();
          const reservationId = text(data.reservationId);

          if (!reservationId) return;

          (grouped[reservationId] ||= []).push(data);
        });

        setDetailLines(grouped);
      },
      (snapshotError) => {
        console.error(
          "Could not load reservation items:",
          snapshotError
        );
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
    return reservations
      .map((reservation) => {
        const displayId =
          text(reservation.reservationId) || reservation.id;
        const studentId = text(reservation.studentId);

        const studentName =
          text(reservation.fullName) ||
          studentNames[normalizeId(studentId)] ||
          "Unknown student";

        const items = buildItems(
          reservation,
          detailLines[displayId] || []
        );

        const total =
          num(reservation.totalAmount) ||
          items.reduce((sum, item) => sum + item.subtotal, 0);

        const status = normalizeStatus(reservation.status);

        const row: Row = {
          id: reservation.id,
          displayId,
          studentId,
          studentName,
          mobile: text(reservation.mobileNumber),
          program: text(reservation.program),
          status,
          rawStatus: text(reservation.status),
          items,
          total,
          pickupDate:
            text(reservation.pickupDate) ||
            text(reservation.requestedDate),
          pickupTime:
            text(reservation.pickupTime) ||
            text(reservation.requestedTime),
          createdMs: toMillis(reservation.createdAt),
          claimedMs: toMillis(reservation.claimedAt),
          paymentStatus: text(reservation.payment_status),
          paymentCode: text(reservation.paymentCode),
          claimStubId: text(reservation.claimStubId),
          cancellationReason: text(reservation.cancellationReason),
          searchText: "",
        };

        row.searchText = [
          displayId,
          studentId,
          studentName,
          items.map((item) => item.name).join(" "),
          STATUS_LABELS[status],
          row.claimStubId,
          row.paymentCode,
        ]
          .join(" ")
          .toLowerCase();

        return row;
      })
      .sort((a, b) => b.createdMs - a.createdMs);
  }, [reservations, detailLines, studentNames]);

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
      total: rows.length,
      pending: rows.filter(
        (row) => row.status === "pending" || row.status === "unpaid"
      ).length,
      approved: rows.filter((row) => row.status === "approved")
        .length,
      claimed: rows.filter((row) => row.status === "claimed")
        .length,
      cancelled: rows.filter((row) => row.status === "cancelled")
        .length,
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

  const selected = rows.find((row) => row.id === selectedId);

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

  return (
    <div className="reservations-page">
      <div className="reservations-header">
        <div>
          <h1>Item Reservations</h1>
          <p>
            Monitor item reservations in real time. Approval,
            payment and claiming are handled by the General
            Office.
          </p>
        </div>

        <button
          type="button"
          className="reservation-refresh-button"
          onClick={() => downloadCsv(filteredRows)}
          disabled={filteredRows.length === 0}
        >
          ⬇ Export CSV
        </button>
      </div>

      {error && (
        <div className="reservations-error" role="alert">
          {error}
        </div>
      )}

      <div className="reservation-summary">
        <div className="reservation-stat">
          <span>Total Reservations</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="reservation-stat pending">
          <span>Pending</span>
          <strong>{stats.pending}</strong>
        </div>

        <div className="reservation-stat active">
          <span>Approved</span>
          <strong>{stats.approved}</strong>
        </div>

        <div className="reservation-stat completed">
          <span>Claimed</span>
          <strong>{stats.claimed}</strong>
        </div>

        <div className="reservation-stat cancelled">
          <span>Cancelled</span>
          <strong>{stats.cancelled}</strong>
        </div>
      </div>

      <div className="reservation-table-card">
        <div className="reservation-toolbar">
          <div className="reservation-search">
            <input
              type="text"
              placeholder="Search by ID, student, item or stub code..."
              value={search}
              aria-label="Search reservations"
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
            {FILTER_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="reservation-table-wrapper">
          <table className="reservation-table">
            <thead>
              <tr>
                <th>Reservation ID</th>
                <th>Student</th>
                <th>Item</th>
                <th>Pickup</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="reservations-empty">
                    Loading reservations…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="reservations-empty">
                    {rows.length === 0
                      ? "No item reservations yet."
                      : "No reservations match your search or filter."}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.displayId}</strong>
                    </td>

                    <td>
                      {row.studentName}
                      <small className="reservation-subtext">
                        {row.studentId || "No student ID"}
                      </small>
                    </td>

                    <td>
                      {row.items.length === 0
                        ? "—"
                        : row.items.length === 1
                        ? `${row.items[0].name}${
                            row.items[0].size
                              ? ` (${row.items[0].size})`
                              : ""
                          }`
                        : `${row.items[0].name} +${
                            row.items.length - 1
                          } more`}
                    </td>

                    <td>
                      {row.pickupDate || "—"}
                      <small className="reservation-subtext">
                        {row.pickupTime}
                      </small>
                    </td>

                    <td>
                      <span
                        className={`reservation-status ${
                          STATUS_CLASSES[row.status]
                        }`}
                      >
                        {row.status === "other"
                          ? humanize(row.rawStatus)
                          : STATUS_LABELS[row.status]}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="reservation-view-button"
                        onClick={() => setSelectedId(row.id)}
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
          <div className="reservations-pagination">
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

            {selected &&
        createPortal(
          <div
            className="reservation-modal-backdrop"
            onClick={() => setSelectedId("")}
          >
            <div
              className="reservation-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reservation-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="reservation-modal-header">
                <div>
                  <h2 id="reservation-modal-title">
                    {selected.displayId}
                  </h2>
                  <span
                    className={`reservation-status ${
                      STATUS_CLASSES[selected.status]
                    }`}
                  >
                    {selected.status === "other"
                      ? humanize(selected.rawStatus)
                      : STATUS_LABELS[selected.status]}
                  </span>
                </div>

                <button
                  type="button"
                  aria-label="Close"
                  className="reservation-modal-close"
                  onClick={() => setSelectedId("")}
                >
                  ×
                </button>
              </div>

              <dl className="reservation-facts">
                <div>
                  <dt>Student</dt>
                  <dd>
                    {selected.studentName}
                    <small>{selected.studentId || "No student ID"}</small>
                  </dd>
                </div>

                <div>
                  <dt>Contact</dt>
                  <dd>
                    {selected.mobile || "—"}
                    <small>{selected.program}</small>
                  </dd>
                </div>

                <div>
                  <dt>Pickup</dt>
                  <dd>
                    {selected.pickupDate || "—"}
                    <small>{selected.pickupTime}</small>
                  </dd>
                </div>

                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(selected.createdMs)}</dd>
                </div>

                <div>
                  <dt>Payment</dt>
                  <dd>
                    {selected.paymentStatus
                      ? humanize(selected.paymentStatus)
                      : "Not recorded"}
                    <small>{money(selected.total)}</small>
                  </dd>
                </div>

                <div>
                  <dt>Claimed on</dt>
                  <dd>
                    {selected.claimedMs
                      ? formatDate(selected.claimedMs)
                      : "—"}
                  </dd>
                </div>

                <div>
                  <dt>Payment code</dt>
                  <dd>{selected.paymentCode || "—"}</dd>
                </div>

                <div>
                  <dt>Claim stub</dt>
                  <dd>{selected.claimStubId || "—"}</dd>
                </div>
              </dl>

              {selected.cancellationReason && (
                <div className="reservation-reason">
                  <strong>Cancellation reason</strong>
                  <p>{selected.cancellationReason}</p>
                </div>
              )}

              <h3>Reserved items</h3>

              {selected.items.length === 0 ? (
                <p className="reservation-muted">
                  No item lines found for this reservation.
                </p>
              ) : (
                <table className="reservation-mini-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Size</th>
                      <th>Qty</th>
                      <th>Type</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.key}>
                        <td>{item.name}</td>
                        <td>{item.size || "—"}</td>
                        <td>{item.quantity}</td>
                        <td>{item.channel}</td>
                        <td>{money(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default ItemReservations;
