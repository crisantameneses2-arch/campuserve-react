import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  query,
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
  created_at?: any;
  status: Status;
  claim_code?: string | null;
  updated_at?: any;
  decline_reason?: string;
  decline_review_status?: string;
};

type DetailRecord = {
  id: string;
  document_type?: string;
  custom_document_name?: string | null;
  quantity?: number;
  unit_price?: number | null;
  subtotal?: number | null;
};

type ScheduleRecord = {
  id: string;
  claimDate?: string;
  timeSlot?: string;
  slotCapacity?: number;
  availableSlot?: number;
  availableSlots?: number;
};

type MessageRecord = {
  id: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  recipientId?: string;
  recipientName?: string;
  text?: string;
  createdAt?: any;
};

type Recipient = {
  id: string;
  name: string;
  email: string;
  role: string;
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

/*
 * Based on the university claim stub supplied for CampuServe.
 */
const DOCUMENT_CATALOG = [
  {
    name: "Official Transcript of Records",
    price: 230,
  },
  {
    name: "Diploma – 2nd Copy",
    price: 280,
  },
  {
    name: "Transfer Credential",
    price: 80,
  },
  {
    name: "Cert. of Auth. & Verification (CAV)",
    price: 60,
  },
  {
    name: "Authentication – per set",
    price: 30,
  },
  {
    name: "Certified True Copy",
    price: 30,
  },
  {
    name: "Report of Rating / Cert. of Grades",
    price: 60,
  },
  {
    name: "Certification",
    price: 60,
  },
  {
    name: "Others",
    price: null,
  },
];

const money = (value?: number | null) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dateText = (value: any) => {
  if (!value) return "—";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const today = () => new Date().toLocaleDateString("en-CA");

const documentName = (detail?: DetailRecord) => {
  if (!detail) return "Document";

  if (detail.custom_document_name) {
    return detail.custom_document_name;
  }

  const raw = String(detail.document_type || "Document")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    tor: "Official Transcript of Records",
    diploma: "Diploma – 2nd Copy",
    transfer: "Transfer Credential",
    "transfer of credential": "Transfer Credential",
    cav: "Cert. of Auth. & Verification (CAV)",
    "certificate of authentication & verification":
      "Cert. of Auth. & Verification (CAV)",
    authentication: "Authentication – per set",
    certified_true_copy: "Certified True Copy",
    "certified true copy": "Certified True Copy",
    report_rating: "Report of Rating / Cert. of Grades",
    "report of rating/certificate of grades":
      "Report of Rating / Cert. of Grades",
    certification: "Certification",
    others: "Others",
  };

  return aliases[raw] || detail.document_type || "Document";
};

const documentNamesFromDetails = (details: DetailRecord[]) =>
  details.length
    ? details.map((detail) => documentName(detail)).join(", ")
    : "No document details";

export default function RegistrarDashboard({
  account,
}: RegistrarDashboardProps) {
  const [activePage, setActivePage] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [requestDetails, setRequestDetails] = useState<
    Record<string, DetailRecord[]>
  >({});

  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleCapacity, setScheduleCapacity] = useState("10");
  const [editingScheduleId, setEditingScheduleId] = useState("");

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selected, setSelected] =
    useState<RequestRecord | null>(null);

  const [selectedDetails, setSelectedDetails] =
    useState<DetailRecord[]>([]);

  const [claimCode, setClaimCode] = useState("");
  const [claimResult, setClaimResult] =
    useState<RequestRecord | null>(null);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [declineTarget, setDeclineTarget] =
    useState<RequestRecord | null>(null);

  const [declineReason, setDeclineReason] = useState("");

  const [rescheduleTarget, setRescheduleTarget] =
    useState<RequestRecord | null>(null);

  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const [reportPeriod, setReportPeriod] =
    useState<"DAY" | "WEEK" | "MONTH" | "YEAR">("DAY");

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] =
    useState<Recipient | null>(null);

  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);

  const registrarId =
    account.firebaseUid ||
    account.email ||
    "registrar";

  const registrarName =
    account.name || "Registrar Staff";

  /*
   * DOCUMENT REQUESTS
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "document_requests"),
      (snapshot) => {
        const rows = snapshot.docs.map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
            }) as RequestRecord,
        );

        rows.sort(
          (a, b) =>
            (b.created_at?.toMillis?.() ?? 0) -
            (a.created_at?.toMillis?.() ?? 0),
        );

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
   * CLAIMING SCHEDULES
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "claimingSchedules"),
      (snapshot) => {
        setSchedules(
          snapshot.docs.map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as ScheduleRecord,
          ),
        );
      },
      (err) => {
        setError(
          `Could not load claiming schedules: ${err.message}`,
        );
      },
    );

    return unsubscribe;
  }, []);

  /*
   * DOCUMENT REQUEST DETAILS
   *
   * Loads all document details once and groups them by
   * request_id. This lets the Registrar table display
   * the actual requested document names.
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "document_request_details"),
      (snapshot) => {
        const grouped: Record<
          string,
          DetailRecord[]
        > = {};

        snapshot.docs.forEach((item) => {
          const data = item.data();

          const detail = {
            id: item.id,
            ...data,
          } as DetailRecord;

          const requestId = String(
            data.request_id || "",
          );

          if (!requestId) return;

          if (!grouped[requestId]) {
            grouped[requestId] = [];
          }

          grouped[requestId].push(detail);
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

  useEffect(() => {
    if (!selected) {
      setSelectedDetails([]);
      return;
    }

    setSelectedDetails(
      requestDetails[selected.request_id] || [],
    );
  }, [selected, requestDetails]);

  /*
   * MESSAGING RECIPIENTS
   *
   * The current project snapshot did not contain an existing
   * messaging component, so this Registrar implementation
   * uses the existing accounts collection as the contact list.
   */
  useEffect(() => {
    if (activePage !== "messages") return;

    setMessagesLoading(true);

    const unsubscribe = onSnapshot(
      collection(db, "accounts"),
      (snapshot) => {
        const rows: Recipient[] = snapshot.docs
          .map((item) => ({
            id: item.id,
            name: String(
              item.data().name ||
                item.data().email ||
                "Account",
            ),
            email: String(
              item.data().email || "",
            ),
            role: String(
              item.data().role || "",
            ),
          }))
          .filter(
            (recipient) =>
              recipient.id !== registrarId &&
              recipient.role !== "registrar",
          );

        setRecipients(rows);
      },
      (err) => {
        setError(
          `Could not load message recipients: ${err.message}`,
        );
      },
    );

    setMessagesLoading(false);

    return unsubscribe;
  }, [activePage, registrarId]);

  /*
   * MESSAGES
   */
  useEffect(() => {
    if (!selectedRecipient) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, "messages"),
      where(
        "participants",
        "array-contains",
        registrarId,
      ),
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as MessageRecord & {
                participants?: string[];
              },
          )
          .filter(
            (message) =>
              Array.isArray(
                (message as any).participants,
              ) &&
              (message as any).participants.includes(
                selectedRecipient.id,
              ),
          )
          .sort(
            (a, b) =>
              (a.createdAt?.toMillis?.() ?? 0) -
              (b.createdAt?.toMillis?.() ?? 0),
          );

        setMessages(rows);
      },
      (err) => {
        setError(
          `Could not load messages: ${err.message}`,
        );
      },
    );

    return unsubscribe;
  }, [selectedRecipient, registrarId]);

  const clearFeedback = () => {
    setError("");
    setNotice("");
  };

  const changePage = (page: string) => {
    setActivePage(page);
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

  const getRequestDocuments = (
    request: RequestRecord,
  ) =>
    requestDetails[request.request_id] || [];

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const names = getRequestDocuments(request)
        .map(documentName)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term ||
        [
          request.request_id,
          request.student_id,
          names,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );

      return (
        matchesSearch &&
        (statusFilter === "ALL" ||
          request.status === statusFilter)
      );
    });
  }, [
    requests,
    requestDetails,
    search,
    statusFilter,
  ]);

  const count = (status: Status) =>
    requests.filter(
      (request) => request.status === status,
    ).length;

  const completedToday = requests.filter(
    (request) =>
      request.status === "COMPLETED" &&
      request.updated_at
        ?.toDate?.()
        .toLocaleDateString("en-CA") === today(),
  ).length;

  const notifications = requests
    .filter((request) =>
      ["PENDING", "READY_FOR_PICKUP"].includes(
        request.status,
      ),
    )
    .slice(0, 8);

  /*
   * STATUS UPDATE
   */
  const updateStatus = async (
    request: RequestRecord,
    status: Status,
  ) => {
    setBusyId(request.id);
    clearFeedback();

    try {
      await updateDoc(
        doc(db, "document_requests", request.id),
        {
          status,
          updated_at: serverTimestamp(),
        },
      );

      setNotice(
        `${request.request_id} updated to ${status.replace(
          /_/g,
          " ",
        )}.`,
      );
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
   * DECLINE
   *
   * The Registrar does NOT immediately change the request
   * to DECLINED.
   *
   * Instead, the request is sent to adminReviews so Admin
   * can evaluate the reason first.
   */
  const submitDecline = async () => {
    if (!declineTarget) return;

    if (!declineReason.trim()) {
      setError("A decline reason is required.");
      return;
    }

    setBusyId(declineTarget.id);
    clearFeedback();

    try {
      await addDoc(collection(db, "adminReviews"), {
        type: "REQUEST_DECLINE",
        request_id: declineTarget.request_id,
        student_id: declineTarget.student_id,
        reason: declineReason.trim(),
        status: "PENDING",
        submitted_by: registrarId,
        submitted_by_name: registrarName,
        created_at: serverTimestamp(),
      });

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
          updated_at: serverTimestamp(),
        },
      );

      setNotice(
        `${declineTarget.request_id} was forwarded to Admin for decline review.`,
      );

      setDeclineTarget(null);
      setDeclineReason("");
    } catch (err) {
      setError(
        `Could not forward decline request: ${
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
    if (!rescheduleTarget) return;

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
          requested_date: rescheduleDate,
          requested_time:
            rescheduleTime.trim(),
          status: "RESCHEDULED",
          updated_at: serverTimestamp(),
        },
      );

      setNotice(
        `${rescheduleTarget.request_id} was rescheduled.`,
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
    const capacity = Number(
      scheduleCapacity,
    );

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
        const current = schedules.find(
          (schedule) =>
            schedule.id === editingScheduleId,
        );

        const oldCapacity =
          current?.slotCapacity ??
          capacity;

        const oldAvailable =
          current?.availableSlot ??
          current?.availableSlots ??
          oldCapacity;

        const used = Math.max(
          0,
          oldCapacity - oldAvailable,
        );

        const available = Math.max(
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
            claimDate: scheduleDate,
            timeSlot:
              scheduleTime.trim(),
            slotCapacity: capacity,
            availableSlot: available,
            availableSlots: available,
            updatedAt: serverTimestamp(),
          },
        );

        setNotice(
          "Claiming schedule updated successfully.",
        );
      } else {
        const scheduleRef = doc(
          collection(
            db,
            "claimingSchedules",
          ),
        );

        await setDoc(scheduleRef, {
          scheduleId: scheduleRef.id,
          claimDate: scheduleDate,
          timeSlot: scheduleTime.trim(),
          slotCapacity: capacity,
          availableSlot: capacity,
          availableSlots: capacity,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

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
        `Delete the ${
          schedule.claimDate || "selected"
        } claiming schedule?`,
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
   * OVERVIEW CARD FILTERING
   */
  const openFilteredRequests = (
    status?: Status,
  ) => {
    setSearch("");
    setTopSearch("");
    setStatusFilter(status || "ALL");
    setActivePage("requests");
    setSelected(null);
  };

  /*
   * REPORT PERIOD
   */
  const periodStart = useMemo(() => {
    const now = new Date();
    const start = new Date(now);

    if (reportPeriod === "DAY") {
      start.setHours(0, 0, 0, 0);
    }

    if (reportPeriod === "WEEK") {
      const day = start.getDay();
      const diff =
        day === 0 ? -6 : 1 - day;

      start.setDate(
        start.getDate() + diff,
      );

      start.setHours(0, 0, 0, 0);
    }

    if (reportPeriod === "MONTH") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    if (reportPeriod === "YEAR") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }

    return start;
  }, [reportPeriod]);

  const periodRequests = requests.filter(
    (request) => {
      const created =
        request.created_at?.toDate?.() ||
        (request.requested_date
          ? new Date(
              request.requested_date,
            )
          : null);

      return (
        created &&
        created >= periodStart
      );
    },
  );

  /*
   * SEND MESSAGE
   */
  const sendMessage = async () => {
    if (
      !selectedRecipient ||
      !messageText.trim()
    ) {
      return;
    }

    clearFeedback();

    try {
      await addDoc(
        collection(db, "messages"),
        {
          participants: [
            registrarId,
            selectedRecipient.id,
          ],
          senderId: registrarId,
          senderName: registrarName,
          senderRole:
            account.role || "registrar",
          recipientId:
            selectedRecipient.id,
          recipientName:
            selectedRecipient.name,
          text: messageText.trim(),
          createdAt: serverTimestamp(),
        },
      );

      setMessageText("");
    } catch (err) {
      setError(
        `Could not send message: ${
          err instanceof Error
            ? err.message
            : "Unknown error"
        }`,
      );
    }
  };

  /*
   * REPORT EXPORT
   */
  const exportReport = () => {
    const csv = [
      "Request ID,Student ID,Requested Documents,Requested Date,Status,Amount",
      ...periodRequests.map(
        (request) =>
          [
            request.request_id,
            request.student_id,
            documentNamesFromDetails(
              getRequestDocuments(request),
            ),
            request.requested_date,
            request.status,
            request.total_amount,
          ]
            .map(
              (value) =>
                `"${String(
                  value ?? "",
                ).replace(/"/g, '""')}"`,
            )
            .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `campuserve-registrar-${reportPeriod.toLowerCase()}-report.csv`;

    anchor.click();

    URL.revokeObjectURL(url);
  };

  /*
   * REQUEST ACTIONS
   */
  const requestActions = (
    request: RequestRecord,
  ) => (
    <div className="rd-actions">
      {request.status === "PENDING" && (
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
      )}

      {request.status === "PENDING" && (
        <button
          className="danger"
          disabled={
            busyId === request.id
          }
          onClick={() => {
            setDeclineTarget(request);
            setDeclineReason("");
          }}
        >
          Decline
        </button>
      )}

      {request.status === "APPROVED" && (
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

      {request.status === "PROCESSING" && (
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
          disabled={
            busyId === request.id
          }
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
   * REQUEST TABLE + SIDE DETAIL PANEL
   */
  const requestTable = (
    rows: RequestRecord[],
    compact = false,
  ) => (
    <div
      className={`rd-request-workspace ${
        selected && !compact
          ? "has-selection"
          : ""
      }`}
    >
      <div className="rd-table-wrap rd-request-table">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Student ID</th>
              <th>
                Requested Document/s
              </th>
              <th>Date Requested</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((request) => (
              <tr
                key={request.id}
                className={
                  selected?.id ===
                  request.id
                    ? "selected-row"
                    : ""
                }
                onClick={() =>
                  !compact &&
                  setSelected(request)
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

                <td className="document-list-cell">
                  {documentNamesFromDetails(
                    getRequestDocuments(
                      request,
                    ),
                  )}
                </td>

                <td>
                  {request.requested_date ||
                    dateText(
                      request.created_at,
                    )}
                </td>

                <td>
                  <span
                    className={`rd-status ${request.status.toLowerCase()}`}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(request);
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length && (
          <p className="rd-empty">
            {loading
              ? "Loading requests..."
              : "No matching document requests found."}
          </p>
        )}
      </div>

      {selected && !compact && (
        <aside className="rd-details-panel">
          <div className="rd-details-header">
            <div>
              <span className="rd-panel-kicker">
                SELECTED REQUEST
              </span>

              <h3>
                {selected.request_id}
              </h3>
            </div>

            <button
              className="rd-modal-close"
              onClick={() =>
                setSelected(null)
              }
            >
              ×
            </button>
          </div>

          <div className="rd-detail-grid">
            <div>
              <span>Student ID</span>
              <strong>
                {selected.student_id}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                {selected.status.replace(
                  /_/g,
                  " ",
                )}
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
              <span>Request Method</span>
              <strong>
                {selected.request_method ||
                  "—"}
              </strong>
            </div>

            <div>
              <span>Total Amount</span>
              <strong>
                {money(
                  selected.total_amount,
                )}
              </strong>
            </div>
          </div>

          <div className="rd-document-breakdown">
            <h4>
              Requested Documents & Prices
            </h4>

            {selectedDetails.length ? (
              selectedDetails.map(
                (detail) => (
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

                      <small>
                        {detail.quantity ??
                          1}{" "}
                        copy/copies
                      </small>
                    </div>

                    <span>
                      {money(
                        detail.subtotal ??
                          detail.unit_price,
                      )}
                    </span>
                  </div>
                ),
              )
            ) : (
              <p className="rd-empty">
                No document detail
                records found.
              </p>
            )}
          </div>

          <div className="rd-detail-total">
            <span>
              Total Amount Paid
            </span>

            <strong>
              {money(
                selected.total_amount,
              )}
            </strong>
          </div>

          {selected.decline_review_status ===
            "PENDING_ADMIN_REVIEW" && (
            <div className="rd-review-note">
              <strong>
                Pending Admin Review
              </strong>

              <span>
                {selected.decline_reason}
              </span>
            </div>
          )}

          <div className="rd-actions rd-detail-actions">
            {requestActions(selected)}
          </div>
        </aside>
      )}
    </div>
  );

  /*
   * PAGE RENDERING
   */
  const renderPage = () => {
    /*
     * OVERVIEW
     */
    if (activePage === "overview") {
      return (
        <section className="registrar-page">
          <div className="welcome-section">
            <p className="welcome-text">
              Welcome, {registrarName}
            </p>
          </div>

          <div className="stats-grid">
            <button
              className="stat-card stat-card-button"
              onClick={() =>
                openFilteredRequests(
                  "PENDING",
                )
              }
            >
              <div className="stat-card-top">
                <span>
                  Pending Requests
                </span>

                <span className="stat-label">
                  LIVE
                </span>
              </div>

              <strong>
                {count("PENDING")}
              </strong>

              <p>Awaiting review</p>
            </button>

            <button
              className="stat-card stat-card-button"
              onClick={() => {
                setSearch("");
                setTopSearch("");
                setStatusFilter(
                  "PROCESSING",
                );
                setActivePage(
                  "requests",
                );
              }}
            >
              <div className="stat-card-top">
                <span>
                  Processing
                </span>

                <span className="stat-label">
                  LIVE
                </span>
              </div>

              <strong>
                {count("PROCESSING") +
                  count("APPROVED")}
              </strong>

              <p>
                Documents being prepared
              </p>
            </button>

            <button
              className="stat-card stat-card-button"
              onClick={() =>
                openFilteredRequests(
                  "READY_FOR_PICKUP",
                )
              }
            >
              <div className="stat-card-top">
                <span>
                  Ready for Claiming
                </span>

                <span className="stat-label">
                  LIVE
                </span>
              </div>

              <strong>
                {count(
                  "READY_FOR_PICKUP",
                )}
              </strong>

              <p>
                Ready for student pickup
              </p>
            </button>

            <button
              className="stat-card stat-card-button"
              onClick={() =>
                openFilteredRequests(
                  "COMPLETED",
                )
              }
            >
              <div className="stat-card-top">
                <span>
                  Completed Today
                </span>

                <span className="stat-label">
                  LIVE
                </span>
              </div>

              <strong>
                {completedToday}
              </strong>

              <p>
                Documents released today
              </p>
            </button>
          </div>

          <div className="services-heading">
            <h2>Registrar Services</h2>
          </div>

          <div className="services-grid">
            {Object.entries(
              PAGE_TITLES,
            )
              .filter(
                ([key]) =>
                  key !== "overview",
              )
              .map(
                ([key, title]) => (
                  <button
                    className="service-card"
                    key={key}
                    onClick={() =>
                      changePage(key)
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

          <div className="rd-panel document-reference-panel">
            <div className="document-reference-heading">
              <div>
                <span className="rd-panel-kicker">
                  UNIVERSITY CLAIM STUB
                  REFERENCE
                </span>

                <h3>
                  Registrar Document List
                </h3>
              </div>

              <span>Prices</span>
            </div>

            <div className="document-reference-list">
              {DOCUMENT_CATALOG.map(
                (document) => (
                  <div
                    key={document.name}
                  >
                    <span>
                      {document.name}
                    </span>

                    <strong>
                      {document.price ==
                      null
                        ? "Specify"
                        : money(
                            document.price,
                          )}
                    </strong>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      );
    }

    /*
     * DOCUMENT REQUESTS
     */
    if (activePage === "requests") {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage("overview")
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
                  event.target.value,
                )
              }
              placeholder="Search Request ID, Student ID, or Document name"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
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
                    value={status}
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

          {requestTable(
            filteredRequests,
          )}
        </section>
      );
    }

    /*
     * CLAIMING
     */
    if (activePage === "claiming") {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage("overview")
              }
            >
              ← Back
            </button>

            <h2>
              Claiming & Release
            </h2>
          </div>

          <div className="rd-panel">
            <label htmlFor="claim-code">
              Claim code
            </label>

            <div className="rd-toolbar">
              <input
                id="claim-code"
                value={claimCode}
                onChange={(event) => {
                  setClaimCode(
                    event.target.value.toUpperCase(),
                  );

                  setClaimResult(null);
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
                        claimCode.trim(),
                    );

                  setClaimResult(
                    found || null,
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
                  {claimResult.request_id}
                </h3>

                <p>
                  Student ID:{" "}
                  {claimResult.student_id}
                </p>

                <h4>Documents</h4>

                {getRequestDocuments(
                  claimResult,
                ).map((detail) => (
                  <p key={detail.id}>
                    {documentName(
                      detail,
                    )}{" "}
                    ×{" "}
                    {detail.quantity ??
                      1}{" "}
                    —{" "}
                    {money(
                      detail.subtotal ??
                        detail.unit_price,
                    )}
                  </p>
                ))}

                <p>
                  Status:{" "}
                  {claimResult.status.replace(
                    /_/g,
                    " ",
                  )}
                </p>

                {claimResult.status ===
                "READY_FOR_PICKUP" ? (
                  <button
                    className="primary-button"
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
                    This request is not
                    currently marked ready
                    for pickup.
                  </p>
                )}
              </div>
            )}
          </div>

          {requestTable(
            requests.filter(
              (request) =>
                request.status ===
                "READY_FOR_PICKUP",
            ),
            true,
          )}
        </section>
      );
    }

    /*
     * CLAIMING SCHEDULE
     */
    if (activePage === "schedule") {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage("overview")
              }
            >
              ← Back
            </button>

            <h2>
              Claiming Schedule
            </h2>
          </div>

          <div className="rd-panel schedule-form">
            <div className="schedule-form-grid">
              <label>
                Claim Date

                <input
                  type="date"
                  min={today()}
                  value={scheduleDate}
                  onChange={(event) =>
                    setScheduleDate(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Time Slot

                <input
                  type="text"
                  value={scheduleTime}
                  onChange={(event) =>
                    setScheduleTime(
                      event.target.value,
                    )
                  }
                  placeholder="8:00 AM – 9:00 AM"
                />
              </label>

              <label>
                Capacity

                <input
                  type="number"
                  min="1"
                  value={scheduleCapacity}
                  onChange={(event) =>
                    setScheduleCapacity(
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            <div className="rd-actions">
              <button
                className="primary-button"
                onClick={saveSchedule}
              >
                {editingScheduleId
                  ? "Update Schedule"
                  : "Create Schedule"}
              </button>

              {editingScheduleId && (
                <button
                  onClick={() => {
                    setEditingScheduleId(
                      "",
                    );
                    setScheduleDate("");
                    setScheduleTime("");
                    setScheduleCapacity(
                      "10",
                    );
                  }}
                >
                  Clear
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
                    Available Slots
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
                      key={schedule.id}
                    >
                      <td>
                        {schedule.claimDate ||
                          "—"}
                      </td>

                      <td>
                        {schedule.timeSlot ||
                          "—"}
                      </td>

                      <td>
                        {schedule.slotCapacity ??
                          "—"}
                      </td>

                      <td>
                        {schedule.availableSlot ??
                          schedule.availableSlots ??
                          "—"}
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
                No claiming schedules found.
              </p>
            )}
          </div>
        </section>
      );
    }

    /*
     * RESCHEDULING
     */
    if (activePage === "reschedule") {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage("overview")
              }
            >
              ← Back
            </button>

            <h2>Rescheduling</h2>
          </div>

          <div className="rd-toolbar">
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search Request ID, Student ID, or Document name"
            />
          </div>

          {requestTable(
            filteredRequests,
          )}
        </section>
      );
    }

    /*
     * REPORTS + DAILY SUMMARY
     */
    if (activePage === "reports") {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage("overview")
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
            ).map((period) => (
              <button
                key={period}
                className={
                  reportPeriod === period
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setReportPeriod(
                    period,
                  )
                }
              >
                {period === "DAY"
                  ? "Day"
                  : period === "WEEK"
                  ? "Week"
                  : period === "MONTH"
                  ? "Month"
                  : "Year"}
              </button>
            ))}
          </div>

          <div className="report-summary-grid">
            <div>
              <span>Requests</span>
              <strong>
                {periodRequests.length}
              </strong>
            </div>

            <div>
              <span>Pending</span>
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
              <span>Ready</span>
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
              <span>Completed</span>
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
              <span>Total Amount</span>
              <strong>
                {money(
                  periodRequests.reduce(
                    (sum, request) =>
                      sum +
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
              <h3>Status Summary</h3>

              {STATUSES.map(
                (status) => {
                  const statusCount =
                    periodRequests.filter(
                      (request) =>
                        request.status ===
                        status,
                    ).length;

                  const percentage =
                    periodRequests.length
                      ? Math.min(
                          100,
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
                        {statusCount}
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
                  {completedToday}
                </strong>
              </p>

              <p>
                Requests in selected
                period:{" "}
                <strong>
                  {periodRequests.length}
                </strong>
              </p>

              <p>
                Total recorded requests:{" "}
                <strong>
                  {requests.length}
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
    if (activePage === "history") {
      return (
        <section className="registrar-page">
          <div className="page-heading-row">
            <button
              className="back-button"
              onClick={() =>
                changePage("overview")
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
     */
    return (
      <section className="registrar-page">
        <div className="page-heading-row">
          <button
            className="back-button"
            onClick={() =>
              changePage("overview")
            }
          >
            ← Back
          </button>

          <h2>Messages</h2>
        </div>

        <div className="message-workspace">
          <aside className="message-contacts">
            <h3>Contacts</h3>

            {messagesLoading && (
              <p className="rd-empty">
                Loading...
              </p>
            )}

            {recipients.map(
              (recipient) => (
                <button
                  key={recipient.id}
                  className={
                    selectedRecipient?.id ===
                    recipient.id
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setSelectedRecipient(
                      recipient,
                    )
                  }
                >
                  <strong>
                    {recipient.name}
                  </strong>

                  <small>
                    {recipient.role}
                    {recipient.email
                      ? ` · ${recipient.email}`
                      : ""}
                  </small>
                </button>
              ),
            )}

            {!recipients.length &&
              !messagesLoading && (
                <p className="rd-empty">
                  No other accounts
                  available.
                </p>
              )}
          </aside>

          <section className="message-thread">
            {selectedRecipient ? (
              <>
                <div className="message-thread-header">
                  <strong>
                    {selectedRecipient.name}
                  </strong>

                  <span>
                    {selectedRecipient.role}
                  </span>
                </div>

                <div className="message-list">
                  {messages.length ? (
                    messages.map(
                      (message) => (
                        <div
                          key={message.id}
                          className={`message-bubble ${
                            message.senderId ===
                            registrarId
                              ? "mine"
                              : "theirs"
                          }`}
                        >
                          <p>
                            {message.text}
                          </p>

                          <small>
                            {message.senderName ||
                              "User"}{" "}
                            ·{" "}
                            {dateText(
                              message.createdAt,
                            )}
                          </small>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="rd-empty">
                      No messages yet.
                      Start the
                      conversation.
                    </p>
                  )}
                </div>

                <div className="message-compose">
                  <input
                    value={messageText}
                    onChange={(event) =>
                      setMessageText(
                        event.target.value,
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                  />

                  <button
                    className="primary-button"
                    onClick={
                      sendMessage
                    }
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="message-empty">
                <h3>
                  Select a contact
                </h3>

                <p>
                  Choose an account to
                  start messaging.
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
    );
  };

  return (
    <div
      className={`registrar-layout ${
        menuOpen
          ? "sidebar-open"
          : ""
      }`}
    >
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
                  changePage(key)
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
              {registrarName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {registrarName}
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
                await signOut(auth);
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
                setMenuOpen(
                  (open) => !open,
                )
              }
              aria-label="Toggle menu"
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
                {PAGE_TITLES[
                  activePage
                ]}
              </h3>
            </div>
          </div>

          <div className="registrar-topbar-actions">
            <div className="registrar-top-search">
              <span aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                value={topSearch}
                onChange={(event) =>
                  openSearch(
                    event.target.value,
                  )
                }
                placeholder="Search requests..."
                aria-label="Search document requests"
              />
            </div>

            <div className="registrar-notification-wrap">
              <button
                className="registrar-icon-button"
                onClick={() =>
                  setNotificationsOpen(
                    (open) => !open,
                  )
                }
                aria-label="Notifications"
                title="Notifications"
              >
                🔔

                {notifications.length >
                  0 && (
                  <span className="registrar-notification-count">
                    {notifications.length}
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

                  {notifications.length ? (
                    notifications.map(
                      (request) => (
                        <button
                          className="registrar-notification-item"
                          key={request.id}
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
                          <span
                            className={`rd-status ${request.status.toLowerCase()}`}
                          >
                            {request.status.replace(
                              /_/g,
                              " ",
                            )}
                          </span>

                          <strong>
                            {request.request_id}
                          </strong>

                          <small>
                            Student:{" "}
                            {
                              request.student_id
                            }
                          </small>
                        </button>
                      ),
                    )
                  ) : (
                    <p className="registrar-notifications-empty">
                      No new request
                      updates.
                    </p>
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
              title="Messages"
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
          <section className="rd-modal">
            <button
              className="rd-modal-close"
              onClick={() =>
                setDeclineTarget(
                  null,
                )
              }
            >
              ×
            </button>

            <h2>
              Decline Request
            </h2>

            <p>
              <strong>
                {declineTarget.request_id}
              </strong>{" "}
              will be sent to Admin for
              validity review.
            </p>

            <label>
              Reason for decline

              <textarea
                value={declineReason}
                onChange={(event) =>
                  setDeclineReason(
                    event.target.value,
                  )
                }
                placeholder="Enter the reason..."
              />
            </label>

            <div className="rd-actions">
              <button
                onClick={() =>
                  setDeclineTarget(
                    null,
                  )
                }
              >
                Back
              </button>

              <button
                className="danger"
                disabled={
                  busyId ===
                  declineTarget.id
                }
                onClick={
                  submitDecline
                }
              >
                Send to Admin
              </button>
            </div>
          </section>
        </div>
      )}

      /*
       * RESCHEDULE MODAL
       */
      {rescheduleTarget && (
        <div className="rd-modal-backdrop">
          <section className="rd-modal">
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
              <strong>
                {rescheduleTarget.request_id}
              </strong>
            </p>

            <label>
              New date

              <input
                type="date"
                value={rescheduleDate}
                min={today()}
                onChange={(event) =>
                  setRescheduleDate(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              New time

              <input
                type="text"
                value={rescheduleTime}
                onChange={(event) =>
                  setRescheduleTime(
                    event.target.value,
                  )
                }
                placeholder="8:00 AM – 9:00 AM"
              />
            </label>

            <div className="rd-actions">
              <button
                onClick={() =>
                  setRescheduleTarget(
                    null,
                  )
                }
              >
                Back
              </button>

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
            </div>
          </section>
        </div>
      )}
    </div>
  );
}