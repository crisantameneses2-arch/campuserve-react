import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
 // addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
 // query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../../../firebase";
import { notify, studentAudience } from "../../services/notifications";
import {
  approveDocumentRequest,
  markDocumentReadyForPickup,
  startPaidDocumentProcessing,
  sortPaidProcessingQueue,
  sortRequestsFIFO,
  createClaimingSchedule,
  assignRequestClaimingSchedule,
  logRegistrarActivity,
} from "../../services/registrarWorkflow";
import "./RegistrarDashboard.css";

type Account = {
  email?: string;
  name?: string;
  role?: string;
  firebaseUid?: string;
  student_id?: string;
  department?: string;
  employeeId?: string;
  campus?: string;
  status?: string;
  position?: string;
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
  submitted_at?: any;
  updated_at?: any;
  approved_at?: any;
  approved_by?: string;
  approved_by_name?: string;
  payment_stub_code?: string | null;
  payment_status?: "UNPAID" | "PAID";
  payment_confirmed_at?: any;
  payment_confirmed_by?: string;
  processing_started_at?: any;
  processing_started_by?: string;
  status?: Status;
  claim_code?: string | null;
  claiming_schedule_id?: string | null;
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
  period?: "AM" | "PM";
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

const normalizeCollege = (value: unknown) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const isAllCollegesDepartment = (value?: string) =>
  ["ALL COLLEGES", "ALL DEPARTMENTS / OFFICES"].includes(
    normalizeCollege(value),
  );

const normalizeStudentId = (value: unknown) =>
  String(value || "").trim().toUpperCase();

const collegesFromDepartment = (department?: string): string[] => {
  const normalized = normalizeCollege(department);
  if (!normalized || isAllCollegesDepartment(department)) return [];
  return normalized.split(/\s*\/\s*/).map(normalizeCollege).filter(Boolean);
};
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

export default function RegistrarDashboard({
  account,
}: RegistrarDashboardProps) {
  const [activePage, setActivePage] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(true);
  const [allRequests, setAllRequests] = useState<RequestRecord[]>([]);
  const [studentCollegesById, setStudentCollegesById] = useState<Record<string, string>>({});
  const [collegeAssignmentsLoaded, setCollegeAssignmentsLoaded] = useState(false);
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
  const [statusFilter, setStatusFilter] =
    useState<Status | "ALL">("ALL");
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);
  const [newRequestToast, setNewRequestToast] = useState<{
    count: number;
    type: "login" | "arrival";
  } | null>(null);
  const requestToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownRequestIdsRef = useRef<Set<string> | null>(null);
  const showNewRequestToast = useCallback((count: number, type: "login" | "arrival") => {
    if (count < 1) return;
    setNewRequestToast({ count, type });
    if (requestToastTimerRef.current) clearTimeout(requestToastTimerRef.current);
    requestToastTimerRef.current = setTimeout(() => {
      setNewRequestToast(null);
      requestToastTimerRef.current = null;
    }, 7000);
  }, []);
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
  const [rescheduleScheduleId, setRescheduleScheduleId] = useState("");
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
    account.firebaseUid || account.email || "registrar";
  const registrarName = account.name || "Registrar Staff";
  const registrarAssignmentLabel =
    isAllCollegesDepartment(account.department)
      ? "All Colleges"
      : collegesFromDepartment(account.department).join(" • ") || "Assignment not set";
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
        setAllRequests(rows);
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
      collection(db, "accounts"),
      (snapshot) => {
        const colleges: Record<string, string> = {};
        snapshot.docs.forEach((item) => {
          const data = item.data();
          if (!["student", "alumni"].includes(String(data.role || ""))) return;
          const studentId = normalizeStudentId(data.student_id);
          const college = normalizeCollege(data.college);
          if (studentId && college) colleges[studentId] = college;
        });
        setStudentCollegesById(colleges);
        setCollegeAssignmentsLoaded(true);
      },
      (snapshotError) => {
        setError("Could not load student college assignments: " + snapshotError.message);
      },
    );
    return unsubscribe;
  }, []);
  const requests = useMemo(() => {
    const assignedColleges = collegesFromDepartment(account.department);
    if (isAllCollegesDepartment(account.department)) {
      return sortRequestsFIFO(allRequests);
    }
    if (assignedColleges.length === 0) return [];
    const assigned = new Set(assignedColleges);
    return sortRequestsFIFO(
      allRequests.filter((request) => {
        const studentCollege = studentCollegesById[normalizeStudentId(request.student_id)];
        return Boolean(studentCollege && assigned.has(normalizeCollege(studentCollege)));
      }),
    );
  }, [allRequests, studentCollegesById, account.department]);
  useEffect(() => {
    if (loading || !collegeAssignmentsLoaded) return;
    const currentIds = new Set(requests.map((request) => request.id));
    const previousIds = knownRequestIdsRef.current;
    if (!previousIds) {
      knownRequestIdsRef.current = currentIds;
      const pendingAtLogin = requests.filter((request) => request.status === "PENDING").length;
      showNewRequestToast(pendingAtLogin, "login");
      return;
    }

    const arrivingCount = requests.filter(
      (request) => request.status === "PENDING" && !previousIds.has(request.id),
    ).length;
    currentIds.forEach((id) => previousIds.add(id));
    if (arrivingCount > 0) showNewRequestToast(arrivingCount, "arrival");
  }, [requests, loading, collegeAssignmentsLoaded, showNewRequestToast]);
  useEffect(() => () => {
    if (requestToastTimerRef.current) clearTimeout(requestToastTimerRef.current);
  }, []);
  useEffect(() => {
    if (!selected) return;
    const latestRequest = requests.find((request) => request.id === selected.id);
    if (!latestRequest) {
      setSelected(null);
      return;
    }
    if (latestRequest !== selected) setSelected(latestRequest);
  }, [requests, selected]);
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
    if (window.matchMedia("(max-width: 900px)").matches) {
      setMenuOpen(false);
    }
    clearFeedback();
  };

  const openSearch = (value: string) => {
    setSearch(value);
    setStatusFilter("ALL");
    setActivePage("requests");
    setNotificationsOpen(false);
    setSelected(null);
  };
  const clearRequestSearch = () => {
    setSearch("");
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
          request.payment_stub_code,
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
  const statusFilteredRequests = useMemo(
    () => requests.filter((request) => statusFilter === "ALL" || request.status === statusFilter),
    [requests, statusFilter],
  );
  useEffect(() => {
    if (activePage !== "requests" || !search.trim()) return;
    if (filteredRequests.length === 1) {
      setSelected((current) => current?.id === filteredRequests[0].id ? current : filteredRequests[0]);
    } else {
      setSelected(null);
    }
  }, [activePage, search, filteredRequests]);
  const newRequestsQueue = useMemo(
    () => requests.filter((request) => request.status === "PENDING" && (statusFilter === "ALL" || statusFilter === "PENDING")),
    [requests, statusFilter],
  );
  const paidProcessingQueue = useMemo(() => {
    const paidRequests = requests.filter(
      (request) =>
        request.status === "APPROVED" &&
        request.payment_status === "PAID" &&
        (statusFilter === "ALL" || statusFilter === "APPROVED"),
    );
    return sortPaidProcessingQueue(paidRequests);
  }, [requests, statusFilter]);
  const inProcessingQueue = useMemo(
    () => sortPaidProcessingQueue(
      requests.filter((request) => request.status === "PROCESSING" && (statusFilter === "ALL" || statusFilter === "PROCESSING")),
    ),
    [requests, statusFilter],
  );
  const unclaimedRequests = useMemo(
    () => sortRequestsFIFO(
      requests.filter(
        (request) =>
          request.status === "READY_FOR_PICKUP" && (statusFilter === "ALL" || statusFilter === "READY_FOR_PICKUP"),
      ),
    ),
    [requests, statusFilter],
  );
  const claimCodeSuggestions = useMemo(() => {
    const prefix = claimCode.trim().toUpperCase();
    if (!prefix) return [];
    return unclaimedRequests.filter((request) =>
      String(request.claim_code || "").trim().toUpperCase().startsWith(prefix),
    ).slice(0, 8);
  }, [claimCode, unclaimedRequests]);
  const awaitingPaymentQueue = useMemo(
    () =>
      requests
        .filter(
          (request) =>
            request.status === "APPROVED" &&
            request.payment_status !== "PAID" &&
            (statusFilter === "ALL" || statusFilter === "APPROVED"),
        )
        .sort((a, b) => {
          const getTime = (value: any) => {
            if (!value) return 0;
            if (typeof value.toMillis === "function") return value.toMillis();
            if (typeof value.toDate === "function") return value.toDate().getTime();
            const parsed = new Date(value).getTime();
            return Number.isNaN(parsed) ? 0 : parsed;
          };
          return getTime(a.approved_at || a.created_at) - getTime(b.approved_at || b.created_at);
        }),
    [requests, statusFilter],
  );
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
  const startProcessing = async (request: RequestRecord) => {
    setBusyId(request.id);
    clearFeedback();
    try {
      await startPaidDocumentProcessing(
        request.id,
        request.request_id,
        { id: registrarId, name: registrarName },
      );
      setStatusFilter("ALL");
      const processingRequest = { ...request, status: "PROCESSING" as const };
      setSelected(processingRequest);
      setRescheduleTarget(processingRequest);
      setRescheduleScheduleId(processingRequest.claiming_schedule_id || "");
      setNotice(`${request.request_id} moved to PROCESSING. Assign its pickup schedule to continue.`);
    } catch (processingError) {
      setError(
        `Could not start processing: ${
          processingError instanceof Error
            ? processingError.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  const markReadyForPickup = async (request: RequestRecord) => {
    if (!request.claiming_schedule_id) {
      setError("Assign a claiming schedule before marking this request ready.");
      return;
    }
    setBusyId(request.id);
    clearFeedback();
    try {
      const claimCode = await markDocumentReadyForPickup(
        request.id,
        request.request_id,
        { id: registrarId, name: registrarName },
      );
      setStatusFilter("ALL");
      setSelected({ ...request, status: "READY_FOR_PICKUP", claim_code: claimCode });
      setNotice(`${request.request_id} is ready for claiming. Claim code: ${claimCode}`);
    } catch (readyError) {
      setError(
        `Could not mark request ready: ${
          readyError instanceof Error ? readyError.message : "Unknown error"
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
      const paymentStubCode = await approveDocumentRequest(
        approveTarget.id,
        approveTarget.request_id,
        { id: registrarId, name: registrarName },
      );
      setNotice(
        `${approveTarget.request_id} approved. Payment stub: ${paymentStubCode}`,
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
    if (!rescheduleScheduleId) {
      setError("Choose an available claiming schedule.");
      return;
    }
    setBusyId(rescheduleTarget.id);
    clearFeedback();
    try {
      const assignedSchedule = schedules.find((schedule) => schedule.id === rescheduleScheduleId);
      if (!assignedSchedule) throw new Error("The selected schedule is no longer available.");
      const isReschedule = Boolean(rescheduleTarget.claiming_schedule_id && rescheduleTarget.claiming_schedule_id !== rescheduleScheduleId);
      await assignRequestClaimingSchedule(
        rescheduleTarget.id,
        rescheduleTarget.request_id,
        rescheduleScheduleId,
        { id: registrarId, name: registrarName },
      );
      await notify({
        audience: studentAudience(rescheduleTarget.student_id),
        type: "RESCHEDULED",
        title: isReschedule ? "Document request rescheduled" : "Claiming schedule assigned",
        message: `Your document request ${rescheduleTarget.request_id} has a claiming schedule: ${assignedSchedule.claimDate} (${assignedSchedule.period || assignedSchedule.timeSlot}).`,
        kind: "DOCUMENT",
        relatedId: rescheduleTarget.request_id,
      });
      setNotice(
        `${rescheduleTarget.request_id} was assigned to ${assignedSchedule.claimDate} (${assignedSchedule.period || assignedSchedule.timeSlot}).`,
      );
      setSelected((current) => current?.id === rescheduleTarget.id
        ? {
            ...current,
            requested_date: assignedSchedule.claimDate,
            requested_time: assignedSchedule.period || assignedSchedule.timeSlot,
            claiming_schedule_id: rescheduleScheduleId,
            ...(isReschedule ? {
              previous_requested_date: current.requested_date || undefined,
              previous_requested_time: current.requested_time || undefined,
              reschedule_count: Number(current.reschedule_count || 0) + 1,
            } : {}),
          }
        : current);
      setRescheduleTarget(null);
      setRescheduleScheduleId("");
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

  const copyClaimCode = async (code: string) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(code);
      setNotice("Claim code copied to clipboard.");
      setError("");
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? `${copyError.message} You can select and copy the code manually.`
          : "Could not copy the claim code. You can select and copy it manually.",
      );
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
    const result = requests.find((request) => {
      const storedCode = String(
        request.claim_code || "",
      )
        .trim()
        .toUpperCase();
      return storedCode === code;
    });
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
        )}. It must be READY FOR PICKUP before it can be released.`,
      );
      return;
    }
    setClaimResult(result);
    setNotice(
      `${result.request_id} was verified and is ready for release.`,
    );
  };

  const releaseClaim = async () => {
    if (!claimResult) return;
    if (claimResult.status !== "READY_FOR_PICKUP") {
      setError(
        "This request is not ready for release.",
      );
      return;
    }
    setBusyId(claimResult.id);
    clearFeedback();
    try {
      await updateDoc(
        doc(
          db,
          "document_requests",
          claimResult.id,
        ),
        {
          status: "COMPLETED",
          updated_at: serverTimestamp(),
        },
      );
      setNotice(
        `${claimResult.request_id} was released successfully and marked as completed.`,
      );
      setClaimCode("");
      setClaimResult(null);
    } catch (releaseError) {
      setError(
        `Could not release documents: ${
          releaseError instanceof Error
            ? releaseError.message
            : "Unknown error"
        }`,
      );
    } finally {
      setBusyId("");
    }
  };

  const startEditingSchedule = (
    schedule: ScheduleRecord,
  ) => {
    setEditingScheduleId(schedule.id);
    setScheduleDate(
      schedule.claimDate || "",
    );
    setScheduleTime(
      schedule.period || (String(schedule.timeSlot || "").toUpperCase().includes("PM") ? "PM" : "AM"),
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
      !(scheduleTime === "AM" || scheduleTime === "PM")
    ) {
      setError(
        "Choose a claiming period (AM or PM).",
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
            timeSlot: scheduleTime,
            period: scheduleTime,
            slotCapacity: capacity,
            availableSlot: available,
            availableSlots: available,
            updatedAt: serverTimestamp(),
          },
        );
        await logRegistrarActivity(
          { id: registrarId, name: registrarName },
          "CLAIMING_SCHEDULE_UPDATED",
          `Updated ${scheduleTime} claiming schedule for ${scheduleDate}.`,
          undefined,
          { schedule_id: editingScheduleId, claim_date: scheduleDate, period: scheduleTime, capacity, available_slots: available },
        );
        setNotice(
          "Claiming schedule updated successfully.",
        );
      } else {
        await createClaimingSchedule(
          scheduleDate,
          scheduleTime as "AM" | "PM",
          capacity,
          { id: registrarId, name: registrarName },
        );
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
        "Pickup Date",
        "Pickup Period",
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
      // Make sure the application returns to the login screen
      // even if the parent authentication state does not refresh immediately.
      window.location.reload();
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
          request.payment_status === "PAID" ? (
            <>
              <button
                className="rd-action-button"
                disabled={busyId === request.id}
                onClick={() => startProcessing(request)}
              >
                Start Processing
              </button>
            </>
          ) : (
            <span className="rd-muted">
              Awaiting Cashier payment confirmation
            </span>
          )
        )}
        {status === "PROCESSING" && (
          <>
            <button
              className="rd-action-button secondary"
              disabled={busyId === request.id}
              onClick={() => {
                setRescheduleTarget(request);
                setRescheduleScheduleId(request.claiming_schedule_id || "");
                clearFeedback();
              }}
            >
              {request.claiming_schedule_id ? "Change Pickup Schedule" : "Set Pickup Schedule"}
            </button>
            {request.claiming_schedule_id ? (
              <button
                className="rd-action-button"
                disabled={busyId === request.id}
                onClick={() => markReadyForPickup(request)}
              >
                Mark Ready for Claiming
              </button>
            ) : <span className="rd-muted">Assign a pickup schedule before marking ready.</span>}
          </>
        )}
        {status === "READY_FOR_PICKUP" && (
          <>
            <span className="rd-muted">Awaiting student pickup. Verify the claim code under Claiming &amp; Release.</span>
            <button
              className="rd-action-button secondary"
              disabled={busyId === request.id}
              onClick={() => {
                setRescheduleTarget(request);
                setRescheduleScheduleId(request.claiming_schedule_id || "");
                clearFeedback();
              }}
            >Change Pickup Schedule</button>
          </>
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
    queueAction?: "start" | "ready",
  ) => (
    <div className="rd-table-wrap">
      <table className="rd-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Student ID</th>
            <th>Documents</th>
            <th>Date / Pickup</th>
            <th>Status</th>
            <th>Pay</th>
            {queueAction && <th>Action</th>}
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
                {request.claiming_schedule_id
                  ? `${request.requested_date || "—"}${request.requested_time ? ` · ${request.requested_time}` : ""}`
                  : dateOnly(request.submitted_at || request.created_at)}
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
              <td>
                {request.status === "APPROVED" ? (
                  <span className={`rd-payment-status ${request.payment_status === "PAID" ? "paid" : "unpaid"}`}>
                    {request.payment_status === "PAID" ? "Paid" : "Unpaid"}
                  </span>
                ) : request.payment_status === "PAID" ? (
                  <span className="rd-payment-status paid">Paid</span>
                ) : (
                  <span className="rd-muted">—</span>
                )}
              </td>
              {queueAction && (
                <td>
                  <button
                    type="button"
                    className="rd-action-button"
                    aria-label={queueAction === "start" ? "Start Processing" : request.claiming_schedule_id ? "Mark Ready for Claiming" : "Assign Pickup Schedule"}
                    title={queueAction === "start" ? "Start Processing" : request.claiming_schedule_id ? "Mark Ready for Claiming" : "Assign Pickup Schedule"}
                    disabled={busyId === request.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (queueAction === "start") {
                        void startProcessing(request);
                      } else if (!request.claiming_schedule_id) {
                        setRescheduleTarget(request);
                        setRescheduleScheduleId("");
                        clearFeedback();
                      } else {
                        void markReadyForPickup(request);
                      }
                    }}
                  >
                    {queueAction === "start" ? "Start" : request.claiming_schedule_id ? "Ready" : "Schedule"}
                  </button>
                </td>
              )}
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
      <div className="registrar-identity-card">
        <div className="registrar-identity-copy">
          <h1>Registrar: {registrarName}</h1>
        </div>
        <div className="registrar-identity-colleges">
          {registrarAssignmentLabel}
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
          <h2>Services</h2>
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
      <div className="rd-toolbar rd-request-toolbar">
        <div className="rd-search-control request-search-control">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search request ID, student ID, or document"
            aria-label="Search document requests"
          />
          {search && <button type="button" className="rd-search-clear" onClick={clearRequestSearch} aria-label="Clear request search">×</button>}
        </div>
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
      <div className="rd-request-workspace">
        <div className="rd-request-worklists">
      {search.trim() && filteredRequests.length > 1 && (
        <div className="rd-detail-section request-queue-card rd-search-results-card">
          <div className="rd-search-results-heading">
            <h3>Search Results</h3>
            <span>{filteredRequests.length} matching requests</span>
          </div>
          {requestTable(filteredRequests)}
        </div>
      )}
      {search.trim() && filteredRequests.length === 0 && (
        <div className="rd-detail-section request-queue-card rd-search-results-card rd-search-empty">
          <h3>Search Results</h3>
          <p>No requests match “{search.trim()}”. Clear the search to show all requests.</p>
        </div>
      )}
      <div className="rd-detail-section request-queue-card new-requests-card">
        <div className="rd-search-results-heading">
          <h3>New Requests</h3>
          <span>{newRequestsQueue.length} awaiting review</span>
        </div>
        <p className="rd-muted">New requests from students appear here first. Review and approve or decline each request.</p>
        {newRequestsQueue.length > 0 ? (
          <div className="rd-request-list">{requestTable(newRequestsQueue)}</div>
        ) : (
          <div className="rd-empty">No new requests are waiting for review.</div>
        )}
      </div>
      <div className="rd-detail-section request-queue-card">
        <h3>Awaiting Payment</h3>
        <p className="rd-muted">
          Approved requests remain visible here until the Cashier confirms payment. Students use the Payment Stub Code when paying.
        </p>
        {awaitingPaymentQueue.length > 0 ? (
          <div className="rd-request-list">
            {requestTable(awaitingPaymentQueue)}
          </div>
        ) : (
          <div className="rd-empty">
            No approved requests are currently awaiting payment.
          </div>
        )}
      </div>
      <div className="rd-detail-section request-queue-card">
        <h3>Paid Processing Queue</h3>
        <p className="rd-muted">
          Requests are automatically arranged by the earliest Cashier payment confirmation time. No manual sorting is needed.
        </p>
        {paidProcessingQueue.length > 0 ? (
          <div className="rd-request-list">
            {requestTable(paidProcessingQueue, "start")}
          </div>
        ) : (
          <div className="rd-empty">
            No paid requests are waiting for Registrar processing.
          </div>
        )}
      </div>
      <div className="rd-detail-section request-queue-card">
        <h3>In Processing</h3>
        <p className="rd-muted">
          These paid requests stay here while Registrar staff prepare the documents. Select a request to mark it ready for claiming when preparation is complete.
        </p>
        {inProcessingQueue.length > 0 ? (
          <div className="rd-request-list">
            {requestTable(inProcessingQueue, "ready")}
          </div>
        ) : (
          <div className="rd-empty">No requests are currently being processed.</div>
        )}
      </div>
      <div className="rd-detail-section request-queue-card unclaimed-requests-card">
        <h3>Unclaimed Requests</h3>
        <p className="rd-muted">
          Documents marked ready remain here until staff verifies the student's claim code and releases them.
        </p>
        {unclaimedRequests.length > 0 ? (
          <div className="rd-request-list">
            {requestTable(unclaimedRequests)}
          </div>
        ) : (
          <div className="rd-empty">There are no requests waiting to be claimed.</div>
        )}
      </div>
      <div className="rd-detail-section request-queue-card all-requests-card">
        <h3>All Document Requests</h3>
        <div className="rd-request-list">
          {requestTable(
            statusFilteredRequests,
          )}
        </div>
      </div>
        </div>
        <div key={selected?.id || "request-details-empty"} className={`rd-detail-panel ${selected ? "has-selected-request" : ""}`} aria-live="polite">
          {selected ? (
            <>
              <div className="rd-detail-header">
                <div>
                  <span className="rd-detail-label">REQUEST DETAILS</span>
                  <div className="rd-detail-title-row">
                    <h2>{selected.request_id || selected.id}</h2>
                    <span
                      className={`rd-status ${String(selected.status || "PENDING").toLowerCase()}`}
                    >
                      {statusLabel(selected.status)}
                    </span>
                    {(selected.payment_status === "PAID" || selected.payment_status === "UNPAID" || selected.status === "APPROVED") && (
                      <span className={`rd-payment-status ${selected.payment_status === "PAID" ? "paid" : "unpaid"}`}>
                        {selected.payment_status === "PAID" ? "PAID" : "UNPAID"}
                      </span>
                    )}
                  </div>
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
              <div className="rd-request-detail-cards">
                <section className="rd-detail-section rd-detail-card rd-request-info-card">
                  <h3>Request Information</h3>
                  <div className="rd-detail-grid">
                    <div><span>Student ID</span><strong>{selected.student_id || "—"}</strong></div>
                    <div><span>Request Method</span><strong>{selected.request_method || "—"}</strong></div>
                    <div><span>Date Submitted</span><strong>{dateOnly(selected.submitted_at || selected.created_at)}</strong></div>
                    {selected.claiming_schedule_id && <div><span>Pickup Schedule</span><strong>{selected.requested_date || "—"} · {selected.requested_time || "—"}</strong></div>}
                    <div><span>Number of Copies</span><strong>{selected.number_of_copies ?? "—"}</strong></div>
                  </div>
                  {(selected.payment_stub_code || selected.payment_confirmed_at) && (
                    <div className="rd-request-payment-meta">
                      {selected.payment_stub_code && <span>Payment stub <strong>{selected.payment_stub_code}</strong></span>}
                      {selected.payment_confirmed_at && <span>Payment confirmed {dateText(selected.payment_confirmed_at)}</span>}
                    </div>
                  )}
                </section>

                <section className="rd-detail-section rd-detail-card rd-documents-card">
                  <h3>Requested Documents</h3>
                  {getRequestDocuments(selected).length > 0 ? (
                    <div className="rd-document-lines">
                      <div className="rd-document-line rd-document-line-heading">
                        <span>Document</span><span>Qty</span><span>Price</span>
                      </div>
                      {getRequestDocuments(selected).map((detail) => (
                        <div className="rd-document-line" key={detail.id}>
                          <strong>{documentName(detail)}</strong>
                          <span>{detail.quantity ?? 1}</span>
                          <span>{detail.unit_price != null ? money(detail.unit_price) : detail.subtotal != null ? money(detail.subtotal) : "—"}</span>
                        </div>
                      ))}
                      <div className="rd-document-total">
                        <span>Request Total</span>
                        <strong>{money(selected.total_amount)}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="rd-muted">No separate document details were found for this request.</p>
                  )}
                </section>

                <section className="rd-detail-section rd-detail-card">
                  <h3>Purpose</h3>
                  <p className="rd-detail-purpose">
                    {selected.purpose?.trim() || "No purpose provided."}
                  </p>
                </section>

                {selected.claim_code && (
                  <section className="rd-detail-section rd-detail-card rd-claim-code-card">
                    <h3>Claim Code</h3>
                    <div className="rd-claim-code-copy-row">
                      <code className="claim-code-display">{selected.claim_code}</code>
                      <button
                        type="button"
                        className="rd-copy-button"
                        aria-label="Copy claim code"
                        onClick={() => void copyClaimCode(selected.claim_code || "")}
                      >
                        Copy
                      </button>
                    </div>
                  </section>
                )}

                {(selected.rescheduled_at || Number(selected.reschedule_count || 0) > 0) && (
                  <section className="rd-detail-section rd-detail-card rd-reschedule-card">
                    <h3>Rescheduling Information</h3>
                    <div className="rd-detail-grid">
                      <div><span>Previous Pickup Date</span><strong>{selected.previous_requested_date || "—"}</strong></div>
                      <div><span>Previous Pickup Period</span><strong>{selected.previous_requested_time || "—"}</strong></div>
                      <div><span>Reschedule Count</span><strong>{selected.reschedule_count ?? 0}</strong></div>
                      <div><span>Rescheduled At</span><strong>{selected.rescheduled_at ? dateText(selected.rescheduled_at) : "—"}</strong></div>
                    </div>
                  </section>
                )}

                {(selected.decline_reason || selected.cancellation_reason) && (
                  <section className="rd-detail-section rd-detail-card rd-reason-card">
                    <h3>{selected.decline_reason ? "Decline Reason" : "Cancellation Reason"}</h3>
                    <p className="cancellation-detail">
                      {selected.decline_reason || selected.cancellation_reason}
                    </p>
                  </section>
                )}
              </div>
              <div className="rd-detail-actions-footer">
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
              id="registrar-claim-code"
              name="registrar-claim-code"
              type="text"
              value={claimCode}
              onChange={(event) => {
                setClaimCode(
                  event.target.value
                    .replace(/\s/g, "")
                    .toUpperCase(),
                );
                setClaimResult(null);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  verifyClaim();
                }
              }}
              placeholder="Enter claim code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Claim code"
            />
            <button
              type="button"
              className="primary-button"
              disabled={!claimCode.trim()}
              onClick={verifyClaim}
            >
              Verify
            </button>
          </div>
          {claimCode.trim() && (
            <div className="claim-code-suggestions" role="listbox" aria-label="Unreleased request claim codes">
              {claimCodeSuggestions.length > 0 ? (
                claimCodeSuggestions.map((request) => (
                  <button
                    type="button"
                    className="claim-code-suggestion"
                    key={request.id}
                    onClick={() => {
                      setClaimCode(String(request.claim_code || "").toUpperCase());
                      setClaimResult(null);
                      clearFeedback();
                    }}
                  >
                    <span className="claim-code-suggestion-code">{request.claim_code}</span>
                    <span className="claim-code-suggestion-meta">
                      {request.request_id} · Student {request.student_id || "—"}
                    </span>
                  </button>
                ))
              ) : (
                <div className="claim-code-no-match">
                  No unreleased requests match this code prefix.
                </div>
              )}
            </div>
          )}
          <p className="claim-code-helper">
            Type the first few characters to find an unclaimed request, select its code, then verify it.
          </p>
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
                    Pickup Date
                  </span>
                  <strong>
                    {claimResult.requested_date ||
                      "—"}
                  </strong>
                </div>
                <div>
                  <span>
                    Pickup Period
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
                Set the claiming date, AM/PM period, and maximum number of students.
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
                Claiming Period
              </span>
              <select
                value={scheduleTime}
                onChange={(event) =>
                  setScheduleTime(event.target.value)
                }
              >
                <option value="">Choose period</option>
                <option value="AM">Morning (AM)</option>
                <option value="PM">Afternoon (PM)</option>
              </select>
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
                          {schedule.period || schedule.timeSlot ||
                            "No claiming period"}
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
        "Assign or change a Registrar-managed pickup slot for requests being processed or ready for pickup.",
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
                ["PROCESSING", "READY_FOR_PICKUP"].includes(request.status || ""),
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
                    Current pickup schedule:{" "}
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
                    setRescheduleScheduleId(request.claiming_schedule_id || "");
                    clearFeedback();
                  }}
                >
                  Reschedule
                </button>
              </div>
            ))}
          {filteredRequests.filter((request) => ["PROCESSING", "READY_FOR_PICKUP"].includes(request.status || "")).length === 0 && (
            <div className="rd-empty">
              No requests are currently being processed or awaiting pickup.
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
  const renderSettings = () => (
    <section className="registrar-page">
      {heading("Settings", "Registrar account information.")}
      <div className="registrar-settings-grid">
        <section className="registrar-settings-card">
          <div className="registrar-settings-heading">
            <h2>Account information</h2>
            <p>Details used to identify your Registrar account.</p>
          </div>
          <div className="registrar-settings-rows">
            <div className="settings-row">
              <span>Name</span>
              <strong>{registrarName}</strong>
            </div>
            <div className="settings-row">
              <span>Role</span>
              <strong>{account.position || "Registrar Staff"}</strong>
            </div>
            <div className="settings-row">
              <span>Employee ID</span>
              <strong>{account.employeeId || "Not provided"}</strong>
            </div>
            <div className="settings-row">
              <span>Email</span>
              <strong>{account.email || "Not provided"}</strong>
            </div>
            <div className="settings-row">
              <span>Campus</span>
              <strong>{account.campus || "Not provided"}</strong>
            </div>
            <div className="settings-row">
              <span>Assigned college(s)</span>
              <strong>{registrarAssignmentLabel}</strong>
            </div>
            <div className="settings-row">
              <span>Account status</span>
              <strong className="settings-status">
                {(account.status || "active").replace(/_/g, " ")}
              </strong>
            </div>
          </div>
        </section>

        <section className="registrar-settings-card registrar-session-card">
          <div className="registrar-settings-heading">
            <h2>Account session</h2>
            <p>Sign out when you finish using this workstation.</p>
          </div>
          <button className="logout-button settings-logout" onClick={handleLogout}>
            Log Out
          </button>
        </section>
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
          <button
            className="menu-close-button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
            title="Close menu"
          >
            ×
          </button>
        </div>
        <nav className="registrar-nav" id="registrar-navigation">
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
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-controls="registrar-navigation"
              aria-expanded={menuOpen}
            >
              ☰
            </button>
            {activePage === "overview" && (
              <h3>{PAGE_TITLES.overview}</h3>
            )}
          </div>
          <div className="registrar-topbar-actions">
            <div className="registrar-top-search">
              <input
                value={search}
                onChange={(event) =>
                  openSearch(
                    event.target.value,
                  )
                }
                placeholder="Search requests..."
                aria-label="Search document requests"
              />
              {search && <button type="button" className="top-search-clear" onClick={clearRequestSearch} aria-label="Clear request search">×</button>}
            </div>
            <div className="registrar-notification-wrap">
              <button
                className="registrar-icon-button"
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setNewRequestToast(null);
                  if (requestToastTimerRef.current) clearTimeout(requestToastTimerRef.current);
                }}
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
                            setStatusFilter("ALL");
                            setSearch("");
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
              {newRequestToast && (
                <div className="registrar-request-toast" role="status" aria-live="polite">
                  <div className="registrar-request-toast-mark" aria-hidden="true">!</div>
                  <div className="registrar-request-toast-copy">
                    <strong>
                      {newRequestToast.count} new request{newRequestToast.count === 1 ? "" : "s"} {newRequestToast.type === "login" ? "waiting for review" : "received"}
                    </strong>
                    <span>Open Document Requests to review {newRequestToast.count === 1 ? "it" : "them"}.</span>
                    <button
                      type="button"
                      className="registrar-request-toast-link"
                      onClick={() => {
                        setActivePage("requests");
                        setStatusFilter("PENDING");
                        setSearch("");
                        setSelected(null);
                        setNotificationsOpen(false);
                        setNewRequestToast(null);
                        if (requestToastTimerRef.current) clearTimeout(requestToastTimerRef.current);
                        if (window.matchMedia("(max-width: 900px)").matches) setMenuOpen(false);
                      }}
                    >
                      View new requests <span aria-hidden="true">→</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="registrar-request-toast-close"
                    onClick={() => {
                      setNewRequestToast(null);
                      if (requestToastTimerRef.current) clearTimeout(requestToastTimerRef.current);
                    }}
                    aria-label="Dismiss new request notification"
                  >×</button>
                </div>
              )}
            </div>
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
                <span>Date Submitted</span>
                <strong>
                  {dateOnly(approveTarget.submitted_at || approveTarget.created_at)}
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
              before approving it. After approval, the student pays the Cashier. Registrar Staff can start processing after payment is confirmed.
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
                  {rescheduleTarget.claiming_schedule_id ? "CHANGE PICKUP SCHEDULE" : "ASSIGN PICKUP SCHEDULE"}
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
            <p>Choose one of the claiming dates and periods created by Registrar Staff. One available place will be reserved for this request.</p>
            <div className="modal-form-grid">
              <label className="rd-schedule-choice-label">
                <span>Student pickup date and period</span>
                <select value={rescheduleScheduleId} onChange={(event) => setRescheduleScheduleId(event.target.value)}>
                  <option value="">Choose a schedule</option>
                  {schedules
                    .filter((schedule) => Number(schedule.availableSlots ?? schedule.availableSlot ?? schedule.slotCapacity ?? 0) > 0 || schedule.id === rescheduleTarget.claiming_schedule_id)
                    .map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.claimDate} · {schedule.period || schedule.timeSlot} · {Number(schedule.availableSlots ?? schedule.availableSlot ?? schedule.slotCapacity ?? 0)} available
                      </option>
                    ))}
                </select>
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
                  Save Pickup Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
