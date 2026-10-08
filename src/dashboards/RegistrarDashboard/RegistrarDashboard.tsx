import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
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
  | "CANCELLED"
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
  previous_requested_date?: string;
  previous_requested_time?: string;
  rescheduled_at?: any;
  reschedule_count?: number;
  created_at?: any;
  updated_at?: any;
  status?: Status;
  claim_code?: string | null;
  cancellation_reason?: string;
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
  createdAt?: any;
  updatedAt?: any;
};

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  requests: "Document Requests",
  claiming: "Claiming & Release",
  schedule: "Claiming Schedule",
  reschedule: "Rescheduling",
  history: "Transaction History",
  reports: "Reports & Daily Summary",
  messages: "Messages",
  settings: "Settings",
};

const STATUSES: Status[] = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
  "RESCHEDULED",
];

const TERMINAL_STATUSES: Status[] = [
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
];

const money = (value?: number | null) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getDateValue = (value: any): Date | null => {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const date = value.toDate();

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const dateText = (value: any) => {
  const date = getDateValue(value);

  if (!date) return "—";

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const dateOnly = (value: any) => {
  const date = getDateValue(value);

  if (!date) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const today = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const statusLabel = (status?: Status) =>
  String(status || "PENDING").replace(/_/g, " ");

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
    "transfer credential": "Transfer Credential",
    cav: "Cert. of Auth. & Verification (CAV)",
    "certificate of authentication & verification":
      "Cert. of Auth. & Verification (CAV)",
    authentication: "Authentication – per set",
    "certified true copy": "Certified True Copy",
    certified_true_copy: "Certified True Copy",
    report_rating: "Report of Rating / Cert. of Grades",
    "report of rating/certificate of grades":
      "Report of Rating / Cert. of Grades",
    certification: "Certification",
    others: "Others",
  };

  return aliases[raw] || detail.document_type || "Document";
};

const generateClaimCode = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i += 1) {
    result += characters.charAt(
      Math.floor(Math.random() * characters.length),
    );
  }

  return result;
};

const csvValue = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const BellIcon = () => (
  <svg
    className="topbar-svg-icon"
    viewBox="0 0 24 24"
    width="19"
    height="19"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>
);

const MessageIcon = () => (
  <svg
    className="topbar-svg-icon"
    viewBox="0 0 24 24"
    width="19"
    height="19"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.4 8.4 0 0 1-3.4-.7L4 20l1.5-3.5A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
    <path d="M8 11.5h.01" />
    <path d="M12 11.5h.01" />
    <path d="M16 11.5h.01" />
  </svg>
);

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

  const [selected, setSelected] =
    useState<RequestRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<Status | "ALL">("ALL");

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [approveTarget, setApproveTarget] =
    useState<RequestRecord | null>(null);

  const [declineTarget, setDeclineTarget] =
    useState<RequestRecord | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const [cancelTarget, setCancelTarget] =
    useState<RequestRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [rescheduleTarget, setRescheduleTarget] =
    useState<RequestRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const [claimCode, setClaimCode] = useState("");
  const [claimResult, setClaimResult] =
    useState<RequestRecord | null>(null);

  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleCapacity, setScheduleCapacity] =
    useState("10");
  const [editingScheduleId, setEditingScheduleId] =
    useState("");

  const [reportPeriod, setReportPeriod] = useState<
    "DAY" | "WEEK" | "MONTH" | "YEAR"
  >("DAY");

  const registrarId =
    account.firebaseUid ||
    account.email ||
    "registrar";

  const registrarName =
    account.name || "Registrar Staff";

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

        rows.sort((a, b) => {
          const first =
            getDateValue(a.created_at)?.getTime() || 0;
          const second =
            getDateValue(b.created_at)?.getTime() || 0;

          return second - first;
        });

        setRequests(rows);
        setLoading(false);
      },
      (snapshotError) => {
        setError(
          `Could not load document requests: ${snapshotError.message}`,
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

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
      (snapshotError) => {
        setError(
          `Could not load requested documents: ${snapshotError.message}`,
        );
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "claimingSchedules"),
      (snapshot) => {
        const rows = snapshot.docs.map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
            }) as ScheduleRecord,
        );

        rows.sort((a, b) => {
          const first = String(
            a.claimDate || "",
          );
          const second = String(
            b.claimDate || "",
          );

          return first.localeCompare(second);
        });

        setSchedules(rows);
      },
      (snapshotError) => {
        setError(
          `Could not load claiming schedules: ${snapshotError.message}`,
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
    setSelected(null);
  };

  const getRequestDocuments = (
    request: RequestRecord,
  ) => requestDetails[request.request_id] || [];

  const getDocumentNames = (
    request: RequestRecord,
  ) => {
    const details = getRequestDocuments(request);

    if (details.length === 0) {
      return "No document details";
    }

    return details
      .map((detail) => documentName(detail))
      .join(", ");
  };

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const documents = getDocumentNames(request)
        .toLowerCase();

      const matchesSearch =
        !term ||
        [
          request.request_id,
          request.student_id,
          documents,
          request.purpose,
          request.claim_code,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );

      const matchesStatus =
        statusFilter === "ALL" ||
        request.status === statusFilter;

      return matchesSearch && matchesStatus;
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

  const processingCount =
    count("APPROVED") + count("PROCESSING");

  const completedToday = requests.filter(
    (request) => {
      if (request.status !== "COMPLETED") {
        return false;
      }

      const date =
        getDateValue(request.updated_at);

      if (!date) return false;

      return date.toISOString().slice(0, 10) === today();
    },
  ).length;

  const notifications = requests
    .filter((request) =>
      ["PENDING", "READY_FOR_PICKUP"].includes(
        request.status || "",
      ),
    )
    .slice(0, 8);

  const updateStatus = async (
    request: RequestRecord,
    status: Status,
  ) => {
    setBusyId(request.id);
    clearFeedback();

    try {
      const updates: Record<string, unknown> = {
        status,
        updated_at: serverTimestamp(),
      };

      if (
        status === "READY_FOR_PICKUP" &&
        !request.claim_code
      ) {
        updates.claim_code = generateClaimCode();
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
        `${request.request_id} updated to ${statusLabel(
          status,
        )}.`,
      );
    } catch (updateError) {
      setError(
        `Could not update request: ${
          updateError instanceof Error
            ? updateError.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;

    setBusyId(approveTarget.id);
    clearFeedback();

    try {
      await updateDoc(
        doc(
          db,
          "document_requests",
          approveTarget.id,
        ),
        {
          status: "APPROVED",
          updated_at: serverTimestamp(),
        },
      );

      setNotice(
        `${approveTarget.request_id} was approved and is ready for processing.`,
      );

      setApproveTarget(null);
      setSelected(null);
    } catch (approveError) {
      setError(
        `Could not approve request: ${
          approveError instanceof Error
            ? approveError.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  const submitDecline = async () => {
    if (!declineTarget) return;

    if (!declineReason.trim()) {
      setError("A decline reason is required.");
      return;
    }

    setBusyId(declineTarget.id);
    clearFeedback();

    try {
      await updateDoc(
        doc(
          db,
          "document_requests",
          declineTarget.id,
        ),
        {
          status: "DECLINED",
          decline_reason:
            declineReason.trim(),
          decline_review_status: "COMPLETED",
          updated_at: serverTimestamp(),
        },
      );

      setNotice(
        `${declineTarget.request_id} was declined.`,
      );

      setDeclineTarget(null);
      setDeclineReason("");
      setSelected(null);
    } catch (declineError) {
      setError(
        `Could not decline request: ${
          declineError instanceof Error
            ? declineError.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;

    if (!cancelReason.trim()) {
      setError("A cancellation reason is required.");
      return;
    }

    setBusyId(cancelTarget.id);
    clearFeedback();

    try {
      await updateDoc(
        doc(
          db,
          "document_requests",
          cancelTarget.id,
        ),
        {
          status: "CANCELLED",
          cancellation_reason:
            cancelReason.trim(),
          updated_at: serverTimestamp(),
        },
      );

      setNotice(
        `${cancelTarget.request_id} was cancelled.`,
      );

      setCancelTarget(null);
      setCancelReason("");
      setSelected(null);
    } catch (cancelError) {
      setError(
        `Could not cancel request: ${
          cancelError instanceof Error
            ? cancelError.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

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
      const currentStatus =
        rescheduleTarget.status || "PENDING";

      const currentCount =
        Number(
          rescheduleTarget.reschedule_count || 0,
        );

      await updateDoc(
        doc(
          db,
          "document_requests",
          rescheduleTarget.id,
        ),
        {
          previous_requested_date:
            rescheduleTarget.requested_date || null,

          previous_requested_time:
            rescheduleTarget.requested_time || null,

          requested_date: rescheduleDate,

          requested_time:
            rescheduleTime.trim(),

          rescheduled_at:
            serverTimestamp(),

          reschedule_count:
            currentCount + 1,

          status: currentStatus,

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
      setSelected(null);
    } catch (rescheduleError) {
      setError(
        `Could not reschedule request: ${
          rescheduleError instanceof Error
            ? rescheduleError.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  const verifyClaim = () => {
    clearFeedback();

    const code = claimCode
      .trim()
      .toUpperCase();

    if (!code) {
      setClaimResult(null);
      setError("Enter a claim code.");
      return;
    }

    const result = requests.find(
      (request) =>
        String(request.claim_code || "")
          .trim()
          .toUpperCase() === code,
    );

    if (!result) {
      setClaimResult(null);
      setError(
        "No request was found for that claim code.",
      );
      return;
    }

    if (result.status !== "READY_FOR_PICKUP") {
      setClaimResult(result);
      setError(
        `This request is currently ${statusLabel(
          result.status,
        )}.`,
      );
      return;
    }

    setClaimResult(result);
    setNotice(
      `${result.request_id} is ready for release.`,
    );
  };

  const releaseClaim = async () => {
    if (!claimResult) return;

    await updateStatus(
      claimResult,
      "COMPLETED",
    );

    setClaimCode("");
    setClaimResult(null);
  };

  const startEditingSchedule = (
    schedule: ScheduleRecord,
  ) => {
    setEditingScheduleId(schedule.id);
    setScheduleDate(
      schedule.claimDate || "",
    );
    setScheduleTime(
      schedule.timeSlot || "",
    );
    setScheduleCapacity(
      String(
        schedule.slotCapacity ||
          schedule.availableSlots ||
          10,
      ),
    );
    clearFeedback();
  };

  const clearScheduleForm = () => {
    setEditingScheduleId("");
    setScheduleDate("");
    setScheduleTime("");
    setScheduleCapacity("10");
  };

  const saveSchedule = async () => {
    const capacity = Number(
      scheduleCapacity,
    );

    if (
      !scheduleDate ||
      !scheduleTime.trim()
    ) {
      setError(
        "Enter a claiming date and time slot.",
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
            schedule.id ===
            editingScheduleId,
        );

        const oldCapacity =
          current?.slotCapacity ||
          capacity;

        const oldAvailable =
          current?.availableSlot ??
          current?.availableSlots ??
          oldCapacity;

        const usedSlots = Math.max(
          0,
          oldCapacity - oldAvailable,
        );

        const available = Math.max(
          0,
          capacity - usedSlots,
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
          timeSlot:
            scheduleTime.trim(),
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

      clearScheduleForm();
    } catch (scheduleError) {
      setError(
        `Could not save claiming schedule: ${
          scheduleError instanceof Error
            ? scheduleError.message
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
        `Delete the claiming schedule for ${
          schedule.claimDate || "this date"
        }?`,
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

      if (
        editingScheduleId === schedule.id
      ) {
        clearScheduleForm();
      }
    } catch (scheduleError) {
      setError(
        `Could not delete schedule: ${
          scheduleError instanceof Error
            ? scheduleError.message
            : "Unknown error"
        }`,
      );
    }
  };

  const openFilteredRequests = (
    status?: Status,
  ) => {
    setSearch("");
    setTopSearch("");
    setStatusFilter(status || "ALL");
    setActivePage("requests");
    setSelected(null);
    clearFeedback();
  };

  const periodStart = useMemo(() => {
    const now = new Date();
    const start = new Date(now);

    if (reportPeriod === "DAY") {
      start.setHours(0, 0, 0, 0);
    }

    if (reportPeriod === "WEEK") {
      const day = start.getDay();
      const difference =
        day === 0 ? -6 : 1 - day;

      start.setDate(
        start.getDate() + difference,
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

  const reportRequests = useMemo(() => {
    return requests.filter((request) => {
      const created =
        getDateValue(request.created_at);

      if (!created) return false;

      return created >= periodStart;
    });
  }, [requests, periodStart]);

  const reportTotalAmount = reportRequests.reduce(
    (total, request) =>
      total + Number(request.total_amount || 0),
    0,
  );

  const exportReport = () => {
    const rows = [
      [
        "Request ID",
        "Student ID",
        "Requested Document/s",
        "Requested Date",
        "Requested Time",
        "Status",
        "Amount",
      ],
      ...reportRequests.map((request) => [
        request.request_id,
        request.student_id,
        getDocumentNames(request),
        request.requested_date || "",
        request.requested_time || "",
        statusLabel(request.status),
        request.total_amount || 0,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map(csvValue).join(","),
      )
      .join("\n");

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

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);

    setNotice("Report exported successfully.");
  };

  const handleLogout = async () => {
    clearFeedback();

    try {
      await signOut(auth);
    } catch (logoutError) {
      setError(
        `Could not log out: ${
          logoutError instanceof Error
            ? logoutError.message
            : "Unknown error"
        }`,
      );
    }
  };

  const requestActions = (
    request: RequestRecord,
  ) => {
    const status =
      request.status || "PENDING";

    return (
      <div className="rd-actions">
        {status === "PENDING" && (
          <>
            <button
              className="rd-action-button"
              disabled={busyId === request.id}
              onClick={() => {
                clearFeedback();
                setApproveTarget(request);
              }}
            >
              Approve
            </button>

            <button
              className="rd-action-button danger"
              disabled={busyId === request.id}
              onClick={() => {
                clearFeedback();
                setDeclineTarget(request);
                setDeclineReason("");
              }}
            >
              Decline
            </button>
          </>
        )}

        {status === "APPROVED" && (
          <button
            className="rd-action-button"
            disabled={busyId === request.id}
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

        {status === "PROCESSING" && (
          <button
            className="rd-action-button"
            disabled={busyId === request.id}
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

        {status === "READY_FOR_PICKUP" && (
          <button
            className="rd-action-button"
            disabled={busyId === request.id}
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

        {!TERMINAL_STATUSES.includes(
          status,
        ) && (
          <button
            className="rd-action-button secondary"
            disabled={busyId === request.id}
            onClick={() => {
              clearFeedback();
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

        {!TERMINAL_STATUSES.includes(
          status,
        ) && (
          <button
            className="rd-action-button danger-outline"
            disabled={busyId === request.id}
            onClick={() => {
              clearFeedback();
              setCancelTarget(request);
              setCancelReason("");
            }}
          >
            Cancel
          </button>
        )}
      </div>
    );
  };

  const heading = (
    title: string,
    description?: string,
  ) => (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && (
          <p>{description}</p>
        )}
      </div>
    </div>
  );

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
            <th>Date Requested</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((request) => (
            <tr
              key={request.id}
              className={
                selected?.id === request.id
                  ? "selected-row"
                  : ""
              }
              onClick={() =>
                setSelected(request)
              }
            >
              <td>
                <strong>
                  {request.request_id ||
                    request.id}
                </strong>
              </td>

              <td>
                {request.student_id ||
                  "—"}
              </td>

              <td>
                <div className="document-cell">
                  {getDocumentNames(
                    request,
                  )}
                </div>
              </td>

              <td>
                {request.requested_date ||
                  dateOnly(
                    request.created_at,
                  )}
              </td>

              <td>
                <span
                  className={`rd-status ${String(
                    request.status ||
                      "PENDING",
                  ).toLowerCase()}`}
                >
                  {statusLabel(
                    request.status,
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="rd-empty">
          {loading
            ? "Loading requests..."
            : "No matching document requests found."}
        </div>
      )}
    </div>
  );

  const renderOverview = () => (
    <section className="registrar-page">
      <div className="welcome-section">
        <p className="eyebrow">
          CAMPUSERVE
        </p>

        <h1>Registrar Dashboard</h1>

        <p className="welcome-text">
          Welcome,{" "}
          {account.name ||
            "Registrar Staff"}
        </p>
      </div>

      <div className="overview-header">
        <div>
          <h2>Overview</h2>
          <p>
            Manage student document
            requests and claiming schedules.
          </p>
        </div>
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
            <span>Pending Requests</span>
            <span className="stat-label">
              REVIEW
            </span>
          </div>

          <strong>{count("PENDING")}</strong>

          <p>Awaiting review</p>
        </button>

        <button
          className="stat-card stat-card-button"
          onClick={() =>
            openFilteredRequests()
          }
        >
          <div className="stat-card-top">
            <span>Processing</span>
            <span className="stat-label">
              ACTIVE
            </span>
          </div>

          <strong>{processingCount}</strong>

          <p>
            Approved and being prepared
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
              CLAIM
            </span>
          </div>

          <strong>
            {count("READY_FOR_PICKUP")}
          </strong>

          <p>Ready for release</p>
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
            <span>Completed Today</span>
            <span className="stat-label">
              TODAY
            </span>
          </div>

          <strong>{completedToday}</strong>

          <p>Released requests</p>
        </button>
      </div>

      <div className="services-section">
        <div className="services-heading">
          <h2>Registrar Services</h2>
          <p>
            Open a section to continue
            managing transactions.
          </p>
        </div>

        <div className="services-grid">
          <button
            className="service-card"
            onClick={() =>
              changePage("requests")
            }
          >
            <div>
              <strong>
                Document Requests
              </strong>
              <span>
                Review and process student
                requests.
              </span>
            </div>

            <span className="service-arrow">
              →
            </span>
          </button>

          <button
            className="service-card"
            onClick={() =>
              changePage("claiming")
            }
          >
            <div>
              <strong>
                Claiming & Release
              </strong>
              <span>
                Verify claim codes and
                release documents.
              </span>
            </div>

            <span className="service-arrow">
              →
            </span>
          </button>

          <button
            className="service-card"
            onClick={() =>
              changePage("schedule")
            }
          >
            <div>
              <strong>
                Claiming Schedule
              </strong>
              <span>
                Manage available claiming
                slots.
              </span>
            </div>

            <span className="service-arrow">
              →
            </span>
          </button>

          <button
            className="service-card"
            onClick={() =>
              changePage("reports")
            }
          >
            <div>
              <strong>
                Reports & Daily Summary
              </strong>
              <span>
                Review registrar activity
                and export records.
              </span>
            </div>

            <span className="service-arrow">
              →
            </span>
          </button>
        </div>
      </div>
    </section>
  );

  const renderRequests = () => (
    <section className="registrar-page">
      <div className="page-back-row">
        <button
          className="back-button"
          onClick={() =>
            changePage("overview")
          }
        >
          ← Back to Overview
        </button>
      </div>

      {heading(
        "Document Requests",
        "Review and process student document requests.",
      )}

      <div className="rd-toolbar">
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search request ID, student ID, or document"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as
                | Status
                | "ALL",
            )
          }
        >
          <option value="ALL">
            All statuses
          </option>

          {STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="rd-master-detail">
        <div className="rd-request-list">
          {requestTable(
            filteredRequests,
          )}
        </div>

        <div className="rd-detail-panel">
          {selected ? (
            <>
              <div className="rd-detail-header">
                <div>
                  <span className="rd-detail-label">
                    REQUEST
                  </span>

                  <h2>
                    {selected.request_id ||
                      selected.id}
                  </h2>
                </div>

                <button
                  className="rd-detail-close"
                  onClick={() =>
                    setSelected(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="rd-detail-status">
                <span
                  className={`rd-status ${String(
                    selected.status ||
                      "PENDING",
                  ).toLowerCase()}`}
                >
                  {statusLabel(
                    selected.status,
                  )}
                </span>
              </div>

              <div className="rd-detail-section">
                <h3>
                  Request Information
                </h3>

                <div className="rd-detail-grid">
                  <div>
                    <span>
                      Student ID
                    </span>
                    <strong>
                      {selected.student_id ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Request Method
                    </span>
                    <strong>
                      {selected.request_method ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Requested Date
                    </span>
                    <strong>
                      {selected.requested_date ||
                        dateOnly(
                          selected.created_at,
                        )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Requested Time
                    </span>
                    <strong>
                      {selected.requested_time ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Number of Copies
                    </span>
                    <strong>
                      {selected.number_of_copies ??
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Total Amount
                    </span>
                    <strong>
                      {money(
                        selected.total_amount,
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rd-detail-section">
                <h3>
                  Requested Document/s
                </h3>

                {getRequestDocuments(
                  selected,
                ).length > 0 ? (
                  <div className="document-detail-list">
                    {getRequestDocuments(
                      selected,
                    ).map((detail) => (
                      <div
                        className="document-detail-item"
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
                              1}
                          </span>
                        </div>

                        <div>
                          {detail.subtotal !=
                          null
                            ? money(
                                detail.subtotal,
                              )
                            : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rd-muted">
                    No separate document
                    details were found for
                    this request.
                  </p>
                )}
              </div>

              {selected.purpose && (
                <div className="rd-detail-section">
                  <h3>Purpose</h3>
                  <p className="rd-detail-purpose">
                    {selected.purpose}
                  </p>
                </div>
              )}

              {selected.decline_reason && (
                <div className="rd-detail-section">
                  <h3>Decline Reason</h3>
                  <p className="cancellation-detail">
                    {selected.decline_reason}
                  </p>
                </div>
              )}

              {selected.cancellation_reason && (
                <div className="rd-detail-section">
                  <h3>
                    Cancellation Reason
                  </h3>
                  <p className="cancellation-detail">
                    {
                      selected.cancellation_reason
                    }
                  </p>
                </div>
              )}

              {selected.claim_code && (
                <div className="rd-detail-section">
                  <h3>Claim Code</h3>

                  <div className="claim-code-display">
                    {selected.claim_code}
                  </div>
                </div>
              )}

              {selected.rescheduled_at && (
                <div className="rd-detail-section">
                  <h3>
                    Rescheduling Information
                  </h3>

                  <div className="rd-detail-grid">
                    <div>
                      <span>
                        Previous Date
                      </span>

                      <strong>
                        {selected.previous_requested_date ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Previous Time
                      </span>

                      <strong>
                        {selected.previous_requested_time ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Reschedule Count
                      </span>

                      <strong>
                        {selected.reschedule_count ||
                          0}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Rescheduled At
                      </span>

                      <strong>
                        {dateText(
                          selected.rescheduled_at,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="rd-detail-section">
                <h3>Actions</h3>

                {requestActions(selected)}
              </div>
            </>
          ) : (
            <div className="rd-detail-empty">
              <h3>
                Select a request
              </h3>

              <p>
                Select a row from the table
                to view the complete request
                details and available actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderClaiming = () => (
    <section className="registrar-page">
      {heading(
        "Claiming & Release",
        "Verify the student's claim code before releasing the requested documents.",
      )}

      <div className="claiming-layout">
        <div className="rd-panel">
          <h3>
            Verify Claim Code
          </h3>

          <p className="rd-muted">
            Enter the claim code provided to
            the student.
          </p>

          <div className="claim-input-row">
            <input
              value={claimCode}
              onChange={(event) =>
                setClaimCode(
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="Enter claim code"
              maxLength={12}
            />

            <button
              className="primary-button"
              onClick={verifyClaim}
            >
              Verify
            </button>
          </div>
        </div>

        <div className="rd-panel">
          <h3>
            Release Information
          </h3>

          {!claimResult ? (
            <div className="rd-empty">
              No claim is currently
              verified.
            </div>
          ) : (
            <div className="claim-result">
              <div className="claim-result-heading">
                <span>
                  Request ID
                </span>

                <strong>
                  {claimResult.request_id}
                </strong>
              </div>

              <div className="rd-detail-grid">
                <div>
                  <span>
                    Student ID
                  </span>

                  <strong>
                    {claimResult.student_id}
                  </strong>
                </div>

                <div>
                  <span>
                    Status
                  </span>

                  <strong>
                    {statusLabel(
                      claimResult.status,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Requested Date
                  </span>

                  <strong>
                    {claimResult.requested_date ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Requested Time
                  </span>

                  <strong>
                    {claimResult.requested_time ||
                      "—"}
                  </strong>
                </div>
              </div>

              <div className="rd-detail-section">
                <h4>
                  Requested Document/s
                </h4>

                <p>
                  {getDocumentNames(
                    claimResult,
                  )}
                </p>
              </div>

              <button
                className="primary-button wide-button"
                disabled={
                  claimResult.status !==
                  "READY_FOR_PICKUP"
                }
                onClick={releaseClaim}
              >
                Release Documents
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderSchedule = () => (
    <section className="registrar-page">
      {heading(
        "Claiming Schedule",
        "Create and manage available claiming dates and time slots.",
      )}

      <div className="schedule-layout">
        <div className="rd-panel">
          <div className="schedule-form-heading">
            <div>
              <h3>
                {editingScheduleId
                  ? "Edit Schedule"
                  : "Create Schedule"}
              </h3>

              <p>
                Set the date, time slot, and
                maximum number of students.
              </p>
            </div>

            {editingScheduleId && (
              <button
                className="back-button"
                onClick={
                  clearScheduleForm
                }
              >
                Clear
              </button>
            )}
          </div>

          <div className="schedule-fields">
            <label>
              <span>
                Claiming Date
              </span>

              <input
                type="date"
                value={scheduleDate}
                onChange={(event) =>
                  setScheduleDate(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Time Slot
              </span>

              <input
                type="text"
                value={scheduleTime}
                onChange={(event) =>
                  setScheduleTime(
                    event.target.value,
                  )
                }
                placeholder="e.g. 8:00 AM – 10:00 AM"
              />
            </label>

            <label>
              <span>
                Slot Capacity
              </span>

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

          <button
            className="primary-button schedule-save-button"
            onClick={saveSchedule}
          >
            {editingScheduleId
              ? "Save Changes"
              : "Create Schedule"}
          </button>
        </div>

        <div className="rd-panel">
          <div className="section-title-row">
            <div>
              <h3>
                Available Schedules
              </h3>

              <p>
                {schedules.length} schedule
                {schedules.length === 1
                  ? ""
                  : "s"} recorded
              </p>
            </div>
          </div>

          {schedules.length === 0 ? (
            <div className="rd-empty">
              No claiming schedules have
              been created yet.
            </div>
          ) : (
            <div className="schedule-list">
              {schedules.map(
                (schedule) => {
                  const capacity =
                    schedule.slotCapacity ||
                    0;

                  const available =
                    schedule.availableSlot ??
                    schedule.availableSlots ??
                    capacity;

                  return (
                    <div
                      className="schedule-item"
                      key={schedule.id}
                    >
                      <div className="schedule-date">
                        <strong>
                          {schedule.claimDate ||
                            "No date"}
                        </strong>

                        <span>
                          {schedule.timeSlot ||
                            "No time slot"}
                        </span>
                      </div>

                      <div className="schedule-capacity">
                        <strong>
                          {available}
                        </strong>

                        <span>
                          available of{" "}
                          {capacity}
                        </span>
                      </div>

                      <div className="schedule-actions">
                        <button
                          className="rd-small-button"
                          onClick={() =>
                            startEditingSchedule(
                              schedule,
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="rd-small-button danger"
                          onClick={() =>
                            removeSchedule(
                              schedule,
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderReschedule = () => (
    <section className="registrar-page">
      {heading(
        "Rescheduling",
        "Update the requested claiming date and time for active requests.",
      )}

      <div className="rd-panel">
        <div className="rd-toolbar">
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search request ID, student ID, or document"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | Status
                  | "ALL",
              )
            }
          >
            <option value="ALL">
              All statuses
            </option>

            {STATUSES.map((status) => (
              <option
                key={status}
                value={status}
              >
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="reschedule-list">
          {filteredRequests
            .filter(
              (request) =>
                !TERMINAL_STATUSES.includes(
                  request.status ||
                    "PENDING",
                ),
            )
            .map((request) => (
              <div
                className="reschedule-item"
                key={request.id}
              >
                <div>
                  <strong>
                    {request.request_id}
                  </strong>

                  <span>
                    Student ID:{" "}
                    {request.student_id}
                  </span>

                  <span>
                    Current schedule:{" "}
                    {request.requested_date ||
                      "—"}{" "}
                    {request.requested_time ||
                      ""}
                  </span>

                  {request.reschedule_count &&
                    request.reschedule_count >
                      0 && (
                      <span>
                        Rescheduled{" "}
                        {request.reschedule_count}{" "}
                        time
                        {request.reschedule_count ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    )}
                </div>

                <button
                  className="rd-small-button"
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
                    clearFeedback();
                  }}
                >
                  Reschedule
                </button>
              </div>
            ))}

          {filteredRequests.filter(
            (request) =>
              !TERMINAL_STATUSES.includes(
                request.status ||
                  "PENDING",
              ),
          ).length === 0 && (
            <div className="rd-empty">
              No active requests available
              for rescheduling.
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderHistory = () => {
    const historyRows =
      filteredRequests.filter(
        (request) =>
          TERMINAL_STATUSES.includes(
            request.status ||
              "PENDING",
          ) ||
          Boolean(request.rescheduled_at),
      );

    return (
      <section className="registrar-page">
        {heading(
          "Transaction History",
          "Review completed, declined, cancelled, and rescheduled requests.",
        )}

        <div className="rd-toolbar">
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search transaction history"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | Status
                  | "ALL",
              )
            }
          >
            <option value="ALL">
              All statuses
            </option>

            {STATUSES.map((status) => (
              <option
                key={status}
                value={status}
              >
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        {requestTable(historyRows)}
      </section>
    );
  };

  const renderReports = () => (
    <section className="registrar-page">
      {heading(
        "Reports & Daily Summary",
        "Review registrar transaction activity by reporting period.",
      )}

      <div className="report-toolbar">
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
                  ? "report-period active"
                  : "report-period"
              }
              onClick={() =>
                setReportPeriod(period)
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

        <button
          className="primary-button"
          onClick={exportReport}
        >
          Export CSV
        </button>
      </div>

      <div className="report-summary">
        <div className="report-summary-header">
          <div>
            <span>
              CAMPUSERVE
            </span>

            <h2>
              Registrar Transaction Report
            </h2>

            <p>
              Period:{" "}
              {reportPeriod.toLowerCase()}
            </p>
          </div>

          <div className="report-date">
            Generated{" "}
            {new Date().toLocaleDateString(
              "en-PH",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              },
            )}
          </div>
        </div>

        <div className="report-summary-grid">
          <div>
            <span>
              Total Requests
            </span>
            <strong>
              {reportRequests.length}
            </strong>
          </div>

          <div>
            <span>
              Pending
            </span>
            <strong>
              {
                reportRequests.filter(
                  (request) =>
                    request.status ===
                    "PENDING",
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Processing
            </span>
            <strong>
              {
                reportRequests.filter(
                  (request) =>
                    request.status ===
                      "APPROVED" ||
                    request.status ===
                      "PROCESSING",
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
                reportRequests.filter(
                  (request) =>
                    request.status ===
                    "COMPLETED",
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Ready for Claiming
            </span>
            <strong>
              {
                reportRequests.filter(
                  (request) =>
                    request.status ===
                    "READY_FOR_PICKUP",
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Total Amount
            </span>
            <strong>
              {money(reportTotalAmount)}
            </strong>
          </div>
        </div>

        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {STATUSES.map((status) => (
                <tr key={status}>
                  <td>
                    {statusLabel(status)}
                  </td>

                  <td>
                    {
                      reportRequests.filter(
                        (request) =>
                          request.status ===
                          status,
                      ).length
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  const renderMessages = () => (
    <section className="registrar-page">
      {heading(
        "Messages",
        "Messaging is managed through the shared CampuServe messaging feature.",
      )}

      <div className="messages-integration">
        <div>
          <h3>
            Shared Messaging
          </h3>

          <p>
            The Registrar dashboard is ready
            to connect to the shared Messages
            module maintained by the assigned
            team member.
          </p>

          <p>
            No separate Registrar messaging
            database or duplicate messaging
            workflow is created here.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() =>
            setNotice(
              "Open the shared Messages module from the CampuServe navigation when it is connected.",
            )
          }
        >
          Messages
        </button>
      </div>
    </section>
  );

  const renderSettings = () => (
    <section className="registrar-page">
      {heading(
        "Settings",
        "View the Registrar account and dashboard information.",
      )}

      <div className="settings-panel">
        <div className="settings-account">
          <div className="settings-avatar">
            {(registrarName.charAt(0) ||
              "R").toUpperCase()}
          </div>

          <div>
            <h3>
              {registrarName}
            </h3>

            <p>
              {account.email ||
                "No email available"}
            </p>
          </div>
        </div>

        <div className="settings-row">
          <span>
            Role
          </span>

          <strong>
            Registrar Staff
          </strong>
        </div>

        <div className="settings-row">
          <span>
            Account Status
          </span>

          <strong className="settings-status">
            Active
          </strong>
        </div>

        <div className="settings-row">
          <span>
            Dashboard
          </span>

          <strong>
            Registrar
          </strong>
        </div>
      </div>
    </section>
  );

  const renderPage = () => {
    switch (activePage) {
      case "overview":
        return renderOverview();

      case "requests":
        return renderRequests();

      case "claiming":
        return renderClaiming();

      case "schedule":
        return renderSchedule();

      case "reschedule":
        return renderReschedule();

      case "history":
        return renderHistory();

      case "reports":
        return renderReports();

      case "messages":
        return renderMessages();

      case "settings":
        return renderSettings();

      default:
        return renderOverview();
    }
  };

  return (
    <div className="registrar-layout">
      <aside
        className={
          menuOpen
            ? "registrar-menu open"
            : "registrar-menu"
        }
      >
        <div className="menu-header">
          <div className="menu-brand">
            <div className="brand-mark">
              C
            </div>

            <div>
              <strong>
                CAMPUSERVE
              </strong>

              <span>
                Registrar
              </span>
            </div>
          </div>
        </div>

        <nav className="registrar-nav">
          <button
            className={
              activePage === "overview"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("overview")
            }
          >
            <span>Overview</span>
          </button>

          <button
            className={
              activePage === "requests"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("requests")
            }
          >
            <span>
              Document Requests
            </span>
          </button>

          <button
            className={
              activePage === "claiming"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("claiming")
            }
          >
            <span>
              Claiming & Release
            </span>
          </button>

          <button
            className={
              activePage === "schedule"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("schedule")
            }
          >
            <span>
              Claiming Schedule
            </span>
          </button>

          <button
            className={
              activePage === "reschedule"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("reschedule")
            }
          >
            <span>
              Rescheduling
            </span>
          </button>

          <button
            className={
              activePage === "history"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("history")
            }
          >
            <span>
              Transaction History
            </span>
          </button>

          <button
            className={
              activePage === "reports"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("reports")
            }
          >
            <span>
              Reports & Daily Summary
            </span>
          </button>

          <button
            className={
              activePage === "messages"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("messages")
            }
          >
            <span>
              Messages
            </span>
          </button>

          <button
            className={
              activePage === "settings"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              changePage("settings")
            }
          >
            <span>
              Settings
            </span>
          </button>
        </nav>

        <div className="menu-bottom">
          <div className="staff-profile">
            <div className="staff-avatar">
              {(registrarName.charAt(0) ||
                "R").toUpperCase()}
            </div>

            <div className="staff-info">
              <strong>
                {registrarName}
              </strong>

              <span>
                Registrar Staff
              </span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
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
                  (current) => !current,
                )
              }
              aria-label="Toggle menu"
            >
              ☰
            </button>

            <h3>
              {PAGE_TITLES[activePage] ||
                "Registrar Dashboard"}
            </h3>
          </div>

          <div className="registrar-topbar-actions">
            <div className="registrar-top-search">
              <input
                value={topSearch}
                onChange={(event) =>
                  openSearch(
                    event.target.value,
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
                    (current) =>
                      !current,
                  )
                }
                aria-label="Notifications"
                title="Notifications"
              >
                <span className="topbar-icon">
                  <BellIcon />
                </span>

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
                      aria-label="Close notifications"
                    >
                      ×
                    </button>
                  </div>

                  {notifications.length ===
                  0 ? (
                    <div className="registrar-notifications-empty">
                      No new notifications.
                    </div>
                  ) : (
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
                          <strong>
                            {
                              request.request_id
                            }
                          </strong>

                          <span>
                            {request.status ===
                            "PENDING"
                              ? "New document request awaiting review."
                              : "Document is ready for claiming."}
                          </span>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}
            </div>

            <button
              className="registrar-icon-button"
              onClick={() =>
                changePage("messages")
              }
              aria-label="Messages"
              title="Messages"
            >
              <span className="topbar-icon">
                <MessageIcon />
              </span>
            </button>
          </div>
        </header>

        {error && (
          <div className="rd-alert error">
            <span>{error}</span>

            <button
              onClick={() =>
                setError("")
              }
            >
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="rd-alert success">
            <span>{notice}</span>

            <button
              onClick={() =>
                setNotice("")
              }
            >
              ×
            </button>
          </div>
        )}

        {renderPage()}
      </main>

      {approveTarget && (
        <div className="rd-modal-layer">
          <div className="rd-modal">
            <div className="rd-modal-header">
              <div>
                <span>
                  APPROVE REQUEST
                </span>

                <h2>
                  {approveTarget.request_id}
                </h2>
              </div>

              <button
                className="rd-modal-close"
                onClick={() =>
                  setApproveTarget(null)
                }
              >
                ×
              </button>
            </div>

            <div className="rd-approval-summary">
              <div>
                <span>Student ID</span>
                <strong>
                  {approveTarget.student_id ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Requested Document/s</span>
                <strong>
                  {getDocumentNames(
                    approveTarget,
                  )}
                </strong>
              </div>

              <div>
                <span>Requested Schedule</span>
                <strong>
                  {approveTarget.requested_date ||
                    "—"}{" "}
                  {approveTarget.requested_time ||
                    ""}
                </strong>
              </div>

              <div>
                <span>Total Amount</span>
                <strong>
                  {money(
                    approveTarget.total_amount,
                  )}
                </strong>
              </div>
            </div>

            <p>
              Review the request information
              before approving it. Once
              approved, the request will move
              to the processing stage and the
              Registrar can start preparing the
              requested document/s.
            </p>

            <div className="rd-modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setApproveTarget(null)
                }
              >
                Back
              </button>

              <button
                className="primary-button"
                disabled={
                  busyId ===
                  approveTarget.id
                }
                onClick={
                  confirmApprove
                }
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {declineTarget && (
        <div className="rd-modal-layer">
          <div className="rd-modal">
            <div className="rd-modal-header">
              <div>
                <span>
                  DECLINE REQUEST
                </span>

                <h2>
                  {declineTarget.request_id}
                </h2>
              </div>

              <button
                className="rd-modal-close"
                onClick={() =>
                  setDeclineTarget(null)
                }
              >
                ×
              </button>
            </div>

            <p>
              Review the request and enter
              the reason for declining it.
              The reason will be saved with
              the transaction record.
            </p>

            <div className="rd-approval-summary">
              <div>
                <span>Student ID</span>
                <strong>
                  {declineTarget.student_id ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Requested Document/s</span>
                <strong>
                  {getDocumentNames(
                    declineTarget,
                  )}
                </strong>
              </div>
            </div>

            <textarea
              value={declineReason}
              onChange={(event) =>
                setDeclineReason(
                  event.target.value,
                )
              }
              placeholder="Enter decline reason..."
              rows={5}
            />

            <div className="rd-modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setDeclineTarget(null);
                  setDeclineReason("");
                }}
              >
                Back
              </button>

              <button
                className="primary-button danger-button"
                disabled={
                  busyId ===
                  declineTarget.id
                }
                onClick={
                  submitDecline
                }
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="rd-modal-layer">
          <div className="rd-modal">
            <div className="rd-modal-header">
              <div>
                <span>
                  CANCEL REQUEST
                </span>

                <h2>
                  {cancelTarget.request_id}
                </h2>
              </div>

              <button
                className="rd-modal-close"
                onClick={() =>
                  setCancelTarget(null)
                }
              >
                ×
              </button>
            </div>

            <p>
              Enter the reason for
              cancelling this request.
            </p>

            <textarea
              value={cancelReason}
              onChange={(event) =>
                setCancelReason(
                  event.target.value,
                )
              }
              placeholder="Enter cancellation reason..."
              rows={5}
            />

            <div className="rd-modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
              >
                Back
              </button>

              <button
                className="primary-button danger-button"
                disabled={
                  busyId ===
                  cancelTarget.id
                }
                onClick={
                  submitCancel
                }
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleTarget && (
        <div className="rd-modal-layer">
          <div className="rd-modal">
            <div className="rd-modal-header">
              <div>
                <span>
                  RESCHEDULE REQUEST
                </span>

                <h2>
                  {rescheduleTarget.request_id}
                </h2>
              </div>

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
            </div>

            <p>
              Select the new claiming date
              and time.
            </p>

            <div className="modal-form-grid">
              <label>
                <span>
                  New Date
                </span>

                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) =>
                    setRescheduleDate(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  New Time
                </span>

                <input
                  type="text"
                  value={rescheduleTime}
                  onChange={(event) =>
                    setRescheduleTime(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. 10:00 AM – 12:00 PM"
                />
              </label>
            </div>

            <div className="rd-modal-actions">
              <button
                className="secondary-button"
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
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}