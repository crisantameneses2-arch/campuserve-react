
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../../../firebase";
import "./RegistrarDashboard.css";

type Account = { email?: string; name?: string; role?: string };
interface RegistrarDashboardProps { account: Account }
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
  created_at?: any;
  status: Status;
  claim_code?: string | null;
  updated_at?: any;
};

type DetailRecord = {
  id: string;
  document_type?: string;
  custom_document_name?: string | null;
  quantity?: number;
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

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  requests: "Document Requests",
  claiming: "Claiming & Release",
  schedule: "Claiming Schedule",
  reschedule: "Cancellation & Rescheduling",
  summary: "Daily Preparation Summary",
  history: "Transaction History",
  reports: "Reports",
  messages: "Messages",
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

const money = (value?: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dateText = (value: any) => {
  if (!value) return "—";
  const date =
    typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const today = () => new Date().toLocaleDateString("en-CA");

export default function RegistrarDashboard({
  account,
}: RegistrarDashboardProps) {
  const [activePage, setActivePage] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<RequestRecord | null>(null);
  const [details, setDetails] = useState<DetailRecord[]>([]);
  const [claimCode, setClaimCode] = useState("");
  const [claimResult, setClaimResult] = useState<RequestRecord | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "document_requests"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() } as RequestRecord),
        );
        rows.sort((a, b) => {
          const aTime = a.created_at?.toMillis?.() ?? 0;
          const bTime = b.created_at?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setRequests(rows);
        setLoading(false);
        setError("");
      },
      (err) => {
        setError(`Could not load document requests: ${err.message}`);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "claimingSchedules"),
      (snapshot) => {
        setSchedules(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as ScheduleRecord,
          ),
        );
      },
      (err) => setError(`Could not load claiming schedules: ${err.message}`),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      if (!selected) {
        setDetails([]);
        return;
      }
      try {
        const q = query(
          collection(db, "document_request_details"),
          where("request_id", "==", selected.request_id),
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setDetails(
            snap.docs.map(
              (item) => ({ id: item.id, ...item.data() }) as DetailRecord,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            `Could not load request details: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          );
        }
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const changePage = (page: string) => {
    setActivePage(page);
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSelected(null);
    setNotice("");
    setError("");
  };

  const openSearch = (value: string) => {
    setTopSearch(value);
    setSearch(value);
    setStatusFilter("ALL");
    setActivePage("requests");
    setNotificationsOpen(false);
    setMenuOpen(false);
  };

const updateStatus = async (
  request: RequestRecord,
  status: Status,
) => {
  if (!request.request_id) {
    setError("This request is missing its request ID.");
    return;
  }

  setBusyId(request.id);
  setError("");
  setNotice("");

  try {
    const updates: Record<string, any> = {
      status,
      updated_at: serverTimestamp(),
    };

    // Generate a claim code when the request
    // becomes ready for pickup.
    if (
      status === "READY_FOR_PICKUP" &&
      !request.claim_code
    ) {
      const generatedClaimCode =
        Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();

      updates.claim_code = generatedClaimCode;
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

    if (selected?.id === request.id) {
      setSelected({
        ...request,
        ...updates,
        status,
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

  const filteredRequests = useMemo(
    () =>
      requests.filter((r) => {
        const term = search.trim().toLowerCase();
        const matches =
          !term ||
          [
            r.request_id,
            r.student_id,
            r.purpose,
            r.status,
            r.claim_code,
          ].some((v) => String(v || "").toLowerCase().includes(term));
        return matches && (statusFilter === "ALL" || r.status === statusFilter);
      }),
    [requests, search, statusFilter],
  );

  const count = (status: Status) =>
    requests.filter((r) => r.status === status).length;

  const completedToday = requests.filter(
    (r) =>
      r.status === "COMPLETED" &&
      (r.updated_at?.toDate?.()
        ? r.updated_at.toDate().toLocaleDateString("en-CA")
        : "") === today(),
  ).length;

  const notifications = requests
    .filter((r) => ["PENDING", "READY_FOR_PICKUP"].includes(r.status))
    .slice(0, 8);

  const navItems = Object.entries(PAGE_TITLES);

  const heading = (title: string, description: string) => (
    <div className="page-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );

  const requestTable = (rows: RequestRecord[]) => (
    <div className="rd-table-wrap">
      <table className="rd-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Student ID</th>
            <th>Purpose</th>
            <th>Date Requested</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.request_id || r.id}</td>
              <td>{r.student_id || "—"}</td>
              <td>{r.purpose || "—"}</td>
              <td>{r.requested_date || dateText(r.created_at)}</td>
              <td>{money(r.total_amount)}</td>
              <td>
                <span className={`rd-status ${(r.status || "PENDING").toLowerCase()}`}>
                  {(r.status || "PENDING").replace(/_/g, " ")}
                </span>
              </td>
              <td>
                <button
                  className="rd-small-button"
                  onClick={() => setSelected(r)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="rd-empty">
          {loading ? "Loading requests..." : "No matching document requests found."}
        </p>
      )}
    </div>
  );

  const requestActions = (r: RequestRecord) => (
    <div className="rd-actions">
      {r.status === "PENDING" && (
        <>
          <button
            disabled={busyId === r.id}
            onClick={() => updateStatus(r, "APPROVED")}
          >
            Approve
          </button>
          <button
            className="danger"
            disabled={busyId === r.id}
            onClick={() => updateStatus(r, "DECLINED")}
          >
            Decline
          </button>
        </>
      )}
      {r.status === "APPROVED" && (
        <button
          disabled={busyId === r.id}
          onClick={() => updateStatus(r, "PROCESSING")}
        >
          Start Processing
        </button>
      )}
      {r.status === "PROCESSING" && (
        <button
          disabled={busyId === r.id}
          onClick={() => updateStatus(r, "READY_FOR_PICKUP")}
        >
          Mark Ready
        </button>
      )}
      {r.status === "READY_FOR_PICKUP" && (
        <button
          disabled={busyId === r.id}
          onClick={() => updateStatus(r, "COMPLETED")}
        >
          Mark Completed
        </button>
      )}
      {!["COMPLETED", "DECLINED", "CANCELLED"].includes(r.status) && (
        <button
          className="danger"
          disabled={busyId === r.id}
          onClick={() => updateStatus(r, "CANCELLED")}
        >
          Cancel
        </button>
      )}
    </div>
  );

  const renderPage = () => {
    if (activePage === "overview") {
      return (
        <section className="registrar-page">
          <div className="welcome-section">
            <p className="eyebrow">CAMPUSERVE</p>
            <h1>Registrar Dashboard</h1>
            <p className="welcome-text">
              Welcome, {account.name || "Registrar Staff"}
            </p>
          </div>
          <div className="overview-header">
            <h2>Overview</h2>
            <p>Manage student document requests and claiming schedules.</p>
          </div>
          <div className="stats-grid">
            {[
              ["Pending Requests", count("PENDING"), "Awaiting review"],
              [
                "Processing",
                count("PROCESSING") + count("APPROVED"),
                "Documents being prepared",
              ],
              [
                "Ready for Claiming",
                count("READY_FOR_PICKUP"),
                "Ready for student pickup",
              ],
              ["Completed Today", completedToday, "Documents released today"],
            ].map(([label, value, sub]) => (
              <div className="stat-card" key={String(label)}>
                <div className="stat-card-top">
                  <span>{label}</span>
                  <span className="stat-label">LIVE</span>
                </div>
                <strong>{value}</strong>
                <p>{sub}</p>
              </div>
            ))}
          </div>
          <div className="services-heading">
            <h2>Registrar Services</h2>
            <p>
              Select a service to manage document processing and student
              transactions.
            </p>
          </div>
          <div className="services-grid">
            {navItems
              .filter(([key]) => key !== "overview")
              .map(([key, title]) => (
                <button
                  className="service-card"
                  key={key}
                  onClick={() => changePage(key)}
                >
                  <span className="service-content">
                    <strong>{title}</strong>
                    <small>
                      {
                        ({
                          requests: "Review and update student document requests.",
                          claiming: "Verify claim codes and release ready documents.",
                          schedule: "View available claiming schedules.",
                          reschedule: "Manage request cancellation and rescheduling.",
                          summary: "Review today's request preparation activity.",
                          history: "Review completed and previous transactions.",
                          reports: "View request status totals.",
                          messages: "Open the student messaging workspace.",
                        } as Record<string, string>)[key]
                      }
                    </small>
                  </span>
                  <span className="service-arrow">→</span>
                </button>
              ))}
          </div>
        </section>
      );
    }

    if (activePage === "requests") {
      return (
        <section className="registrar-page">
          {heading(
            "Document Requests",
            "Review student requests and update their processing status.",
          )}
          <div className="rd-toolbar">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request ID, student ID, or purpose"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          {requestTable(filteredRequests)}
        </section>
      );
    }

    if (activePage === "claiming") {
      return (
        <section className="registrar-page">
          {heading(
            "Claiming & Release",
            "Find a ready document request using its claim code.",
          )}
          <div className="rd-panel">
            <label htmlFor="claim-code">Claim code</label>
            <div className="rd-toolbar">
              <input
                id="claim-code"
                value={claimCode}
                onChange={(e) => {
                  setClaimCode(e.target.value.toUpperCase());
                  setClaimResult(null);
                }}
                placeholder="Enter claim code"
              />
              <button
                className="primary-button"
                onClick={() => {
                  const found = requests.find(
                    (r) => r.claim_code?.toUpperCase() === claimCode.trim(),
                  );
                  setClaimResult(found || null);
                  setError(
                    found ? "" : "No request found for that claim code.",
                  );
                }}
              >
                Verify Code
              </button>
            </div>
            {claimResult && (
              <div className="rd-detail">
                <h3>{claimResult.request_id}</h3>
                <p>Student ID: {claimResult.student_id}</p>
                <p>Purpose: {claimResult.purpose || "—"}</p>
                <p>Status: {claimResult.status.replace(/_/g, " ")}</p>
                {claimResult.status === "READY_FOR_PICKUP" ? (
                  <button
                    className="primary-button"
                    disabled={busyId === claimResult.id}
                    onClick={() => updateStatus(claimResult, "COMPLETED")}
                  >
                    Confirm Release
                  </button>
                ) : (
                  <p>This request is not currently marked ready for pickup.</p>
                )}
              </div>
            )}
          </div>
          {requestTable(
            requests.filter((r) => r.status === "READY_FOR_PICKUP"),
          )}
        </section>
      );
    }

    if (activePage === "schedule") {
      return (
        <section className="registrar-page">
          {heading(
            "Claiming Schedule",
            "Schedules currently saved in the claimingSchedules collection.",
          )}
          <div className="rd-table-wrap">
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Claim Date</th>
                  <th>Time Slot</th>
                  <th>Capacity</th>
                  <th>Available Slots</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td>{s.claimDate || "—"}</td>
                    <td>{s.timeSlot || "—"}</td>
                    <td>{s.slotCapacity ?? "—"}</td>
                    <td>{s.availableSlot ?? s.availableSlots ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!schedules.length && (
              <p className="rd-empty">No claiming schedules found.</p>
            )}
          </div>
        </section>
      );
    }

    if (activePage === "reschedule") {
      return (
        <section className="registrar-page">
          {heading(
            "Cancellation & Rescheduling",
            "Review requests that have been cancelled or rescheduled, or update an active request.",
          )}
          <div className="rd-toolbar">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request ID or student ID"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          {requestTable(
            filteredRequests.filter((r) =>
              [
                "RESCHEDULED",
                "CANCELLED",
                "PENDING",
                "APPROVED",
                "PROCESSING",
                "READY_FOR_PICKUP",
              ].includes(r.status),
            ),
          )}
        </section>
      );
    }

    if (activePage === "summary" || activePage === "reports") {
      return (
        <section className="registrar-page">
          {heading(
            activePage === "summary"
              ? "Daily Preparation Summary"
              : "Reports",
            "Counts are based on the live document_requests records in Firestore.",
          )}
          <div className="stats-grid">
            {STATUSES.map((s) => (
              <div className="stat-card" key={s}>
                <div className="stat-card-top">
                  <span>{s.replace(/_/g, " ")}</span>
                  <span className="stat-label">TOTAL</span>
                </div>
                <strong>{count(s)}</strong>
                <p>Document requests</p>
              </div>
            ))}
          </div>
          <div className="rd-panel">
            <h3>Request totals</h3>
            <p>
              Total recorded requests: <strong>{requests.length}</strong>
            </p>
            <p>
              Completed today: <strong>{completedToday}</strong>
            </p>
            <button
              className="primary-button"
              onClick={() => {
                const csv = [
                  "Request ID,Student ID,Purpose,Requested Date,Status,Amount",
                  ...requests.map((r) =>
                    [
                      r.request_id,
                      r.student_id,
                      r.purpose,
                      r.requested_date,
                      r.status,
                      r.total_amount,
                    ]
                      .map(
                        (v) =>
                          `"${String(v ?? "").replace(/"/g, '""')}"`,
                      )
                      .join(","),
                  ),
                ].join("\n");
                const blob = new Blob([csv], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "campuserve-registrar-report.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </button>
          </div>
        </section>
      );
    }

    if (activePage === "history") {
      return (
        <section className="registrar-page">
          {heading(
            "Transaction History",
            "Completed, declined, and cancelled document requests.",
          )}
          {requestTable(
            requests.filter((r) =>
              ["COMPLETED", "DECLINED", "CANCELLED"].includes(r.status),
            ),
          )}
        </section>
      );
    }

    return (
      <section className="registrar-page">
        {heading(
          "Messages",
          "Messaging is being handled by your groupmate. This page is kept as the integration point.",
        )}
        <div className="empty-state">
          <div className="empty-state-icon">MS</div>
          <h3>Messages</h3>
          <p>
            The messaging feature will appear here once your groupmate's
            messaging component is integrated.
          </p>
        </div>
      </section>
    );
  };

  return (
    <div className="registrar-layout">
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`registrar-menu ${menuOpen ? "open" : ""}`}>
        <div className="menu-header">
          <div className="menu-brand">
            <div className="brand-mark">C</div>
            <div>
              <strong>CampuServe</strong>
              <span>Registrar Staff</span>
            </div>
          </div>
          <button
            className="close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="registrar-nav">
          {navItems.map(([key, title]) => (
            <button
              key={key}
              className={`nav-item ${activePage === key ? "active" : ""}`}
              onClick={() => changePage(key)}
            >
              {title}
            </button>
          ))}
        </nav>

        <div className="menu-bottom">
          <div className="staff-profile">
            <div className="staff-avatar">
              {(account.name || "R").charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{account.name || "Registrar Staff"}</strong>
              <span>{account.email || "Registrar Account"}</span>
            </div>
          </div>
          <button
            className="logout-button"
            onClick={async () => {
              try {
                await signOut(auth);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Unable to log out.",
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
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <span className="topbar-label">REGISTRAR PORTAL</span>
              <h3>{PAGE_TITLES[activePage]}</h3>
            </div>
          </div>

          <div className="registrar-topbar-actions">
            <div className="registrar-top-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={topSearch}
                onChange={(e) => openSearch(e.target.value)}
                onFocus={() => {
                  if (topSearch.trim()) openSearch(topSearch);
                }}
                placeholder="Search requests..."
                aria-label="Search document requests"
              />
            </div>

            <div className="registrar-notification-wrap">
              <button
                className="registrar-icon-button"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                title="Notifications"
              >
                <span aria-hidden="true">🔔</span>
                {notifications.length > 0 && (
                  <span className="registrar-notification-count">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <button
                    className="registrar-popover-dismiss"
                    aria-label="Close notifications"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="registrar-notifications-panel">
                    <div className="registrar-notifications-heading">
                      <strong>Notifications</strong>
                      <button onClick={() => setNotificationsOpen(false)}>
                        ×
                      </button>
                    </div>

                    {notifications.length === 0 ? (
                      <p className="registrar-notifications-empty">
                        No new request updates.
                      </p>
                    ) : (
                      notifications.map((r) => (
                        <button
                          className="registrar-notification-item"
                          key={r.id}
                          onClick={() => {
                            setSelected(r);
                            setActivePage("requests");
                            setSearch("");
                            setStatusFilter("ALL");
                            setNotificationsOpen(false);
                          }}
                        >
                          <span
                            className={`rd-status ${r.status.toLowerCase()}`}
                          >
                            {r.status.replace(/_/g, " ")}
                          </span>
                          <strong>{r.request_id || r.id}</strong>
                          <small>
                            Student: {r.student_id || "Unknown student"}
                          </small>
                          <small>
                            {r.status === "PENDING"
                              ? "A document request is awaiting review."
                              : "A document is ready for pickup."}
                          </small>
                        </button>
                      ))
                    )}

                    <button
                      className="registrar-view-requests"
                      onClick={() => changePage("requests")}
                    >
                      View all requests
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              className="registrar-icon-button registrar-message-button"
              onClick={() => changePage("messages")}
              aria-label="Messages"
              title="Messages"
            >
              <span aria-hidden="true">✉</span>
            </button>

            <div className="topbar-account">
              {account.name || "Registrar Staff"}
            </div>
          </div>
        </header>

        {error && <div className="rd-alert error">{error}</div>}
        {notice && <div className="rd-alert success">{notice}</div>}
        {renderPage()}
      </main>

      {selected && (
        <div
          className="rd-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <section className="rd-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="rd-modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close details"
            >
              ×
            </button>
            <h2>Request Details</h2>
            <p>
              <strong>Request ID:</strong> {selected.request_id}
            </p>
            <p>
              <strong>Student ID:</strong> {selected.student_id}
            </p>
            <p>
              <strong>Request Method:</strong>{" "}
              {selected.request_method || "—"}
            </p>
            <p>
              <strong>Purpose:</strong> {selected.purpose || "—"}
            </p>
            <p>
              <strong>Requested Date:</strong>{" "}
              {selected.requested_date || "—"}
            </p>
            <p>
              <strong>Requested Time:</strong>{" "}
              {selected.requested_time || "—"}
            </p>
            <p>
              <strong>Copies:</strong>{" "}
              {selected.number_of_copies ?? "—"}
            </p>
            <p>
              <strong>Total:</strong> {money(selected.total_amount)}
            </p>
            <p>
              <strong>Created:</strong> {dateText(selected.created_at)}
            </p>
            <h3>Requested Documents</h3>
            {details.length ? (
              details.map((d) => (
                <p key={d.id}>
                  {d.custom_document_name || d.document_type || "Document"} —
                  Qty: {d.quantity ?? "—"} — {money(d.subtotal ?? 0)}
                </p>
              ))
            ) : (
              <p>No document detail records found.</p>
            )}
            <p>
              <strong>Current Status:</strong>{" "}
              {selected.status.replace(/_/g, " ")}
            </p>
            {requestActions(selected)}
          </section>
        </div>
      )}
    </div>
  );
}