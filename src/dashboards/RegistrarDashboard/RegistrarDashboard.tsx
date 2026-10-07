import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

import { auth, db } from "../../../firebase";
import "./RegistrarDashboard.css";

type Account = {
  email?: string;
  name?: string;
  role?: string;
  firebaseUid?: string;
  student_id?: string;
};

interface RegistrarDashboardProps {
  account: Account;
}

type Status =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "DECLINED"
  | "RESCHEDULED";

type FirestoreValue =
  | Date
  | string
  | number
  | {
      toDate?: () => Date;
      toMillis?: () => number;
    }
  | null
  | undefined;

type RequestRecord = {
  id: string;
  request_id: string;
  student_id: string;
  request_method?: string;
  purpose?: string;
  number_of_copies?: number;
  total_amount?: number;
  requested_date?: string;
  requested_time?: string;
  created_at?: FirestoreValue;
  updated_at?: FirestoreValue;
  status: Status;
  claim_code?: string | null;
  decline_reason?: string;
  decline_review_status?: string;
};

type DetailRecord = {
  id: string;
  request_id?: string;
  document_type?: string;
  custom_document_name?: string | null;
  quantity?: number;
  unit_price?: number | null;
  subtotal?: number | null;
};

type ScheduleRecord = {
  id: string;
  scheduleId?: string;
  claimDate?: string;
  timeSlot?: string;
  slotCapacity?: number;
  availableSlot?: number;
  availableSlots?: number;
  createdAt?: FirestoreValue;
  updatedAt?: FirestoreValue;
};

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  requests: "Document Requests",
  claiming: "Claiming & Release",
  schedule: "Claiming Schedule",
  reschedule: "Rescheduling",
  reports: "Reports & Daily Summary",
  history: "Transaction History",
  messages: "Messages",
};

const STATUSES: Status[] = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "DECLINED",
  "RESCHEDULED",
];

const money = (value?: number | null) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toDateValue = (
  value: FirestoreValue,
): Date | null => {
  if (value == null) {
    return null;
  }

  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  if (
    value instanceof Date ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date =
      value instanceof Date
        ? value
        : new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  return null;
};

const dateText = (value: FirestoreValue) => {
  const date = toDateValue(value);

  if (!date) {
    return value == null ? "—" : String(value);
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const today = () =>
  new Date().toLocaleDateString("en-CA");

const documentName = (detail?: DetailRecord) => {
  if (!detail) {
    return "Document";
  }

  if (detail.custom_document_name) {
    return detail.custom_document_name;
  }

  const raw = String(
    detail.document_type || "Document",
  )
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    tor: "Official Transcript of Records",
    diploma: "Diploma – 2nd Copy",
    transfer: "Transfer Credential",
    "transfer credential": "Transfer Credential",
    cav: "CAV",
    "certificate of authentication & verification":
      "CAV",
    authentication: "Authentication – per set",
    "certified true copy": "Certified True Copy",
    report_rating:
      "Report of Rating / Certificate of Grades",
    "report of rating":
      "Report of Rating / Certificate of Grades",
    certification: "Certification",
    others: "Others",
  };

  return (
    aliases[raw] ||
    detail.document_type ||
    "Document"
  );
};

function RegistrarDashboard({
  account,
}: RegistrarDashboardProps) {
  const [activePage, setActivePage] =
    useState("overview");

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [requests, setRequests] =
    useState<RequestRecord[]>([]);

  const [requestDetails, setRequestDetails] =
    useState<Record<string, DetailRecord[]>>({});

  const [schedules, setSchedules] =
    useState<ScheduleRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [busyId, setBusyId] =
    useState("");

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [topSearch, setTopSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [selected, setSelected] =
    useState<RequestRecord | null>(null);

  const [claimCode, setClaimCode] =
    useState("");

  const [claimResult, setClaimResult] =
    useState<RequestRecord | null>(null);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [declineTarget, setDeclineTarget] =
    useState<RequestRecord | null>(null);

  const [declineReason, setDeclineReason] =
    useState("");

  const [rescheduleTarget, setRescheduleTarget] =
    useState<RequestRecord | null>(null);

  const [rescheduleDate, setRescheduleDate] =
    useState("");

  const [rescheduleTime, setRescheduleTime] =
    useState("");

  const [scheduleDate, setScheduleDate] =
    useState("");

  const [scheduleTime, setScheduleTime] =
    useState("");

  const [scheduleCapacity, setScheduleCapacity] =
    useState("10");

  const [editingScheduleId, setEditingScheduleId] =
    useState("");

  const [reportPeriod, setReportPeriod] =
    useState<
      "DAY" | "WEEK" | "MONTH" | "YEAR"
    >("DAY");

  const registrarId =
    account.firebaseUid ||
    account.email ||
    "registrar";

  const registrarName =
    account.name ||
    "Registrar Staff";

  /*
   * DOCUMENT REQUESTS
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "document_requests"),
      (snapshot) => {
        const rows: RequestRecord[] =
          snapshot.docs.map((item) => {
            const data =
              item.data() as Partial<RequestRecord>;

            return {
              ...data,
              id: item.id,
              request_id:
                String(data.request_id || item.id),
              student_id:
                String(data.student_id || ""),
              status:
                (data.status as Status) ||
                "PENDING",
            };
          });

        rows.sort((a, b) => {
          const aTime =
            toDateValue(a.created_at)?.getTime?.() ?? 0;
          const bTime =
            toDateValue(b.created_at)?.getTime?.() ?? 0;
          return bTime - aTime;
        });

        setRequests(rows);
        setLoading(false);
      },
      (err) => {
        setError(
          `Could not load document requests: ${err.message}`,
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  /*
   * DOCUMENT REQUEST DETAILS
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(
        db,
        "document_request_details",
      ),
      (snapshot) => {
        const grouped: Record<
          string,
          DetailRecord[]
        > = {};

        snapshot.docs.forEach((item) => {
          const data =
            item.data() as Partial<DetailRecord>;

          const requestId = String(
            data.request_id || "",
          );

          if (!requestId) {
            return;
          }

          if (!grouped[requestId]) {
            grouped[requestId] = [];
          }

          grouped[requestId].push({
            ...data,
            id: item.id,
          });
        });

        setRequestDetails(grouped);
      },
      (err) => {
        setError(
          `Could not load requested documents: ${err.message}`,
        );
      },
    );

    return unsubscribe;
  }, []);

  /*
   * CLAIMING SCHEDULES
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "claimingSchedules"),
      (snapshot) => {
        const rows: ScheduleRecord[] =
          snapshot.docs.map((item) => {
            const data =
              item.data() as Partial<ScheduleRecord>;

            return {
              ...data,
              id: item.id,
            };
          });

        rows.sort((a, b) =>
          String(a.claimDate || "").localeCompare(
            String(b.claimDate || ""),
          ),
        );

        setSchedules(rows);
      },
      (err) => {
        setError(
          `Could not load claiming schedules: ${err.message}`,
        );
      },
    );

    return unsubscribe;
  }, []);

  const clearFeedback = () => {
    setError("");
    setNotice("");
  };

  const changePage = (page: string) => {
    setActivePage(page);
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSelected(null);
    setClaimResult(null);
    clearFeedback();
  };

  const openSearch = (value: string) => {
    setTopSearch(value);
    setSearch(value);
    setStatusFilter("ALL");
    setActivePage("requests");
    setNotificationsOpen(false);
  };

  /*
   * REQUEST DETAILS
   */
  const getRequestDocuments = useCallback(
    (request: RequestRecord) => {
      return (
        requestDetails[request.request_id] || []
      );
    },
    [requestDetails],
  );

  /*
   * REQUEST SEARCH
   */
  const filteredRequests = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return requests.filter((request) => {
      const documents =
        getRequestDocuments(request)
          .map(documentName)
          .join(" ")
          .toLowerCase();

      const matchesSearch =
        !term ||
        [
          request.request_id,
          request.student_id,
          documents,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );

      const matchesStatus =
        statusFilter === "ALL" ||
        request.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    getRequestDocuments,
    requests,
    search,
    statusFilter,
  ]);

  const count = (status: Status) =>
    requests.filter(
      (request) =>
        request.status === status,
    ).length;

  const completedToday =
    requests.filter((request) => {
      if (
        request.status !== "COMPLETED"
      ) {
        return false;
      }

      const date =
        toDateValue(request.updated_at);

      if (!date) {
        return false;
      }

      return (
        date.toLocaleDateString(
          "en-CA",
        ) === today()
      );
    }).length;

  const notifications =
    requests
      .filter((request) =>
        [
          "PENDING",
          "READY_FOR_PICKUP",
        ].includes(request.status),
      )
      .slice(0, 8);

  /*
   * UPDATE REQUEST STATUS
   */
  const updateStatus = async (
    request: RequestRecord,
    status: Status,
  ) => {
    if (!request.request_id) {
      setError(
        "This request is missing its request ID.",
      );
      return;
    }

    setBusyId(request.id);
    clearFeedback();

    try {
      const updates: Record<
        string,
        unknown
      > = {
        status,
        updated_at:
          serverTimestamp(),
      };

      if (
        status ===
          "READY_FOR_PICKUP" &&
        !request.claim_code
      ) {
        const generatedCode =
          Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

        updates.claim_code =
          generatedCode;
      }

      await updateDoc(
        doc(
          db,
          "document_requests",
          request.id,
        ),
        updates,
      );

      setNotice(
        `${request.request_id} updated to ${status.replace(
          /_/g,
          " ",
        )}.`,
      );

      if (
        selected?.id === request.id
      ) {
        const nextClaimCode =
          typeof updates.claim_code ===
          "string"
            ? updates.claim_code
            : undefined;

        setSelected({
          ...request,
          status,
          ...(nextClaimCode
            ? {
                claim_code:
                  nextClaimCode,
              }
            : {}),
        });
      }
    } catch (err) {
      setError(
        `Could not update request: ${
          err instanceof Error
            ? err.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  /*
   * DECLINE REQUEST
   *
   * Registrar sends the request to Admin
   * for evaluation instead of immediately
   * rejecting it.
   */
  const submitDecline = async () => {
    if (!declineTarget) {
      return;
    }

    if (!declineReason.trim()) {
      setError(
        "A decline reason is required.",
      );
      return;
    }

    setBusyId(declineTarget.id);
    clearFeedback();

    try {
      await addDoc(
        collection(db, "adminReviews"),
        {
          type: "REQUEST_DECLINE",
          request_id:
            declineTarget.request_id,
          student_id:
            declineTarget.student_id,
          reason:
            declineReason.trim(),
          status: "PENDING",
          submitted_by: registrarId,
          submitted_by_name:
            registrarName,
          created_at:
            serverTimestamp(),
        },
      );

      await updateDoc(
        doc(
          db,
          "document_requests",
          declineTarget.id,
        ),
        {
          decline_reason:
            declineReason.trim(),
          decline_review_status:
            "PENDING_ADMIN_REVIEW",
          updated_at:
            serverTimestamp(),
        },
      );

      setNotice(
        `${declineTarget.request_id} was sent to Admin for decline review.`,
      );

      setDeclineTarget(null);
      setDeclineReason("");
    } catch (err) {
      setError(
        `Could not submit decline review: ${
          err instanceof Error
            ? err.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  /*
   * RESCHEDULE
   */
  const submitReschedule = async () => {
    if (!rescheduleTarget) {
      return;
    }

    if (
      !rescheduleDate ||
      !rescheduleTime.trim()
    ) {
      setError(
        "Enter the new date and time.",
      );
      return;
    }

    setBusyId(rescheduleTarget.id);
    clearFeedback();

    try {
      await updateDoc(
        doc(
          db,
          "document_requests",
          rescheduleTarget.id,
        ),
        {
          requested_date:
            rescheduleDate,
          requested_time:
            rescheduleTime.trim(),
          status: "RESCHEDULED",
          updated_at:
            serverTimestamp(),
        },
      );

      setNotice(
        `${rescheduleTarget.request_id} was rescheduled successfully.`,
      );

      setRescheduleTarget(null);
      setRescheduleDate("");
      setRescheduleTime("");
    } catch (err) {
      setError(
        `Could not reschedule request: ${
          err instanceof Error
            ? err.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  /*
   * CLAIMING SCHEDULE
   */
  const saveSchedule = async () => {
    const capacity =
      Number(scheduleCapacity);

    if (
      !scheduleDate ||
      !scheduleTime.trim()
    ) {
      setError(
        "Enter a claim date and time slot.",
      );
      return;
    }

    if (
      !Number.isInteger(capacity) ||
      capacity < 1
    ) {
      setError(
        "Capacity must be a whole number greater than zero.",
      );
      return;
    }

    clearFeedback();

    try {
      if (editingScheduleId) {
        const existing =
          schedules.find(
            (schedule) =>
              schedule.id ===
              editingScheduleId,
          );

        const oldCapacity =
          existing?.slotCapacity ??
          capacity;

        const oldAvailable =
          existing?.availableSlot ??
          existing?.availableSlots ??
          oldCapacity;

        const used =
          Math.max(
            0,
            oldCapacity -
              oldAvailable,
          );

        const newAvailable =
          Math.max(
            0,
            capacity - used,
          );

        await updateDoc(
          doc(
            db,
            "claimingSchedules",
            editingScheduleId,
          ),
          {
            claimDate:
              scheduleDate,
            timeSlot:
              scheduleTime.trim(),
            slotCapacity:
              capacity,
            availableSlot:
              newAvailable,
            availableSlots:
              newAvailable,
            updatedAt:
              serverTimestamp(),
          },
        );

        setNotice(
          "Claiming schedule updated successfully.",
        );
      } else {
        const scheduleRef =
          doc(
            collection(
              db,
              "claimingSchedules",
            ),
          );

        await setDoc(
          scheduleRef,
          {
            scheduleId:
              scheduleRef.id,
            claimDate:
              scheduleDate,
            timeSlot:
              scheduleTime.trim(),
            slotCapacity:
              capacity,
            availableSlot:
              capacity,
            availableSlots:
              capacity,
            createdAt:
              serverTimestamp(),
            updatedAt:
              serverTimestamp(),
          },
        );

        setNotice(
          "Claiming schedule created successfully.",
        );
      }

      setScheduleDate("");
      setScheduleTime("");
      setScheduleCapacity("10");
      setEditingScheduleId("");
    } catch (err) {
      setError(
        `Could not save claiming schedule: ${
          err instanceof Error
            ? err.message
            : "Unknown error"
        }`,
      );
    }
  };

  const removeSchedule = async (
    schedule: ScheduleRecord,
  ) => {
    if (
      !window.confirm(
        "Delete this claiming schedule?",
      )
    ) {
      return;
    }

    clearFeedback();

    try {
      await deleteDoc(
        doc(
          db,
          "claimingSchedules",
          schedule.id,
        ),
      );

      setNotice(
        "Claiming schedule deleted.",
      );
    } catch (err) {
      setError(
        `Could not delete schedule: ${
          err instanceof Error
            ? err.message
            : "Unknown error"
        }`,
      );
    }
  };

  /*
   * REQUEST TABLE
   */
  const requestTable = (
    rows: RequestRecord[],
  ) => (
    <div className="rd-table-wrap">
      <table className="rd-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Student ID</th>
            <th>Requested Document/s</th>
            <th>Requested Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((request) => {
            const documents =
              getRequestDocuments(
                request,
              );

            return (
              <tr
                key={request.id}
                className={
                  selected?.id ===
                  request.id
                    ? "selected-row"
                    : ""
                }
              >
                <td>
                  {request.request_id ||
                    request.id}
                </td>

                <td>
                  {request.student_id ||
                    "—"}
                </td>

                <td>
                  {documents.length ? (
                    <div className="document-list-cell">
                      {documents.map(
                        (detail) => (
                          <span
                            key={
                              detail.id
                            }
                          >
                            {documentName(
                              detail,
                            )}
                          </span>
                        ),
                      )}
                    </div>
                  ) : (
                    "No document details"
                  )}
                </td>

                <td>
                  {request.requested_date ||
                    "—"}
                </td>

                <td>
                  <span
                    className={`rd-status ${String(
                      request.status,
                    ).toLowerCase()}`}
                  >
                    {request.status.replace(
                      /_/g,
                      " ",
                    )}
                  </span>
                </td>

                <td>
                  <button
                    className="rd-small-button"
                    onClick={() =>
                      setSelected(
                        request,
                      )
                    }
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="rd-empty">
          {loading
            ? "Loading requests..."
            : "No matching document requests found."}
        </p>
      )}
    </div>
  );

  /*
   * REQUEST ACTION BUTTONS
   */
  const requestActions = (
    request: RequestRecord,
  ) => (
    <div className="rd-actions">
      {request.status ===
        "PENDING" && (
        <>
          <button
            disabled={
              busyId === request.id
            }
            onClick={() =>
              updateStatus(
                request,
                "APPROVED",
              )
            }
          >
            Approve
          </button>

          <button
            className="danger"
            disabled={
              busyId === request.id
            }
            onClick={() => {
              setDeclineTarget(
                request,
              );
              setDeclineReason("");
            }}
          >
            Decline
          </button>
        </>
      )}

      {request.status ===
        "APPROVED" && (
        <button
          disabled={
            busyId === request.id
          }
          onClick={() =>
            updateStatus(
              request,
              "PROCESSING",
            )
          }
        >
          Start Processing
        </button>
      )}

      {request.status ===
        "PROCESSING" && (
        <button
          disabled={
            busyId === request.id
          }
          onClick={() =>
            updateStatus(
              request,
              "READY_FOR_PICKUP",
            )
          }
        >
          Mark Ready
        </button>
      )}

      {request.status ===
        "READY_FOR_PICKUP" && (
        <button
          disabled={
            busyId === request.id
          }
          onClick={() =>
            updateStatus(
              request,
              "COMPLETED",
            )
          }
        >
          Mark Completed
        </button>
      )}

      {![
        "COMPLETED",
        "DECLINED",
      ].includes(request.status) && (
        <button
          className="secondary-button"
          onClick={() => {
            setRescheduleTarget(
              request,
            );
            setRescheduleDate(
              request.requested_date ||
                "",
            );
            setRescheduleTime(
              request.requested_time ||
                "",
            );
          }}
        >
          Reschedule
        </button>
      )}
    </div>
  );

  /*
   * REQUEST DETAILS PANEL
   */
  const requestDetailsPanel =
    selected && (
      <aside className="rd-details-panel">
        <div className="rd-details-header">
          <div>
            <span className="rd-panel-kicker">
              REQUEST DETAILS
            </span>

            <h3>
              {selected.request_id}
            </h3>
          </div>

          <button
            className="rd-small-button"
            onClick={() =>
              setSelected(null)
            }
          >
            Close
          </button>
        </div>

        <div className="rd-detail-grid">
          <div>
            <span>Student ID</span>
            <strong>
              {selected.student_id ||
                "—"}
            </strong>
          </div>

          <div>
            <span>Request Method</span>
            <strong>
              {selected.request_method ||
                "—"}
            </strong>
          </div>

          <div>
            <span>Purpose</span>
            <strong>
              {selected.purpose ||
                "—"}
            </strong>
          </div>

          <div>
            <span>Requested Date</span>
            <strong>
              {selected.requested_date ||
                "—"}
            </strong>
          </div>

          <div>
            <span>Requested Time</span>
            <strong>
              {selected.requested_time ||
                "—"}
            </strong>
          </div>

          <div>
            <span>Copies</span>
            <strong>
              {selected.number_of_copies ??
                "—"}
            </strong>
          </div>

          <div>
            <span>Created</span>
            <strong>
              {dateText(
                selected.created_at,
              )}
            </strong>
          </div>

          <div>
            <span>Total</span>
            <strong>
              {money(
                selected.total_amount,
              )}
            </strong>
          </div>
        </div>

        <div className="rd-document-breakdown">
          <h4>
            Requested Document/s
          </h4>

          {getRequestDocuments(
            selected,
          ).length ? (
            getRequestDocuments(
              selected,
            ).map((detail) => (
              <div
                className="rd-document-line"
                key={detail.id}
              >
                <div>
                  <strong>
                    {documentName(
                      detail,
                    )}
                  </strong>

                  <span>
                    Quantity:{" "}
                    {detail.quantity ??
                      "—"}
                  </span>
                </div>

                <strong>
                  {money(
                    detail.subtotal,
                  )}
                </strong>
              </div>
            ))
          ) : (
            <p className="rd-empty">
              No document details found.
            </p>
          )}

          <div className="rd-detail-total">
            <span>Total</span>
            <strong>
              {money(
                selected.total_amount,
              )}
            </strong>
          </div>
        </div>

        <div className="rd-detail-status">
          <span>
            Current Status
          </span>

          <strong>
            {selected.status.replace(
              /_/g,
              " ",
            )}
          </strong>
        </div>

        {selected.claim_code && (
          <div className="rd-review-note">
            <strong>
              Claim Code:
            </strong>{" "}
            {selected.claim_code}
          </div>
        )}

        {selected.decline_review_status && (
          <div className="rd-review-note">
            <strong>
              Decline Review:
            </strong>{" "}
            {
              selected.decline_review_status
            }
          </div>
        )}

        {selected.decline_reason && (
          <div className="rd-review-note">
            <strong>
              Decline Reason:
            </strong>{" "}
            {selected.decline_reason}
          </div>
        )}

        {requestActions(
          selected,
        )}
      </aside>
    );

  /*
   * REPORT PERIOD
   */
  const periodRequests = useMemo(() => {
    const now = new Date();

    return requests.filter(
      (request) => {
        const created =
          toDateValue(request.created_at);

        if (!created) {
          return false;
        }

        if (
          reportPeriod === "DAY"
        ) {
          return (
            created.toLocaleDateString(
              "en-CA",
            ) ===
            now.toLocaleDateString(
              "en-CA",
            )
          );
        }

        if (
          reportPeriod === "WEEK"
        ) {
          const start =
            new Date(now);

          start.setDate(
            now.getDate() - 6,
          );

          return created >= start;
        }

        if (
          reportPeriod === "MONTH"
        ) {
          return (
            created.getMonth() ===
              now.getMonth() &&
            created.getFullYear() ===
              now.getFullYear()
          );
        }

        return (
          created.getFullYear() ===
          now.getFullYear()
        );
      },
    );
  }, [
    requests,
    reportPeriod,
  ]);

  /*
   * EXPORT REPORT
   */
  const exportReport = () => {
    const rows = [
      [
        "Request ID",
        "Student ID",
        "Requested Documents",
        "Requested Date",
        "Status",
        "Amount",
      ],
    ];

    periodRequests.forEach(
      (request) => {
        const documents =
          getRequestDocuments(
            request,
          )
            .map(documentName)
            .join("; ");

        rows.push([
          request.request_id,
          request.student_id,
          documents,
          request.requested_date ||
            "",
          request.status,
          String(
            request.total_amount ||
              0,
          ),
        ]);
      },
    );

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(
                value ?? "",
              ).replace(
                /"/g,
                '""',
              )}"`,
          )
          .join(","),
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement(
        "a",
      );

    link.href = url;
    link.download =
      "campuserve-registrar-report.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(
      link,
    );

    URL.revokeObjectURL(url);
  };

  /*
   * PAGE CONTENT
   */
  const renderPage = () => {
    /*
     * OVERVIEW
     */
    if (
      activePage ===
      "overview"
    ) {
      const cards = [
        {
          label:
            "Pending Requests",
          value: count(
            "PENDING",
          ),
          status:
            "PENDING" as Status,
          description:
            "Awaiting review",
        },
        {
          label:
            "Processing",
          value:
            count("APPROVED") +
            count(
              "PROCESSING",
            ),
          status:
            "PROCESSING" as Status,
          description:
            "Documents being prepared",
        },
        {
          label:
            "Ready for Claiming",
          value: count(
            "READY_FOR_PICKUP",
          ),
          status:
            "READY_FOR_PICKUP" as Status,
          description:
            "Ready for student pickup",
        },
        {
          label:
            "Completed Today",
          value:
            completedToday,
          status:
            "COMPLETED" as Status,
          description:
            "Documents released today",
        },
      ];

      return (
        <section className="registrar-page">
          <div className="welcome-section">
            <h1>
              Registrar Dashboard
            </h1>

            <p className="welcome-text">
              Welcome,{" "}
              {account.name ||
                "Registrar Staff"}
            </p>
          </div>

          <div className="overview-header">
            <h2>Overview</h2>
          </div>

          <div className="stats-grid">
            {cards.map(
              (card) => (
                <button
                  key={
                    card.label
                  }
                  className="stat-card stat-card-button"
                  onClick={() => {
                    setStatusFilter(
                      card.status,
                    );
                    setSearch("");
                    setTopSearch("");
                    setActivePage(
                      "requests",
                    );
                  }}
                >
                  <div className="stat-card-top">
                    <span>
                      {
                        card.label
                      }
                    </span>

                    <span className="stat-label">
                      LIVE
                    </span>
                  </div>

                  <strong>
                    {card.value}
                  </strong>

                  <p>
                    {
                      card.description
                    }
                  </p>
                </button>
              ),
            )}
          </div>

          <div className="services-heading">
            <h2>
              Registrar Services
            </h2>
          </div>

          <div className="services-grid">
            {Object.entries(
              PAGE_TITLES,
            )
              .filter(
                ([key]) =>
                  key !==
                  "overview",
              )
              .map(
                ([key, title]) => (
                  <button
                    key={key}
                    className="service-card"
                    onClick={() =>
                      changePage(
                        key,
                      )
                    }
                  >
                    <span className="service-content">
                      <strong>
                        {title}
                      </strong>
                    </span>

                    <span className="service-arrow">
                      →
                    </span>
                  </button>
                ),
              )}
          </div>
        </section>
      );
    }

    /*
     * DOCUMENT REQUESTS
     */
    if (
      activePage ===
      "requests"
    ) {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage(
                  "overview",
                )
              }
            >
              ← Back
            </button>

            <h2>
              Document Requests
            </h2>
          </div>

          <div className="rd-toolbar">
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Search Request ID, Student ID, or Document name"
            />

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value,
                )
              }
            >
              <option value="ALL">
                All statuses
              </option>

              {STATUSES.map(
                (status) => (
                  <option
                    key={status}
                    value={
                      status
                    }
                  >
                    {status.replace(
                      /_/g,
                      " ",
                    )}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="rd-request-workspace">
            {requestTable(
              filteredRequests,
            )}

            {requestDetailsPanel}
          </div>
        </section>
      );
    }

    /*
     * CLAIMING
     */
    if (
      activePage ===
      "claiming"
    ) {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage(
                  "overview",
                )
              }
            >
              ← Back
            </button>

            <h2>
              Claiming & Release
            </h2>
          </div>

          <div className="rd-panel">
            <h3>
              Verify Claim Code
            </h3>

            <div className="rd-toolbar">
              <input
                value={claimCode}
                onChange={(event) => {
                  setClaimCode(
                    event.target.value
                      .toUpperCase(),
                  );
                  setClaimResult(
                    null,
                  );
                }}
                placeholder="Enter claim code"
              />

              <button
                className="primary-button"
                onClick={() => {
                  const found =
                    requests.find(
                      (request) =>
                        request.claim_code?.toUpperCase() ===
                        claimCode
                          .trim()
                          .toUpperCase(),
                    );

                  setClaimResult(
                    found ||
                      null,
                  );

                  setError(
                    found
                      ? ""
                      : "No request found for that claim code.",
                  );
                }}
              >
                Verify Code
              </button>
            </div>

            {claimResult && (
              <div className="rd-detail">
                <h3>
                  {
                    claimResult.request_id
                  }
                </h3>

                <p>
                  Student ID:{" "}
                  {
                    claimResult.student_id
                  }
                </p>

                <p>
                  Status:{" "}
                  {claimResult.status.replace(
                    /_/g,
                    " ",
                  )}
                </p>

                <p>
                  Total:{" "}
                  {money(
                    claimResult.total_amount,
                  )}
                </p>

                {claimResult.status ===
                "READY_FOR_PICKUP" ? (
                  <button
                    className="primary-button"
                    disabled={
                      busyId ===
                      claimResult.id
                    }
                    onClick={() =>
                      updateStatus(
                        claimResult,
                        "COMPLETED",
                      )
                    }
                  >
                    Confirm Release
                  </button>
                ) : (
                  <p>
                    This request is
                    not currently
                    ready for pickup.
                  </p>
                )}
              </div>
            )}
          </div>

          <h3>
            Ready for Pickup
          </h3>

          {requestTable(
            requests.filter(
              (request) =>
                request.status ===
                "READY_FOR_PICKUP",
            ),
          )}
        </section>
      );
    }

    /*
     * CLAIMING SCHEDULE
     */
    if (
      activePage ===
      "schedule"
    ) {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage(
                  "overview",
                )
              }
            >
              ← Back
            </button>

            <h2>
              Claiming Schedule
            </h2>
          </div>

          <div className="rd-panel">
            <h3>
              {editingScheduleId
                ? "Edit Claiming Schedule"
                : "Create Claiming Schedule"}
            </h3>

            <div className="rd-toolbar">
              <input
                type="date"
                value={
                  scheduleDate
                }
                min={today()}
                onChange={(event) =>
                  setScheduleDate(
                    event.target
                      .value,
                  )
                }
              />

              <input
                type="text"
                value={
                  scheduleTime
                }
                onChange={(event) =>
                  setScheduleTime(
                    event.target
                      .value,
                  )
                }
                placeholder="e.g. 9:00 AM - 10:00 AM"
              />

              <input
                type="number"
                min="1"
                value={
                  scheduleCapacity
                }
                onChange={(event) =>
                  setScheduleCapacity(
                    event.target
                      .value,
                  )
                }
                placeholder="Capacity"
              />

              <button
                className="primary-button"
                onClick={
                  saveSchedule
                }
              >
                {editingScheduleId
                  ? "Save Changes"
                  : "Create Schedule"}
              </button>

              {editingScheduleId && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setEditingScheduleId(
                      "",
                    );
                    setScheduleDate(
                      "",
                    );
                    setScheduleTime(
                      "",
                    );
                    setScheduleCapacity(
                      "10",
                    );
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          <div className="rd-table-wrap">
            <table className="rd-table">
              <thead>
                <tr>
                  <th>
                    Claim Date
                  </th>
                  <th>
                    Time Slot
                  </th>
                  <th>
                    Capacity
                  </th>
                  <th>
                    Available
                  </th>
                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {schedules.map(
                  (schedule) => (
                    <tr
                      key={
                        schedule.id
                      }
                    >
                      <td>
                        {
                          schedule.claimDate
                        }
                      </td>

                      <td>
                        {
                          schedule.timeSlot
                        }
                      </td>

                      <td>
                        {
                          schedule.slotCapacity ??
                          "—"
                        }
                      </td>

                      <td>
                        {
                          schedule.availableSlot ??
                          schedule.availableSlots ??
                          "—"
                        }
                      </td>

                      <td>
                        <div className="rd-actions">
                          <button
                            onClick={() => {
                              setEditingScheduleId(
                                schedule.id,
                              );
                              setScheduleDate(
                                schedule.claimDate ||
                                  "",
                              );
                              setScheduleTime(
                                schedule.timeSlot ||
                                  "",
                              );
                              setScheduleCapacity(
                                String(
                                  schedule.slotCapacity ??
                                    10,
                                ),
                              );
                            }}
                          >
                            Edit
                          </button>

                          <button
                            className="danger"
                            onClick={() =>
                              removeSchedule(
                                schedule,
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>

            {!schedules.length && (
              <p className="rd-empty">
                No claiming schedules
                found.
              </p>
            )}
          </div>
        </section>
      );
    }

    /*
     * RESCHEDULING
     */
    if (
      activePage ===
      "reschedule"
    ) {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage(
                  "overview",
                )
              }
            >
              ← Back
            </button>

            <h2>
              Rescheduling
            </h2>
          </div>

          {requestTable(
            requests.filter(
              (request) =>
                request.status !==
                  "COMPLETED" &&
                request.status !==
                  "DECLINED",
            ),
          )}
        </section>
      );
    }

    /*
     * REPORTS
     */
    if (
      activePage ===
      "reports"
    ) {
      const periodStatuses =
        STATUSES.map(
          (status) => ({
            status,
            count:
              periodRequests.filter(
                (request) =>
                  request.status ===
                  status,
              ).length,
          }),
        );

      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage(
                  "overview",
                )
              }
            >
              ← Back
            </button>

            <h2>
              Reports & Daily Summary
            </h2>
          </div>

          <div className="report-periods">
            {(
              [
                "DAY",
                "WEEK",
                "MONTH",
                "YEAR",
              ] as const
            ).map(
              (period) => (
                <button
                  key={period}
                  className={
                    reportPeriod ===
                    period
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setReportPeriod(
                      period,
                    )
                  }
                >
                  {period ===
                  "DAY"
                    ? "Day"
                    : period ===
                      "WEEK"
                    ? "Week"
                    : period ===
                      "MONTH"
                    ? "Month"
                    : "Year"}
                </button>
              ),
            )}
          </div>

          <div className="report-summary-grid">
            <div>
              <span>
                Requests
              </span>
              <strong>
                {
                  periodRequests.length
                }
              </strong>
            </div>

            <div>
              <span>
                Pending
              </span>
              <strong>
                {
                  periodRequests.filter(
                    (request) =>
                      request.status ===
                      "PENDING",
                  ).length
                }
              </strong>
            </div>

            <div>
              <span>
                Ready
              </span>
              <strong>
                {
                  periodRequests.filter(
                    (request) =>
                      request.status ===
                      "READY_FOR_PICKUP",
                  ).length
                }
              </strong>
            </div>

            <div>
              <span>
                Completed
              </span>
              <strong>
                {
                  periodRequests.filter(
                    (request) =>
                      request.status ===
                      "COMPLETED",
                  ).length
                }
              </strong>
            </div>

            <div>
              <span>
                Total Amount
              </span>
              <strong>
                {money(
                  periodRequests.reduce(
                    (
                      total,
                      request,
                    ) =>
                      total +
                      Number(
                        request.total_amount ||
                          0,
                      ),
                    0,
                  ),
                )}
              </strong>
            </div>
          </div>

          <div className="report-layout">
            <div className="rd-panel">
              <h3>
                Status Summary
              </h3>

              {periodStatuses.map(
                ({
                  status,
                  count: statusCount,
                }) => {
                  const percentage =
                    periodRequests.length
                      ? Math.round(
                          (statusCount /
                            periodRequests.length) *
                            100,
                        )
                      : 0;

                  return (
                    <div
                      className="report-bar-row"
                      key={status}
                    >
                      <span>
                        {status.replace(
                          /_/g,
                          " ",
                        )}
                      </span>

                      <div className="report-bar">
                        <i
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <strong>
                        {
                          statusCount
                        }
                      </strong>
                    </div>
                  );
                },
              )}
            </div>

            <div className="rd-panel">
              <h3>
                Daily Summary
              </h3>

              <p>
                Completed today:{" "}
                <strong>
                  {
                    completedToday
                  }
                </strong>
              </p>

              <p>
                Requests in selected
                period:{" "}
                <strong>
                  {
                    periodRequests.length
                  }
                </strong>
              </p>

              <p>
                Total recorded
                requests:{" "}
                <strong>
                  {
                    requests.length
                  }
                </strong>
              </p>

              <button
                className="primary-button"
                onClick={
                  exportReport
                }
              >
                Export CSV
              </button>
            </div>
          </div>
        </section>
      );
    }

    /*
     * HISTORY
     */
    if (
      activePage ===
      "history"
    ) {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage(
                  "overview",
                )
              }
            >
              ← Back
            </button>

            <h2>
              Transaction History
            </h2>
          </div>

          {requestTable(
            requests.filter(
              (request) =>
                [
                  "COMPLETED",
                  "DECLINED",
                  "RESCHEDULED",
                ].includes(
                  request.status,
                ),
            ),
          )}
        </section>
      );
    }

    /*
     * MESSAGES
     *
     * This is intentionally left as an
     * integration point because your groupmate
     * is handling Messages.
     */
    return (
      <section className="registrar-page">
        <div className="page-heading-row">
          <button
            className="back-button"
            onClick={() =>
              changePage(
                "overview",
              )
            }
          >
            ← Back
          </button>

          <h2>
            Messages
          </h2>
        </div>

        <div className="empty-state">
          <h3>
            Messaging Integration
          </h3>

          <p>
            The messaging feature is
            being handled by another
            CampuServe member and will
            be connected here during
            integration.
          </p>
        </div>
      </section>
    );
  };

  return (
    <div className="registrar-layout">
      {menuOpen && (
        <div
          className="menu-overlay"
          onClick={() =>
            setMenuOpen(false)
          }
        />
      )}

      <aside
        className={`registrar-menu ${
          menuOpen ? "open" : ""
        }`}
      >
        <div className="menu-header">
          <div className="menu-brand">
            <div className="brand-mark">
              C
            </div>

            <div>
              <strong>
                CampuServe
              </strong>

              <span>
                Registrar Staff
              </span>
            </div>
          </div>

          <button
            className="close-menu"
            onClick={() =>
              setMenuOpen(false)
            }
          >
            ×
          </button>
        </div>

        <nav className="registrar-nav">
          {Object.entries(
            PAGE_TITLES,
          ).map(
            ([key, title]) => (
              <button
                key={key}
                className={`nav-item ${
                  activePage === key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  changePage(
                    key,
                  )
                }
              >
                {title}
              </button>
            ),
          )}
        </nav>

        <div className="menu-bottom">
          <div className="staff-profile">
            <div className="staff-avatar">
              {(
                account.name ||
                "R"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {account.name ||
                  "Registrar Staff"}
              </strong>

              <span>
                {account.email ||
                  "Registrar Account"}
              </span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={async () => {
              try {
                await signOut(
                  auth,
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Unable to log out.",
                );
              }
            }}
          >
            Log Out
          </button>
        </div>
      </aside>

      <main className="registrar-main">
        <header className="registrar-topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              onClick={() =>
                setMenuOpen(true)
              }
              aria-label="Open menu"
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <span className="topbar-label">
                REGISTRAR PORTAL
              </span>

              <h3>
                {
                  PAGE_TITLES[
                    activePage
                  ]
                }
              </h3>
            </div>
          </div>

          <div className="registrar-topbar-actions">
            <div className="registrar-top-search">
              <span>
                ⌕
              </span>

              <input
                type="search"
                value={
                  topSearch
                }
                onChange={(event) =>
                  openSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Search requests..."
              />
            </div>

            <div className="registrar-notification-wrap">
              <button
                className="registrar-icon-button"
                onClick={() =>
                  setNotificationsOpen(
                    (open) =>
                      !open,
                  )
                }
                aria-label="Notifications"
              >
                🔔

                {notifications.length >
                  0 && (
                  <span className="registrar-notification-count">
                    {
                      notifications.length
                    }
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="registrar-notifications-panel">
                  <div className="registrar-notifications-heading">
                    <strong>
                      Notifications
                    </strong>

                    <button
                      onClick={() =>
                        setNotificationsOpen(
                          false,
                        )
                      }
                    >
                      ×
                    </button>
                  </div>

                  {notifications.length ===
                  0 ? (
                    <p className="registrar-notifications-empty">
                      No new request
                      updates.
                    </p>
                  ) : (
                    notifications.map(
                      (request) => (
                        <button
                          key={
                            request.id
                          }
                          className="registrar-notification-item"
                          onClick={() => {
                            setSelected(
                              request,
                            );
                            setActivePage(
                              "requests",
                            );
                            setNotificationsOpen(
                              false,
                            );
                          }}
                        >
                          <strong>
                            {
                              request.request_id
                            }
                          </strong>

                          <small>
                            Student:{" "}
                            {
                              request.student_id
                            }
                          </small>

                          <small>
                            {
                              request.status.replace(
                                /_/g,
                                " ",
                              )
                            }
                          </small>
                        </button>
                      ),
                    )
                  )}

                  <button
                    className="registrar-view-requests"
                    onClick={() =>
                      changePage(
                        "requests",
                      )
                    }
                  >
                    View all requests
                  </button>
                </div>
              )}
            </div>

            <button
              className="registrar-icon-button"
              onClick={() =>
                changePage(
                  "messages",
                )
              }
              aria-label="Messages"
            >
              ✉
            </button>
          </div>
        </header>

        {error && (
          <div className="rd-alert error">
            {error}
          </div>
        )}

        {notice && (
          <div className="rd-alert success">
            {notice}
          </div>
        )}

        {renderPage()}
      </main>

      /*
       * DECLINE MODAL
       */
      {declineTarget && (
        <div className="rd-modal-backdrop">
          <section
            className="rd-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="rd-modal-close"
              onClick={() => {
                setDeclineTarget(
                  null,
                );
                setDeclineReason(
                  "",
                );
              }}
            >
              ×
            </button>

            <h2>
              Submit Decline Review
            </h2>

            <p>
              Request:{" "}
              <strong>
                {
                  declineTarget.request_id
                }
              </strong>
            </p>

            <p>
              The request will be
              forwarded to Admin for
              evaluation.
            </p>

            <textarea
              value={
                declineReason
              }
              onChange={(event) =>
                setDeclineReason(
                  event.target.value,
                )
              }
              placeholder="Enter the reason for recommending decline..."
              rows={5}
            />

            <button
              className="primary-button"
              disabled={
                busyId ===
                declineTarget.id
              }
              onClick={
                submitDecline
              }
            >
              Submit for Admin Review
            </button>
          </section>
        </div>
      )}

      /*
       * RESCHEDULE MODAL
       */
      {rescheduleTarget && (
        <div className="rd-modal-backdrop">
          <section
            className="rd-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="rd-modal-close"
              onClick={() =>
                setRescheduleTarget(
                  null,
                )
              }
            >
              ×
            </button>

            <h2>
              Reschedule Request
            </h2>

            <p>
              Request:{" "}
              <strong>
                {
                  rescheduleTarget.request_id
                }
              </strong>
            </p>

            <label>
              New Date
            </label>

            <input
              type="date"
              value={
                rescheduleDate
              }
              onChange={(event) =>
                setRescheduleDate(
                  event.target
                    .value,
                )
              }
            />

            <label>
              New Time
            </label>

            <input
              type="text"
              value={
                rescheduleTime
              }
              onChange={(event) =>
                setRescheduleTime(
                  event.target
                    .value,
                )
              }
              placeholder="e.g. 9:00 AM"
            />

            <button
              className="primary-button"
              disabled={
                busyId ===
                rescheduleTarget.id
              }
              onClick={
                submitReschedule
              }
            >
              Save Reschedule
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default RegistrarDashboard;