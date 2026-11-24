import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../../firebase";

import ItemStocks from "../../pages/student/ItemStocks";
import ItemReservation from "../../pages/student/ItemReservation";
import DocumentRequestWizard from "../../pages/student/DocumentRequestWizard";
import DocumentRequestList from "../../pages/student/DocumentRequestList";
import ClaimStubPage from "../../pages/student/ClaimStubPage";
import HelpCenter from "../../pages/student/HelpCenter";
import ContactSupport from "../../pages/student/ContactSupport";
import MessagesPanel from "../../components/messaging/MessagesPanel";
import DigitalReceipt, {
  type ReceiptData,
} from "../../components/receipt/DigitalReceipt";
import { useStudentUnreadMessages } from "../../components/messaging/useUnreadMessages";


import { useNotifications } from "../../hooks/useNotifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
  studentAudience,
  ALL_STUDENTS_AUDIENCE,
  type AppNotification,
} from "../../services/notifications";

import {
  subscribeToGroupInvites,
  type GroupInvite,
} from "../../services/groupRequests";

import {
  formatClaimDate,
  formatClaimTime,
  normalizeStatus,
  timeAgo,
  toDate,
} from "../../utils/format";

import "./StudentDashboard.css";
import "./StudentDashboardTheme.css";
import { logout } from "../../services/logout";
import AccountSettings from "../../pages/student/AccountSettings";
import MyProfile from "../../pages/student/MyProfile";

type StudentDashboardProps = {
  account: {
    name?: string;
    email?: string;
    student_id?: string;
  };
};

type DashboardPage =
  | "dashboard"
  | "request"
  | "requests"
  | "itemReservation"
  | "claimStub"
  | "transactions"
  | "notifications"
  | "messages"
  | "help"
  | "contact"
  | "profile"
  | "settings";
export type StudentTransaction = {
  key: string;
  id: string;
  kind: "DOCUMENT" | "ITEM";
  title: string;
  status: string;
  payment_status: string;
  date: string;
  time: string;
  claimCode: string;
  createdAt: unknown;
  details: Record<string, any>;
};

const ACTIVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "RESCHEDULED",
];

const TRACKING_STEPS = [
  "UNPAID",
  "PENDING",
  "PAID",
  "APPROVED",
  "CLAIMED",
];

export default function StudentDashboard({
  account,
}: StudentDashboardProps) {
  const studentId =
    account.student_id ||
    account.email?.split("@")[0].replace("dummytest", "") ||
    "";

  const studentName = account.name || account.email || "Student";

  const [activePage, setActivePage] =
    useState<DashboardPage>("dashboard");
  const [selectedDraftRequestId, setSelectedDraftRequestId] =
    useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [stocksOpen, setStocksOpen] = useState(false);

  const [documentTransactions, setDocumentTransactions] =
    useState<StudentTransaction[]>([]);

  const [itemTransactions, setItemTransactions] =
    useState<StudentTransaction[]>([]);

  const [documentsLoading, setDocumentsLoading] =
    useState(Boolean(studentId));

  const [itemsLoading, setItemsLoading] =
    useState(Boolean(studentId));

  const [selectedTransaction, setSelectedTransaction] =
    useState<StudentTransaction | null>(null);

  /* =========================================
     DOCUMENT REQUESTS
  ========================================= */

  useEffect(() => {
    if (!studentId) {
      setDocumentTransactions([]);
      setDocumentsLoading(false);
      return;
    }

    setDocumentsLoading(true);

    const requestsQuery = query(
      collection(db, "document_requests"),
      where("student_id", "==", studentId)
    );

    return onSnapshot(
      requestsQuery,
      (snapshot) => {
        setDocumentTransactions(
          snapshot.docs.map((document) => {
            const data = document.data();

            return {
              key: `DOCUMENT-${document.id}`,
              id: String(data.request_id || document.id),
              kind: "DOCUMENT",
              title: String(data.purpose || "Document Request"),
              status: String(data.status || "PENDING"),
              payment_status: String(data.payment_status || ""),

              claimCode: String(data.claim_code || ""),
              date: String(data.requested_date || ""),
              time: String(data.requested_time || ""),
              createdAt: data.created_at,

              details: data,
            };
          })
        );

        setDocumentsLoading(false);
      },
      (error) => {
        console.warn("Could not load document transactions:", error);
        setDocumentTransactions([]);
        setDocumentsLoading(false);
      }
    );
  }, [studentId]);

  /* =========================================
     ITEM RESERVATIONS
  ========================================= */

  useEffect(() => {
    if (!studentId) {
      setItemTransactions([]);
      setItemsLoading(false);
      return;
    }

    setItemsLoading(true);

    const reservationsQuery = query(
      collection(db, "itemReservations"),
      where("studentId", "==", studentId)
    );

    return onSnapshot(
      reservationsQuery,
      (snapshot) => {
        setItemTransactions(
          snapshot.docs.map((document) => {
            const data = document.data();

            return {
              key: `ITEM-${document.id}`,
              id: String(data.reservationId || document.id),
              kind: "ITEM",

              title:
                Array.isArray(data.items) && data.items.length > 0
                  ? data.items
                    .map((item: any) => item.itemName)
                    .join(", ")
                  : "Item Reservation",

              status: String(data.status || "PENDING"),
              payment_status: String(data.payment_status || ""),
              claimCode: String(data.claimStubId || ""),
              date: String(data.pickupDate || ""),
              time: String(data.pickupTime || ""),
              createdAt: data.createdAt,

              details: data,
            };
          })
        );

        setItemsLoading(false);
      },
      (error) => {
        console.warn("Could not load item transactions:", error);
        setItemTransactions([]);
        setItemsLoading(false);
      }
    );
  }, [studentId]);

  /* =========================================
     COMBINED TRANSACTIONS
  ========================================= */

  const transactions = useMemo(
    () =>
      [...documentTransactions, ...itemTransactions].sort(
        (a, b) => getTime(b.createdAt) - getTime(a.createdAt)
      ),
    [documentTransactions, itemTransactions]
  );

  const transactionsLoading =
    documentsLoading || itemsLoading;

  /* =========================================
     DIGITAL RECEIPTS
     Opens by itself the first time the student sees a payment the
     Cashier confirmed in the last 7 days; can be reopened from the
     transaction details.
  ========================================= */

  const [receiptTransaction, setReceiptTransaction] =
    useState<StudentTransaction | null>(null);

  const receiptSeenKey = `campuserve-receipts-seen-${studentId}`;

  useEffect(() => {
    if (!studentId || transactionsLoading || receiptTransaction) return;

    let seen: string[] = [];

    try {
      seen = JSON.parse(localStorage.getItem(receiptSeenKey) || "[]");
    } catch {
      seen = [];
    }

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const fresh = transactions
      .filter(
        (transaction) =>
          isPaidTransaction(transaction) &&
          !seen.includes(transaction.key) &&
          getTime(transaction.details?.payment_confirmed_at) > weekAgo
      )
      .sort(
        (a, b) =>
          getTime(b.details?.payment_confirmed_at) -
          getTime(a.details?.payment_confirmed_at)
      );

    if (fresh.length > 0) setReceiptTransaction(fresh[0]);
  }, [studentId, transactions, transactionsLoading, receiptTransaction, receiptSeenKey]);

  function closeReceipt() {
    if (receiptTransaction) {
      try {
        const seen: string[] = JSON.parse(
          localStorage.getItem(receiptSeenKey) || "[]"
        );

        if (!seen.includes(receiptTransaction.key)) {
          localStorage.setItem(
            receiptSeenKey,
            JSON.stringify([...seen, receiptTransaction.key].slice(-200))
          );
        }
      } catch {
        // Storage unavailable: the receipt may show again next visit.
      }
    }

    setReceiptTransaction(null);
  }

  const activeTransactions = useMemo(
    () =>
      transactions.filter((transaction) =>
        ACTIVE_STATUSES.includes(
          normalizeStatus(transaction.status)
        )
      ),
    [transactions]
  );

  /* =========================================
     LIVE TRACKING TRANSACTIONS
  ========================================= */

  const trackingTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const status = normalizeStatus(transaction.status);

        return (
          Boolean(status) &&
          status !== "CLAIMED" &&
          status !== "COMPLETED"
        );
      }),
    [transactions]
  );
  // Separate live tracking transactions by type
  const documentTrackingTransactions = useMemo(
    () =>
      trackingTransactions.filter(
        (transaction) => transaction.kind === "DOCUMENT"
      ),
    [trackingTransactions]
  );

  const itemTrackingTransactions = useMemo(
    () =>
      trackingTransactions.filter(
        (transaction) => transaction.kind === "ITEM"
      ),
    [trackingTransactions]
  );
  /* =========================================
     UPCOMING TRANSACTIONS
  ========================================= */

  const upcomingTransactions = useMemo(
    () =>
      [...activeTransactions]
        .filter((transaction) => Boolean(transaction.date))
        .sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(
            `${b.date} ${b.time}`
          )
        )
        .slice(0, 3),
    [activeTransactions]
  );

  /* =========================================
     NOTIFICATIONS
  ========================================= */

  const notificationAudience = studentId
    ? [
      studentAudience(studentId),
      ALL_STUDENTS_AUDIENCE,
    ]
    : null;

  const {
    items: notifications,
    unread: unreadNotifications,
    loading: notificationsLoading,
  } = useNotifications(notificationAudience, studentId);

  /* const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort(
          (a, b) =>
            getTime(b.createdAt) - getTime(a.createdAt)
        )
        .slice(0, 4),
    [notifications]
  ); */

  /* =========================================
     GROUP REQUESTS
  ========================================= */

  const [groupInvites, setGroupInvites] =
    useState<GroupInvite[]>([]);

  useEffect(() => {
    if (!studentId) {
      setGroupInvites([]);
      return;
    }

    return subscribeToGroupInvites(
      studentId,
      setGroupInvites
    );
  }, [studentId]);

  /* =========================================
     MESSAGES
  ========================================= */

  const unreadMessages = useStudentUnreadMessages(studentId);

  const pendingInvites = useMemo(
    () =>
      groupInvites.filter(
        (invite) => invite.status === "PENDING"
      ),
    [groupInvites]
  );

  /* =========================================
     NOTIFICATION CLICK
  ========================================= */

  async function handleNotificationClick(
    notification: AppNotification
  ) {
    if (
      !studentId ||
      notification.readBy.includes(studentId)
    ) {
      return;
    }

    try {
      await markNotificationRead(
        notification.id,
        studentId
      );
    } catch (error) {
      console.warn(
        "Could not mark notification as read:",
        error
      );
    }
  }

  /* =========================================
     NAVIGATION
  ========================================= */

  // Set by the dashboard invitation banner so Messages opens on Group Requests.
  const [openGroupInvites, setOpenGroupInvites] = useState(false);

  function go(page: DashboardPage, options?: { groupInvites?: boolean }) {
    setOpenGroupInvites(Boolean(options?.groupInvites));
    setMenuOpen(false);
    setActivePage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =========================================
     LAYOUT
     Every page shares the same sidebar + top bar.
     All styles live in StudentDashboardTheme.css and are
     scoped under `.sdx`, so nothing leaks to other dashboards.
  ========================================= */

  useStudentBodyClass();

  useEffect(() => {
    if (!menuOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const pageTitle = PAGE_TITLES[activePage];

  return (
    <div className={`sdx ${menuOpen ? "sdx--menu-open" : ""}`}>
      <StudentSidebar
        activePage={activePage}
        open={menuOpen}
        pendingInvites={pendingInvites.length}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        onNavigate={go}
      />

      {menuOpen && (
        <button
          type="button"
          className="sdx-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="sdx-app">
        <StudentTopbar
          title={pageTitle}
          studentName={studentName}
          studentEmail={account.email || ""}
          unreadNotifications={unreadNotifications}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen(!menuOpen)}
          onNavigate={go}
        />

        <main className="sdx-content">
          {activePage === "dashboard" ? (
            <div className="sdx-overview">
              {/* GROUP REQUEST INVITATIONS */}

              {pendingInvites.length > 0 && (
                <button
                  className="sdx-invite"
                  type="button"
                  onClick={() => go("messages", { groupInvites: true })}
                >
                  <span className="sdx-invite__mark">
                    <Icon name="users" size={26} />
                  </span>

                  <span className="sdx-invite__body">
                    <span className="sdx-tag">GROUP DOCUMENT REQUEST</span>
                    <strong>
                      You have {pendingInvites.length} invitation
                      {pendingInvites.length === 1 ? "" : "s"} waiting
                    </strong>
                    <small>
                      Classmates added you to a group request. Review and
                      respond to continue.
                    </small>
                  </span>

                  <span className="sdx-invite__cta">
                    Review <span aria-hidden="true">↗</span>
                  </span>
                </button>
              )}

              {/* LIVE TRACKING */}

              <section
                className="sdx-track sdx-track--compact"
                aria-labelledby="sdx-track-title"
              >
                <div className="sdx-track__head">
                  <div className="sdx-track__eyebrow">
                    <span
                      className="sdx-track__live"
                      aria-hidden="true"
                    />
                    <h2 id="sdx-track-title">Live tracking</h2>
                  </div>

                  <button
                    type="button"
                    className="sdx-track__history"
                    onClick={() => go("transactions")}
                  >
                    All activity <span aria-hidden="true">↗</span>
                  </button>
                </div>

                <div className="sdx-track__grid">
                  <TrackingBox
                    variant="document"
                    title="Document requests"
                    loading={transactionsLoading}
                    transactions={documentTrackingTransactions}
                    emptyTitle="No active document requests"
                    emptyText="Requests you submit will be tracked here."
                    emptyAction="Request a document"
                    onEmptyAction={() => go("request")}
                    onSelect={setSelectedTransaction}
                  />

                  <TrackingBox
                    variant="item"
                    title="Item reservations"
                    loading={transactionsLoading}
                    transactions={itemTrackingTransactions}
                    emptyTitle="No active item reservations"
                    emptyText="Reservations you make will be tracked here."
                    emptyAction="Reserve an item"
                    onEmptyAction={() => go("itemReservation")}
                    onSelect={setSelectedTransaction}
                  />
                </div>
              </section>

              {/* STUDENT SERVICES */}

              <section className="sdx-section">
                <div className="sdx-heading">
                  <div>
                    <span className="sdx-tag">YOUR STUDENT SERVICES</span>
                    <h2>Your campus, simplified.</h2>
                    <p>Three simple ways to get things done on campus.</p>
                  </div>

                  <small>QUICK ACCESS / 01—03</small>
                </div>

                <div className="sdx-services">
                  <ServiceCard
                    tone="green"
                    art="document"
                    title="Request a document"
                    text="Certificates, records, and forms—without the long lines."
                    onClick={() => go("request")}
                  />

                  <ServiceCard
                    tone="sky"
                    art="bag"
                    title="Reserve an item"
                    text="Find and book campus items for when you need them."
                    onClick={() => go("itemReservation")}
                  />

                  <ServiceCard
                    tone="sun"
                    art="ticket"
                    title="Claim & release"
                    text="Have a claim stub? You're one step closer."
                    onClick={() => go("claimStub")}
                  />
                </div>
              </section>

              {/* BOTTOM PANELS */}

              <div className="sdx-bottom">
                <section className="sdx-panel sdx-compact">
                  <span className="sdx-tag">READY FOR YOU</span>
                  <h3>Upcoming pick-up</h3>
                  <p className="sdx-panel-note">
                    Claiming dates are set by the Registrar.
                  </p>

                  {transactionsLoading ? (
                    <DashboardLoading />
                  ) : upcomingTransactions.length === 0 ? (
                    <EmptyWidget
                      icon="calendar"
                      title="Nothing scheduled yet"
                      text="Approved requests with a claiming date will appear here."
                    />
                  ) : (
                    <div className="sdx-events">
                      {upcomingTransactions.map((transaction) => (
                        <button
                          className="sdx-event"
                          type="button"
                          key={transaction.key}
                          onClick={() =>
                            setSelectedTransaction(transaction)
                          }
                        >
                          <span className="sdx-date-box">
                            <strong>
                              {getDayNumber(transaction.date)}
                            </strong>
                            <small>
                              {getMonthName(transaction.date).toUpperCase()}
                            </small>
                          </span>

                          <span className="sdx-event__copy">
                            <strong>{transaction.title}</strong>
                            <small>
                              {formatClaimTime(transaction.time)} ·{" "}
                              {getKindLabel(transaction.kind)}
                            </small>
                          </span>

                          <StatusBadge
                            status={normalizeStatus(transaction.status)}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    className="sdx-text-btn"
                    type="button"
                    onClick={() => go("claimStub")}
                  >
                    Open claim &amp; release{" "}
                    <span aria-hidden="true">↗</span>
                  </button>
                </section>

                <section className="sdx-panel sdx-compact">
                  <span className="sdx-tag">RECENT ACTIVITY</span>
                  <h3>Latest transactions</h3>

                  {transactionsLoading ? (
                    <DashboardLoading />
                  ) : transactions.length === 0 ? (
                    <EmptyWidget
                      icon="clock"
                      title="No transactions yet"
                      text="Your requests and reservations will appear here."
                    />
                  ) : (
                    <div className="sdx-activity">
                      {transactions.slice(0, 4).map((transaction) => (
                        <TransactionRow
                          key={transaction.key}
                          transaction={transaction}
                          onSelect={setSelectedTransaction}
                          compact
                        />
                      ))}
                    </div>
                  )}

                  <button
                    className="sdx-text-btn"
                    type="button"
                    onClick={() => go("transactions")}
                  >
                    All transactions <span aria-hidden="true">↗</span>
                  </button>
                </section>
              </div>
            </div>
          ) : (
            <div className="sdx-subpage">
              <button
                className="sdx-back"
                type="button"
                onClick={() => go("dashboard")}
              >
                <span aria-hidden="true">←</span> Back to Dashboard
              </button>

              {activePage === "request" && (
                <DocumentRequestWizard
                  studentId={studentId}
                  draftRequestId={selectedDraftRequestId}
                />
              )}

              {activePage === "requests" && (
                <DocumentRequestList studentId={studentId} />
              )}

              {activePage === "itemReservation" && (
                <ItemReservation
                  studentId={studentId}
                  onBack={() => go("dashboard")}
                />
              )}

              {activePage === "claimStub" && (
                <ClaimStubPage
                  studentId={studentId}
                  onBack={() => go("dashboard")}
                />
              )}

              {activePage === "transactions" && (
                <TransactionHistory
                  transactions={transactions}
                  loading={transactionsLoading}
                  onSelect={setSelectedTransaction}
                />
              )}

              {activePage === "notifications" && (
                <NotificationPage
                  notifications={notifications}
                  loading={notificationsLoading}
                  studentId={studentId}
                  onNotificationClick={handleNotificationClick}
                  onReadAll={() =>
                    markAllNotificationsRead(notifications, studentId).catch(
                      (error) =>
                        console.warn("Could not mark all as read:", error)
                    )
                  }
                />
              )}

              {activePage === "messages" && (
                <MessagesPanel
                  mode="student"
                  studentId={studentId}
                  studentName={studentName}
                  openGroupInvites={openGroupInvites}
                  onContinueDraft={(requestId) => {
                    setSelectedDraftRequestId(requestId);
                    go("request");
                  }}
                />
              )}

              {activePage === "help" && <HelpCenter />}

              {activePage === "contact" && <ContactSupport />}

              {activePage === "profile" && (
                <MyProfile account={account} />
              )}

              {activePage === "settings" && <AccountSettings />}
            </div>
          )}
        </main>
      </div>

      {/* STOCK MODAL */}

      {stocksOpen && (
        <div
          className="sdx-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setStocksOpen(false);
            }
          }}
        >
          <div
            className="sdx-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="sdx-modal__header">
              <div>
                <span className="sdx-tag">LIVE INVENTORY</span>
                <h2>Item Stocks</h2>
              </div>

              <button
                type="button"
                className="sdx-modal__close"
                onClick={() => setStocksOpen(false)}
                aria-label="Close inventory"
              >
                ×
              </button>
            </div>

            <ItemStocks />
          </div>
        </div>
      )}

      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onViewReceipt={
            isPaidTransaction(selectedTransaction)
              ? () => {
                  setReceiptTransaction(selectedTransaction);
                  setSelectedTransaction(null);
                }
              : undefined
          }
        />
      )}

      {receiptTransaction && (
        <DigitalReceipt
          receipt={toReceipt(receiptTransaction, studentName, studentId)}
          onClose={closeReceipt}
        />
      )}
    </div>
  );
}

/* =========================================
   PAGE TITLES (top bar)
========================================= */

const PAGE_TITLES: Record<DashboardPage, string> = {
  dashboard: "Dashboard",
  request: "Request a document",
  requests: "Document requests",
  itemReservation: "Item reservations",
  claimStub: "Claim & release",
  transactions: "Transaction history",
  notifications: "Notifications",
  messages: "Messages",
  help: "Help Center & FAQs",
  contact: "Contact support",
  profile: "My profile",
  settings: "Account settings",
};

/*
 * index.css turns <body> into a centered flex container, which would
 * shrink this full-width layout. While the student dashboard is mounted
 * we switch the body back to block flow; the class is removed on unmount,
 * so the other dashboards keep their current behaviour.
 */
function useStudentBodyClass() {
  useEffect(() => {
    document.body.classList.add("sdx-body");

    return () => {
      document.body.classList.remove("sdx-body");
    };
  }, []);
}

/* =========================================
   SIDEBAR
========================================= */

type NavItem = {
  page: DashboardPage;
  label: string;
  icon: string;
  also?: DashboardPage[];
};

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "MAIN",
    items: [
      { page: "dashboard", label: "Dashboard", icon: "grid" },
      {
        page: "request",
        label: "Document Requests",
        icon: "file",
        also: ["requests"],
      },
      { page: "itemReservation", label: "Item Reservations", icon: "bag" },
      { page: "claimStub", label: "Claim & Release", icon: "ticket" },
      { page: "transactions", label: "Transaction History", icon: "clock" },
    ],
  },
  {
    title: "INFORMATION & SUPPORT",
    items: [
      { page: "messages", label: "Messages", icon: "chat" },
      { page: "notifications", label: "Notifications", icon: "bell" },
      { page: "help", label: "Help Center & FAQs", icon: "help" },
      { page: "contact", label: "Contact Support", icon: "chat" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { page: "profile", label: "My Profile", icon: "user" },
      { page: "settings", label: "Account Settings", icon: "sliders" },
    ],
  },
];

function StudentSidebar({
  activePage,
  open,
  pendingInvites,
  unreadNotifications,
  unreadMessages,
  onNavigate,
}: {
  activePage: DashboardPage;
  open: boolean;
  pendingInvites: number;
  unreadNotifications: number;
  unreadMessages: number;
  onNavigate: (page: DashboardPage) => void;
}) {
  return (
    <aside
      className={`sdx-side ${open ? "is-open" : ""}`}
      aria-label="Student navigation"
    >
      <button
        type="button"
        className="sdx-brand"
        onClick={() => onNavigate("dashboard")}
      >
        <span className="sdx-logo" aria-hidden="true">
          <svg fill="none" viewBox="0 0 44 44">
            <path
              d="M22 3 39 12.5v19L22 41 5 31.5v-19L22 3Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M12.5 17.2 22 12l9.5 5.2V27L22 32l-9.5-5V17.2Z"
              fill="currentColor"
              fillOpacity=".2"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="m17 22 3 3 7-8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>

        <span className="sdx-brand__text">
          <strong>
            campuserve<b>.</b>
          </strong>
          <small>STUDENT WORKSPACE</small>
        </span>
      </button>

      <nav className="sdx-nav" aria-label="Student workspace navigation">
        {NAV_SECTIONS.map((section) => (
          <div className="sdx-nav__group" key={section.title}>
            <div className="sdx-kicker">{section.title}</div>

            {section.items.map((item) => {
              const active =
                activePage === item.page ||
                Boolean(item.also?.includes(activePage));

              const showMark =
                (item.page === "messages" &&
                  (unreadMessages > 0 || pendingInvites > 0)) ||
                (item.page === "notifications" &&
                  unreadNotifications > 0);

              return (
                <button
                  key={item.page}
                  type="button"
                  className={`sdx-link ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.page)}
                >
                  <span className="sdx-link__icon" aria-hidden="true">
                    <Icon name={item.icon} size={16} />
                  </span>

                  <span className="sdx-link__label">{item.label}</span>

                  {showMark && (
                    <i className="sdx-link__mark" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sdx-side-foot">
        <strong>
          Less waiting.
          <br />
          More doing.
        </strong>
        <p>All the little campus things, in one lovely place.</p>
        <small>PSU · LINGAYEN</small>
      </div>
    </aside>
  );
}

/* =========================================
   TOP BAR
========================================= */

function StudentTopbar({
  title,
  studentName,
  studentEmail,
  unreadNotifications,
  menuOpen,
  onToggleMenu,
  onNavigate,
}: {
  title: string;
  studentName: string;
  studentEmail: string;
  unreadNotifications: number;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onNavigate: (page: DashboardPage) => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;

    function handlePointer(event: MouseEvent) {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [accountOpen]);

  function openPage(page: DashboardPage) {
    setAccountOpen(false);
    onNavigate(page);
  }

  return (
    <header className="sdx-topbar">
      <div className="sdx-topbar__left">
        <button
          type="button"
          className="sdx-menu-btn"
          onClick={onToggleMenu}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
        >
          <Icon name="menu" size={18} />
        </button>

        <div className="sdx-topbar__title">
          <small>YOUR CAMPUS / STUDENT PORTAL</small>
          <strong>{title}</strong>
        </div>
      </div>

      <div className="sdx-top-actions">
        <span className="sdx-top-actions__school">
          PANGASINAN STATE UNIVERSITY
        </span>

        <button
          type="button"
          className="sdx-bell"
          onClick={() => onNavigate("notifications")}
          aria-label={
            unreadNotifications > 0
              ? `Open notifications (${unreadNotifications} unread)`
              : "Open notifications"
          }
        >
          <Icon name="bell" size={19} />

          {unreadNotifications > 0 && (
            <span className="sdx-bell__count">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </button>

        <div className="sdx-account" ref={accountRef}>
          <button
            type="button"
            className="sdx-account__trigger"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
          >
            <span className="sdx-avatar">{getInitials(studentName)}</span>

            <span className="sdx-account__copy">
              <strong>{studentName}</strong>
              <small>My account</small>
            </span>

            <span className="sdx-account__chevron" aria-hidden="true">
              ⌄
            </span>
          </button>

          {accountOpen && (
            <div className="sdx-account__menu" role="menu">
              <div className="sdx-account__user">
                <strong>{studentName}</strong>
                {studentEmail && <small>{studentEmail}</small>}
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => openPage("profile")}
              >
                My profile
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => openPage("settings")}
              >
                Account settings
              </button>

              <button
                type="button"
                role="menuitem"
                className="sdx-account__signout"
                onClick={async () => {
                  setAccountOpen(false);
                  await logout();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* =========================================
   LIVE TRACKING BOX + CAROUSEL
========================================= */

function TrackingBox({
  variant,
  title,
  loading,
  transactions,
  emptyTitle,
  emptyText,
  emptyAction,
  onEmptyAction,
  onSelect,
}: {
  variant: "document" | "item";
  title: string;
  loading: boolean;
  transactions: StudentTransaction[];
  emptyTitle: string;
  emptyText: string;
  emptyAction: string;
  onEmptyAction: () => void;
  onSelect: (transaction: StudentTransaction) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = transactions.length;
  const safeIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);
  const current = transactions[safeIndex];

  // Automatically rotate every 5 seconds (paused on hover / focus).
  useEffect(() => {
    if (count <= 1 || paused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % count);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [count, paused]);

  // Reset when the number of tracked transactions changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [count]);

  function previous() {
    setActiveIndex((index) => Math.max(0, index - 1));
  }

  function next() {
    setActiveIndex((index) => Math.min(count - 1, index + 1));
  }

  return (
    <section
      className={`sdx-track-box sdx-track-box--${variant}`}
      aria-label={title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") previous();
        if (event.key === "ArrowRight") next();
      }}
    >
      <div className="sdx-box-head">
        <strong>{title}</strong>
        <span>{loading ? "…" : `${count} active`}</span>
      </div>

      {loading ? (
        <DashboardLoading />
      ) : !current ? (
        <div className="sdx-track-empty">
          <span className="sdx-track-empty__icon">
            <Icon name={variant === "document" ? "file" : "bag"} size={22} />
          </span>

          <div>
            <strong>{emptyTitle}</strong>
            <p>{emptyText}</p>

            <button
              type="button"
              className="sdx-text-btn"
              onClick={onEmptyAction}
            >
              {emptyAction} <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="sdx-track-slide"
            role="button"
            tabIndex={0}
            key={current.key}
            onClick={() => onSelect(current)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(current);
              }
            }}
            aria-label={`View details for ${current.title}`}
          >
            <TrackingContent
              transaction={current}
              position={{ index: safeIndex + 1, count }}
            />
          </div>

          <div className="sdx-box-bottom sdx-box-bottom--center">
            {count > 1 ? (
              <button
                type="button"
                className="sdx-mini-btn"
                onClick={previous}
                disabled={safeIndex === 0}
                aria-label="Previous transaction"
              >
                ←
              </button>
            ) : (
              <span className="sdx-mini-spacer" />
            )}

            <button
              type="button"
              className="sdx-text-btn sdx-text-btn--small sdx-view-more"
              onClick={() => onSelect(current)}
            >
              View more <span aria-hidden="true">↗</span>
            </button>

            {count > 1 ? (
              <button
                type="button"
                className="sdx-mini-btn"
                onClick={next}
                disabled={safeIndex === count - 1}
                aria-label="Next transaction"
              >
                →
              </button>
            ) : (
              <span className="sdx-mini-spacer" />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function TrackingContent({
  transaction,
  position,
}: {
  transaction: StudentTransaction;
  position?: { index: number; count: number };
}) {
  const status = normalizeStatus(transaction.status);
  const paymentStatus = normalizeStatus(transaction.payment_status);

  const isDocument = transaction.kind === "DOCUMENT";

  const showClaimingDetails =
    status === "APPROVED" ||
    status === "CLAIMED" ||
    status === "READY_FOR_PICKUP";

  // Separate tracking steps
  const documentSteps = [
    "NEW REQUEST",
    "APPROVED",
    "PAID",
    "IN PROCESSING",
    "READY FOR PICKUP",
  ];

  // Keep the existing inventory tracking steps
  const itemSteps = TRACKING_STEPS;

  const currentSteps = isDocument ? documentSteps : itemSteps;

  let activeIndex = 0;

  if (isDocument) {
    // DOCUMENT TRACKING

    if (
      status === "READY_FOR_PICKUP" ||
      status === "CLAIMED" ||
      status === "COMPLETED"
    ) {
      activeIndex = 4;
    } else if (status === "PROCESSING") {
      activeIndex = 3;
    } else if (
      status === "APPROVED" &&
      paymentStatus === "PAID"
    ) {
      activeIndex = 2;
    } else if (status === "APPROVED") {
      activeIndex = 1;
    } else if (status === "PENDING") {
      activeIndex = 0;
    }
  } else {
    // INVENTORY TRACKING — PRESERVE EXISTING LOGIC

    if (
      status === "CLAIMED" ||
      status === "COMPLETED"
    ) {
      activeIndex = 4;
    } else if (
      status === "APPROVED" ||
      status === "PROCESSING" ||
      status === "READY_FOR_PICKUP" ||
      status === "RESCHEDULED"
    ) {
      activeIndex = 3;
    } else if (status === "PAID") {
      activeIndex = 2;
    } else if (status === "PENDING") {
      activeIndex = 1;
    } else if (status === "UNPAID") {
      activeIndex = 0;
    }
  }

  const isFinished = status === "CLAIMED" || status === "COMPLETED";
  const isStopped = STOPPED_STATUSES.includes(status);

  // Friendly names for the stage pictures.
  const stageLabel = (step: string) => STAGE_LABELS[step] ?? toTitle(step);

  let previousLabel = activeIndex > 0
    ? stageLabel(currentSteps[activeIndex - 1])
    : "Submitted";
  let currentLabel = stageLabel(currentSteps[activeIndex]);
  let nextLabel: string | null = currentSteps[activeIndex + 1]
    ? stageLabel(currentSteps[activeIndex + 1])
    : isDocument
      ? "Claimed"
      : null;

  if (isFinished) {
    previousLabel = stageLabel(currentSteps[currentSteps.length - 1]);
    currentLabel = "Claimed";
    nextLabel = null;
  }

  if (isStopped) {
    previousLabel = "Submitted";
    currentLabel = toTitle(status.replace(/_/g, " "));
    nextLabel = null;
  }

  const currentStage: StageKey = isStopped
    ? "stopped"
    : isFinished
      ? "claimed"
      : stageKey(currentSteps[activeIndex]);

  const schedule = transaction.date
    ? `${formatClaimDate(transaction.date)}${transaction.time ? ` · ${formatClaimTime(transaction.time)}` : ""}`
    : "";

  return (
    <div className={`sdx-tl ${isStopped ? "is-stopped" : ""}`}>
      {/* HEADER — item name tab + position counter */}

      <div className="sdx-tl__head">
        <div className="sdx-tl__tab">
          <span className="sdx-row-eyebrow">
            {isDocument ? "DOCUMENT" : "ITEM"} · {transaction.id}
          </span>
          <h3 title={transaction.title}>{transaction.title}</h3>
        </div>

        {position && position.count > 1 && (
          <span
            className="sdx-tl__count"
            aria-label={`${position.index} of ${position.count}`}
          >
            {position.index}/{position.count}
          </span>
        )}
      </div>

      {/* STAGE — previous · CURRENT (animated) · next */}

      <div
        className="sdx-tl__stage"
        role="img"
        aria-label={`Status: ${currentLabel}. Step ${Math.min(activeIndex + 1, currentSteps.length)} of ${currentSteps.length}.`}
      >
        <div className="sdx-tl__side is-prev" aria-hidden="true">
          <span className="sdx-tl__mini">
            <StageArt stage={stageKey(previousLabel)} />
            <i className="sdx-tl__tick">✓</i>
          </span>
          <small>{previousLabel}</small>
        </div>

        <div className="sdx-tl__now" aria-hidden="true">
          <span className={`sdx-tl__hero is-${currentStage}`} key={currentStage}>
            <StageArt stage={currentStage} animated />
          </span>
          <strong>{currentLabel}</strong>
        </div>

        <div
          className={`sdx-tl__side is-next ${nextLabel ? "" : "is-empty"}`}
          aria-hidden="true"
        >
          {nextLabel ? (
            <>
              <span className="sdx-tl__mini">
                <StageArt stage={stageKey(nextLabel)} />
              </span>
              <small>{nextLabel}</small>
            </>
          ) : (
            <>
              <span className="sdx-tl__mini sdx-tl__mini--flag">
                <StageArt stage="claimed" />
              </span>
              <small>{isStopped ? "—" : "Finished"}</small>
            </>
          )}
        </div>
      </div>

      {/* Claiming details appear only once staff have set them. */}

      {showClaimingDetails && (schedule || transaction.claimCode) && (
        <p className="sdx-tl__claim">
          {schedule && <span>{schedule}</span>}
          {transaction.claimCode && (
            <span>
              Code <b>{transaction.claimCode}</b>
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/* =========================================
   TRACKING STAGES (pictures + wording)
========================================= */

type StageKey =
  | "submitted"
  | "pending"
  | "approved"
  | "unpaid"
  | "paid"
  | "processing"
  | "ready"
  | "claimed"
  | "stopped";

const STOPPED_STATUSES = [
  "REJECTED",
  "DECLINED",
  "CANCELLED",
  "CANCELED",
  "EXPIRED",
];

const STAGE_LABELS: Record<string, string> = {
  "NEW REQUEST": "Pending",
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
  UNPAID: "Unpaid",
  "IN PROCESSING": "Processing",
  "READY FOR PICKUP": "Ready for pickup",
  CLAIMED: "Claimed",
};

function stageKey(label: string): StageKey {
  const value = label.toUpperCase();

  if (value.includes("SUBMIT")) return "submitted";
  if (value.includes("UNPAID")) return "unpaid";
  if (value.includes("PAID")) return "paid";
  if (value.includes("APPROV")) return "approved";
  if (value.includes("PROCESS")) return "processing";
  if (value.includes("READY")) return "ready";
  if (value.includes("CLAIM") || value.includes("FINISH")) return "claimed";
  if (STOPPED_STATUSES.some((status) => value.includes(status))) {
    return "stopped";
  }

  return "pending";
}

/** Small original illustrations; `animated` (current stage only) adds a looping motion. */
function StageArt({
  stage,
  animated = false,
}: {
  stage: StageKey;
  animated?: boolean;
}) {
  const a = animated ? " sdx-anim" : "";

  const common = {
    viewBox: "0 0 64 64",
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (stage) {
    case "submitted":
      return (
        <svg {...common}>
          <g className={`sdx-anim-fly${a}`}>
            <path d="M10 31 54 12 44 52 31 39 10 31Z" fill="#E6F2EA" stroke="#2E602E" strokeWidth="3" />
            <path d="M54 12 31 39v12l7-8" stroke="#2E602E" strokeWidth="3" />
          </g>
        </svg>
      );

    case "pending":
      // Clock with a sweeping hand + waiting dots
      return (
        <svg {...common}>
          <circle cx="32" cy="30" r="20" fill="#FFF9DA" stroke="#B49B2A" strokeWidth="3" />
          <path d="M32 17v3M32 40v3M19 30h3M42 30h3" stroke="#D8C46A" strokeWidth="2.5" />
          <g className={`sdx-anim-sweep${a}`}>
            <path d="M32 30V19" stroke="#2E602E" strokeWidth="3.4" />
          </g>
          <g className={`sdx-anim-hour${a}`}>
            <path d="M32 30h7" stroke="#2E602E" strokeWidth="3.4" />
          </g>
          <circle cx="32" cy="30" r="2.6" fill="#2E602E" />
          <g className={`sdx-anim-dots${a}`}>
            <circle cx="24" cy="58" r="2.4" fill="#B49B2A" />
            <circle cx="32" cy="58" r="2.4" fill="#B49B2A" />
            <circle cx="40" cy="58" r="2.4" fill="#B49B2A" />
          </g>
        </svg>
      );

    case "approved":
      // Rubber stamp pressing a check
      return (
        <svg {...common}>
          <rect x="12" y="42" width="40" height="14" rx="3" fill="#E6F2EA" stroke="#2E602E" strokeWidth="2.5" />
          <path className={`sdx-anim-ink${a}`} d="m24 49 5 4 11-9" stroke="#42A76F" strokeWidth="3.4" />
          <g className={`sdx-anim-stamp${a}`}>
            <path d="M26 8h12v14H26z" fill="#F5DE57" stroke="#8A7A12" strokeWidth="2.5" />
            <path d="M20 22h24l3 9H17l3-9Z" fill="#2E602E" stroke="#1E4A2A" strokeWidth="2.5" />
          </g>
        </svg>
      );

    case "unpaid":
      return (
        <svg {...common}>
          <rect x="9" y="18" width="46" height="32" rx="6" fill="#FFF3EC" stroke="#B5603A" strokeWidth="3" />
          <path d="M9 27h46" stroke="#B5603A" strokeWidth="3" />
          <circle className={`sdx-anim-pulse${a}`} cx="46" cy="40" r="5" fill="#E0703F" />
          <path d="M18 40h12" stroke="#D69373" strokeWidth="3" />
        </svg>
      );

    case "paid":
      // Peso coin flipping over a card
      return (
        <svg {...common}>
          <rect x="8" y="34" width="40" height="22" rx="5" fill="#E6F2EA" stroke="#2E602E" strokeWidth="2.6" />
          <path d="M8 42h40" stroke="#2E602E" strokeWidth="2.6" />
          <g className={`sdx-anim-coin${a}`}>
            <circle cx="44" cy="20" r="13" fill="#F5DE57" stroke="#8A7A12" strokeWidth="2.6" />
            <path d="M40 27V13h5a4 4 0 0 1 0 8h-5M37 16h12M37 19h12" stroke="#8A7A12" strokeWidth="2.2" />
          </g>
        </svg>
      );

    case "processing":
      // Two gears turning
      return (
        <svg {...common}>
          <g className={`sdx-anim-gear${a}`} style={{ transformOrigin: "25px 27px" }}>
            <path d="M25 11v6M25 37v6M9 27h6M35 27h6M13.7 15.7l4.2 4.2M32.1 34.1l4.2 4.2M13.7 38.3l4.2-4.2M32.1 19.9l4.2-4.2" stroke="#2D5873" strokeWidth="4" />
            <circle cx="25" cy="27" r="10" fill="#DFEEF7" stroke="#2D5873" strokeWidth="3" />
            <circle cx="25" cy="27" r="3.5" fill="#2D5873" />
          </g>
          <g className={`sdx-anim-gear-rev${a}`} style={{ transformOrigin: "45px 45px" }}>
            <path d="M45 34v4M45 52v4M34 45h4M52 45h4M37.2 37.2l2.8 2.8M50 50l2.8 2.8M37.2 52.8l2.8-2.8M50 40l2.8-2.8" stroke="#42A76F" strokeWidth="3.4" />
            <circle cx="45" cy="45" r="7" fill="#E6F2EA" stroke="#42A76F" strokeWidth="2.8" />
            <circle cx="45" cy="45" r="2.4" fill="#42A76F" />
          </g>
        </svg>
      );

    case "ready":
      // Bag with bouncing sparkles
      return (
        <svg {...common}>
          <path d="M14 24h36l-3 32H17l-3-32Z" fill="#E6F2EA" stroke="#2E602E" strokeWidth="3" />
          <path d="M24 26v-6a8 8 0 0 1 16 0v6" stroke="#2E602E" strokeWidth="3" />
          <path d="m26 40 5 5 9-10" stroke="#42A76F" strokeWidth="3.4" />
          <g className={`sdx-anim-spark${a}`}>
            <path d="M54 8v8M50 12h8" stroke="#D8C43A" strokeWidth="2.8" />
            <path d="M9 12v6M6 15h6" stroke="#D8C43A" strokeWidth="2.4" />
          </g>
        </svg>
      );

    case "claimed":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill="#42A76F" />
          <path className={`sdx-anim-draw${a}`} d="m21 33 8 8 15-17" stroke="#fff" strokeWidth="5" />
        </svg>
      );

    case "stopped":
      return (
        <svg {...common}>
          <circle className={`sdx-anim-shake${a}`} cx="32" cy="32" r="22" fill="#FBE9E5" stroke="#B5473A" strokeWidth="3" />
          <path d="m24 24 16 16M40 24 24 40" stroke="#B5473A" strokeWidth="4" />
        </svg>
      );
  }
}

/* =========================================
   SERVICE CARD (illustrated)
========================================= */

function ServiceCard({
  tone,
  art,
  title,
  text,
  onClick,
}: {
  tone: "green" | "sky" | "sun";
  art: "document" | "bag" | "ticket";
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sdx-service sdx-service--${tone}`}
      onClick={onClick}
    >
      <span className="sdx-service__circle" aria-hidden="true">
        ↗
      </span>

      <span className="sdx-service__art" aria-hidden="true">
        <ServiceArt name={art} />
      </span>

      <strong>{title}</strong>
      <p>{text}</p>
    </button>
  );
}

function ServiceArt({ name }: { name: "document" | "bag" | "ticket" }) {
  if (name === "document") {
    return (
      <svg fill="none" viewBox="0 0 190 155">
        <ellipse cx="98" cy="132" fill="#CBE6D7" opacity=".6" rx="68" ry="12" />
        <rect fill="#FCFFFA" height="105" rx="9" stroke="#387F68" strokeWidth="2" transform="rotate(-9 48 20)" width="82" x="48" y="20" />
        <rect fill="#DDEFE3" height="105" rx="9" stroke="#387F68" strokeWidth="2" transform="rotate(8 77 24)" width="82" x="77" y="24" />
        <path d="M92 54h42m-42 14h33m-33 14h42" stroke="#69A48C" strokeLinecap="round" strokeWidth="5" />
        <circle cx="136" cy="109" fill="#F0C884" r="20" stroke="#7F6139" strokeWidth="2" />
        <path d="m127 109 7 7 13-15" stroke="#7F6139" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      </svg>
    );
  }

  if (name === "bag") {
    return (
      <svg fill="none" viewBox="0 0 190 155">
        <ellipse cx="102" cy="136" fill="#EED8B7" opacity=".8" rx="67" ry="11" />
        <path d="M44 61h103l-11 64H55L44 61Z" fill="#E9B76E" stroke="#835D38" strokeLinejoin="round" strokeWidth="2.5" />
        <path d="M65 64V51c0-21 60-21 60 0v13" stroke="#845C37" strokeLinecap="round" strokeWidth="7" />
        <path d="M79 86h33m-33 12h25" stroke="#FFF1D8" strokeLinecap="round" strokeWidth="6" />
        <circle cx="141" cy="43" fill="#F9F3E7" r="22" stroke="#835D38" strokeWidth="2" />
        <path d="M132 43h18m-9-9v18" stroke="#835D38" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  return (
    <svg fill="none" viewBox="0 0 190 155">
      <ellipse cx="96" cy="134" fill="#CDD7F0" opacity=".75" rx="69" ry="12" />
      <g transform="translate(30 35) rotate(-9 65 45)">
        <path d="M8 9h130v25c-12 2-12 21 0 23v25H8V57c12-2 12-21 0-23V9Z" fill="#E4EAFB" stroke="#5E76A8" strokeWidth="2.6" />
        <path d="M92 9v73" stroke="#9DAED1" strokeDasharray="6 6" strokeWidth="2" />
        <path d="M29 32h39m-39 14h30m-30 14h36" stroke="#8299C1" strokeLinecap="round" strokeWidth="5" />
        <circle cx="115" cy="46" fill="#F2CD91" r="9" />
      </g>
    </svg>
  );
}

/* =========================================
   TRANSACTION ROW
========================================= */

function TransactionRow({
  transaction,
  onSelect,
  compact = false,
}: {
  transaction: StudentTransaction;
  onSelect: (transaction: StudentTransaction) => void;
  compact?: boolean;
}) {
  const status = normalizeStatus(transaction.status);

  return (
    <div
      className={`sdx-tx-row ${compact ? "sdx-tx-row--compact" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(transaction)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(transaction);
        }
      }}
      aria-label={`View details for ${transaction.title}`}
    >
      <span className="sdx-tx-row__icon">
        <Icon
          name={transaction.kind === "DOCUMENT" ? "file" : "bag"}
          size={17}
        />
      </span>

      <span className="sdx-tx-row__main">
        <strong>{transaction.title}</strong>

        <small>
          {getKindLabel(transaction.kind)} · ID {transaction.id}
          {!compact && transaction.claimCode
            ? ` · Claiming code: ${transaction.claimCode}`
            : ""}
        </small>
      </span>

      {!compact && (
        <span className="sdx-tx-row__date">
          {transaction.date
            ? formatClaimDate(transaction.date)
            : timeAgo(transaction.createdAt)}
        </span>
      )}

      <StatusBadge status={status} />
    </div>
  );
}

/* =========================================
   TRANSACTION HISTORY
========================================= */

function TransactionHistory({
  transactions,
  loading,
  onSelect,
}: {
  transactions: StudentTransaction[];
  loading: boolean;
  onSelect: (transaction: StudentTransaction) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="TRANSACTIONS"
        title="Transaction History"
        text="Every document request and item reservation."
      />

      <section className="sdx-panel">
        {loading ? (
          <DashboardLoading />
        ) : transactions.length === 0 ? (
          <EmptyWidget
            icon="clock"
            title="No transactions yet"
            text="Your requests and reservations will appear here."
          />
        ) : (
          <div className="sdx-activity">
            {transactions.map((transaction) => (
              <TransactionRow
                key={transaction.key}
                transaction={transaction}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* =========================================
   TRANSACTION DETAILS MODAL
========================================= */

function TransactionDetailsModal({
  transaction,
  onClose,
  onViewReceipt,
}: {
  transaction: StudentTransaction;
  onClose: () => void;
  onViewReceipt?: () => void;
}) {
  const details = transaction.details || {};
  const isDocument = transaction.kind === "DOCUMENT";
  const items = Array.isArray(details.items) ? details.items : [];

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(17, 46, 37, 0.52)",
  };

  const panelStyle: CSSProperties = {
    width: "min(680px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    color: "#243f24",
    borderRadius: "22px",
    padding: "26px",
    border: "1px solid #dce8de",
    boxShadow: "0 25px 85px rgba(10, 37, 28, 0.27)",
  };

  const sectionStyle: CSSProperties = {
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid #e4ece4",
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
  };

  function Detail({
    label,
    value,
  }: {
    label: string;
    value: unknown;
  }) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return (
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            color: "#7a9282",
            marginBottom: "5px",
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            overflowWrap: "anywhere",
          }}
        >
          {String(value)}
        </div>
      </div>
    );
  }

  function DateDetail({
    label,
    value,
  }: {
    label: string;
    value: unknown;
  }) {
    const formatted = formatTransactionDate(value);

    if (!formatted) return null;

    return <Detail label={label} value={formatted} />;
  }

  return (
    <div
      style={overlayStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-details-title"
        style={panelStyle}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                color: "#6f8b7a",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              {isDocument ? "DOCUMENT REQUEST" : "ITEM RESERVATION"}
            </div>

            <h2
              id="transaction-details-title"
              style={{ margin: "6px 0", fontSize: "22px" }}
            >
              Transaction Details
            </h2>

            <div style={{ color: "#6f8b7a", fontSize: "13px" }}>
              Transaction ID: {transaction.id}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close transaction details"
            onClick={onClose}
            style={{
              border: 0,
              background: "#eef6f0",
              color: "#2e602e",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              fontSize: "23px",
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <StatusBadge
            status={normalizeStatus(transaction.status)}
            large
          />

          {onViewReceipt && (
            <button
              type="button"
              onClick={onViewReceipt}
              style={{
                border: "1px solid #c9dce8",
                background: "#eef6fb",
                color: "#1e6896",
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🧾 View receipt
            </button>
          )}
        </div>

        {/* GENERAL INFORMATION */}

        <div style={sectionStyle}>
          <h3 style={{ margin: "0 0 14px", fontSize: "15px" }}>
            Transaction Information
          </h3>

          <div style={gridStyle}>
            <Detail
              label="Description"
              value={transaction.title}
            />

            <Detail
              label="Transaction Type"
              value={getKindLabel(transaction.kind)}
            />

            <Detail
              label="Student ID"
              value={
                isDocument
                  ? details.student_id
                  : details.studentId
              }
            />

            <DateDetail
              label="Date Created"
              value={
                isDocument
                  ? details.created_at
                  : details.createdAt
              }
            />

            <DateDetail
              label="Last Updated"
              value={
                isDocument
                  ? details.updated_at
                  : details.updatedAt
              }
            />
          </div>
        </div>

        {/* DOCUMENT REQUEST DETAILS */}

        {isDocument ? (
          <>
            <div style={sectionStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: "15px" }}>
                Request Details
              </h3>

              <div style={gridStyle}>
                <Detail
                  label="Purpose"
                  value={details.purpose}
                />

                <Detail
                  label="Number of Copies"
                  value={details.number_of_copies}
                />

                <Detail
                  label="Request Method"
                  value={details.request_method}
                />

                <Detail
                  label="Requested Date"
                  value={details.requested_date}
                />

                <Detail
                  label="Requested Time"
                  value={details.requested_time}
                />

                <Detail
                  label="Total Amount"
                  value={
                    details.total_amount != null
                      ? `₱${Number(details.total_amount).toFixed(2)}`
                      : null
                  }
                />



                <Detail
                  label="Payment Stub Code"
                  value={details.payment_stub_code}
                />

                <Detail
                  label="Claim Code"
                  value={details.claim_code}
                />
              </div>
            </div>

            <div style={sectionStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: "15px" }}>
                Processing Information
              </h3>

              <div style={gridStyle}>
                <DateDetail
                  label="Submitted At"
                  value={details.submitted_at}
                />

                <DateDetail
                  label="Payment Confirmed At"
                  value={details.payment_confirmed_at}
                />

                <Detail
                  label="Payment Confirmed By"
                  value={details.payment_confirmed_by}
                />

                <DateDetail
                  label="Approved At"
                  value={details.approved_at}
                />

                <Detail
                  label="Approved By"
                  value={
                    details.approved_by_name ||
                    details.approved_by
                  }
                />

                <DateDetail
                  label="Processing Started At"
                  value={details.processing_started_at}
                />

                <Detail
                  label="Processing Started By"
                  value={
                    details.processing_started_by_name ||
                    details.processing_started_by
                  }
                />

                <DateDetail
                  label="Ready for Pickup At"
                  value={details.ready_for_pickup_at}
                />

                <Detail
                  label="Ready for Pickup By"
                  value={
                    details.ready_for_pickup_by_name ||
                    details.ready_for_pickup_by
                  }
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ITEM RESERVATION DETAILS */}

            <div style={sectionStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: "15px" }}>
                Reservation Details
              </h3>

              <div style={gridStyle}>
                <Detail
                  label="Full Name"
                  value={details.fullName}
                />

                <Detail
                  label="Mobile Number"
                  value={details.mobileNumber}
                />

                <Detail
                  label="Program"
                  value={details.program}
                />

                <Detail
                  label="Pickup Date"
                  value={details.pickupDate}
                />

                <Detail
                  label="Claim Stub ID"
                  value={details.claimStubId}
                />

                <Detail
                  label="Total Amount"
                  value={
                    details.totalAmount != null
                      ? `₱${Number(details.totalAmount).toFixed(2)}`
                      : null
                  }
                />

                <DateDetail
                  label="Payment Confirmed At"
                  value={details.payment_confirmed_at}
                />

                <Detail
                  label="Payment Confirmed By"
                  value={details.payment_confirmed_by}
                />

                <DateDetail
                  label="Claimed At"
                  value={details.claimedAt}
                />
              </div>
            </div>

            {/* RESERVED ITEMS */}

            {items.length > 0 && (
              <div style={sectionStyle}>
                <h3 style={{ margin: "0 0 14px", fontSize: "15px" }}>
                  Reserved Items
                </h3>

                <div style={{ display: "grid", gap: "10px" }}>
                  {items.map((item: any, index: number) => (
                    <div
                      key={`${item.inventoryId || item.itemName || "item"}-${index}`}
                      style={{
                        padding: "13px",
                        border: "1px solid #e1eae2",
                        borderRadius: "10px",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          marginBottom: "8px",
                        }}
                      >
                        {item.itemName || "Reserved Item"}
                      </strong>

                      <div style={gridStyle}>
                        <Detail
                          label="Size"
                          value={item.size}
                        />

                        <Detail
                          label="Quantity"
                          value={item.quantity}
                        />

                        <Detail
                          label="Unit Price"
                          value={
                            item.price != null
                              ? `₱${Number(item.price).toFixed(2)}`
                              : null
                          }
                        />

                        <Detail
                          label="Subtotal"
                          value={
                            item.subtotal != null
                              ? `₱${Number(item.subtotal).toFixed(2)}`
                              : null
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "24px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 0,
              borderRadius: "11px",
              padding: "11px 20px",
              background: "linear-gradient(125deg, #2e602e, #42a76f)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

/* =========================================
   DATE FORMATTER
========================================= */

function formatTransactionDate(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  let date: Date;

  const timestamp = value as {
    toDate?: () => Date;
    seconds?: number;
  };

  if (value instanceof Date) {
    date = value;
  } else if (typeof timestamp?.toDate === "function") {
    date = timestamp.toDate();
  } else if (typeof timestamp?.seconds === "number") {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(value as string | number);
  }

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* =========================================
   NOTIFICATION PAGE
========================================= */

function NotificationPage({
  notifications,
  loading,
  studentId,
  onNotificationClick,
  onReadAll,
}: {
  notifications: AppNotification[];
  loading: boolean;
  studentId: string;
  onNotificationClick: (
    notification: AppNotification
  ) => Promise<void>;
  onReadAll: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const isUnread = (notification: AppNotification) =>
    !notification.readBy.includes(studentId);

  const unreadCount = notifications.filter(isUnread).length;
  const visible =
    filter === "unread" ? notifications.filter(isUnread) : notifications;
  const groups = groupNotifications(visible);

  return (
    <>
      <PageHeading
        eyebrow="UPDATES"
        title="Notifications"
        text="Updates about your requests, reservations and claiming schedule."
      />

      <section className="sdx-panel sdx-nt">
        {loading ? (
          <DashboardLoading />
        ) : notifications.length === 0 ? (
          <EmptyWidget
            icon="bell"
            title="You're all caught up"
            text="New updates will appear here."
          />
        ) : (
          <>
            <div className="sdx-nt__bar">
              <div className="sdx-nt__tabs" role="tablist" aria-label="Filter notifications">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "all"}
                  className={filter === "all" ? "is-active" : ""}
                  onClick={() => setFilter("all")}
                >
                  All <span>{notifications.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "unread"}
                  className={filter === "unread" ? "is-active" : ""}
                  onClick={() => setFilter("unread")}
                >
                  Unread <span>{unreadCount}</span>
                </button>
              </div>

              <button
                type="button"
                className="sdx-nt__readall"
                onClick={onReadAll}
                disabled={unreadCount === 0}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path
                    d="m2 12 5 5L18 6m-6 11 1 1L22 9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Read All
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="sdx-nt__empty">
                <Icon name="bell" size={22} />
                <strong>No unread notifications</strong>
                <span>You've read everything. Nice!</span>
              </div>
            ) : (
              groups.map((group) => (
                <div className="sdx-nt__group" key={group.label}>
                  <h2 className="sdx-nt__day">
                    <span>{group.label}</span>
                    <small>{group.items.length}</small>
                  </h2>

                  <ul className="sdx-nt__list">
                    {group.items.map((notification) => {
                      const unread = isUnread(notification);
                      const open = openId === notification.id;
                      const look = notificationLook(notification);

                      return (
                        <li key={notification.id}>
                          <button
                            type="button"
                            className={`sdx-nt__item tone-${look.tone} ${unread ? "is-unread" : ""} ${open ? "is-open" : ""}`}
                            aria-expanded={open}
                            onClick={() => {
                              setOpenId(open ? null : notification.id);
                              void onNotificationClick(notification);
                            }}
                          >
                            <span className="sdx-nt__icon" aria-hidden="true">
                              <Icon name={look.icon} size={17} />
                            </span>

                            <span className="sdx-nt__body">
                              <span className="sdx-nt__head">
                                <strong>{notification.title}</strong>
                                <small>
                                  {notificationTime(notification.createdAt, group.label)}
                                </small>
                              </span>
                              <span className="sdx-nt__text">
                                {notification.message}
                              </span>
                            </span>

                            <span className="sdx-nt__side" aria-hidden="true">
                              {unread && <span className="sdx-nt__dot" />}
                              <svg
                                className="sdx-nt__chevron"
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                              >
                                <path
                                  d="m6 9 6 6 6-6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </>
        )}
      </section>
    </>
  );
}

/* Icon and colour for each kind of notification. */
function notificationLook(notification: AppNotification): {
  icon: string;
  tone: "blue" | "green" | "sun" | "red" | "sky";
} {
  switch (notification.type) {
    case "CANCELLED":
      return { icon: "ticket", tone: "red" };
    case "RESCHEDULED":
      return { icon: "calendar", tone: "sun" };
    case "REMINDER":
      return { icon: "clock", tone: "sun" };
    case "GROUP_REQUEST":
    case "GROUP_RESPONSE":
      return { icon: "users", tone: "green" };
    case "STOCK":
      return { icon: "bag", tone: "sky" };
    case "STATUS":
    case "SUBMITTED":
      return notification.kind === "ITEM"
        ? { icon: "bag", tone: "blue" }
        : { icon: "file", tone: "blue" };
    default:
      return { icon: "bell", tone: "blue" };
  }
}

type NotificationGroupLabel = "Today" | "Yesterday" | "This Week" | "Earlier";

/* Sort newest first, then split into Today / Yesterday / This Week / Earlier. */
function groupNotifications(items: AppNotification[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const day = 24 * 60 * 60 * 1000;

  const order: NotificationGroupLabel[] = ["Today", "Yesterday", "This Week", "Earlier"];
  const buckets = new Map<NotificationGroupLabel, AppNotification[]>();

  [...items]
    .sort(
      (a, b) =>
        (toDate(b.createdAt)?.getTime() ?? Date.now()) -
        (toDate(a.createdAt)?.getTime() ?? Date.now())
    )
    .forEach((item) => {
      // A just-written notification has no server time yet: treat it as now.
      const time = toDate(item.createdAt)?.getTime() ?? Date.now();
      const label: NotificationGroupLabel =
        time >= today
          ? "Today"
          : time >= today - day
            ? "Yesterday"
            : time >= today - 6 * day
              ? "This Week"
              : "Earlier";

      buckets.set(label, [...(buckets.get(label) ?? []), item]);
    });

  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, items: buckets.get(label)! }));
}

/* "11 minutes ago" today, "Yesterday, 2:14pm", then "Wednesday, 12:21pm" / "Nov 3, 9:05am". */
function notificationTime(value: unknown, group: NotificationGroupLabel) {
  const date = toDate(value);

  if (group === "Today" || !date) return timeAgo(value);

  const time = date
    .toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
    .replace(/\s/g, "")
    .toLowerCase();

  if (group === "Yesterday") return `Yesterday, ${time}`;

  if (group === "This Week") {
    return `${date.toLocaleDateString("en-PH", { weekday: "long" })}, ${time}`;
  }

  return `${date.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}, ${time}`;
}

/* =========================================
   PAGE HEADING
========================================= */

function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="sdx-page-head">
      <span className="sdx-tag">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}

/* =========================================
   EMPTY WIDGET
========================================= */

function EmptyWidget({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="sdx-empty">
      <span className="sdx-empty__icon">
        <Icon name={icon} size={20} />
      </span>

      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </div>
  );
}

/* =========================================
   LOADING
========================================= */

function DashboardLoading() {
  return (
    <div className="sdx-loading" role="status">
      <span className="sdx-spinner" />
      <span>Loading...</span>
    </div>
  );
}

/* =========================================
   STATUS BADGE
========================================= */

const GREEN_STATUSES = [
  "APPROVED",
  "PAID",
  "READY_FOR_PICKUP",
  "CLAIMED",
  "COMPLETED",
];

const BLUE_STATUSES = ["PROCESSING", "RESCHEDULED"];

const RED_STATUSES = [
  "REJECTED",
  "DECLINED",
  "CANCELLED",
  "CANCELED",
  "EXPIRED",
  "FAILED",
];

function StatusBadge({
  status,
  large = false,
}: {
  status: string;
  large?: boolean;
}) {
  const tone = GREEN_STATUSES.includes(status)
    ? "green"
    : BLUE_STATUSES.includes(status)
      ? "blue"
      : RED_STATUSES.includes(status)
        ? "red"
        : "sun";

  return (
    <span
      className={`sdx-badge sdx-badge--${tone} ${large ? "sdx-badge--large" : ""}`}
    >
      {toTitle(status.replace(/_/g, " "))}
    </span>
  );
}

/* =========================================
   HELPERS
========================================= */

/* A payment counts once the Cashier confirmed it. */
function isPaidTransaction(transaction: StudentTransaction): boolean {
  const details = transaction.details || {};

  return (
    normalizeStatus(transaction.payment_status) === "PAID" ||
    Boolean(details.payment_confirmed_at) ||
    (transaction.kind === "ITEM" &&
      normalizeStatus(transaction.status) === "PAID")
  );
}

function toReceipt(
  transaction: StudentTransaction,
  studentName: string,
  studentId: string
): ReceiptData {
  const details = transaction.details || {};
  const items = Array.isArray(details.items) ? details.items : [];

  return {
    kind: transaction.kind,
    receiptNumber: String(
      details.receipt_number ||
        details.payment_stub_code ||
        details.paymentCode ||
        ""
    ),
    referenceId: transaction.id,
    requestId:
      transaction.kind === "DOCUMENT"
        ? String(details.request_id || transaction.id)
        : undefined,
    paidAt: details.payment_confirmed_at,
    amount: Number(
      details.amount_paid ?? details.total_amount ?? details.totalAmount ?? 0
    ),
    cashierName: details.payment_confirmed_by_name
      ? String(details.payment_confirmed_by_name)
      : undefined,
    paymentStubCode: String(
      details.payment_stub_code || details.paymentCode || ""
    ) || undefined,
    claimCode: transaction.claimCode || undefined,
    studentName,
    studentId,
    lines:
      transaction.kind === "ITEM"
        ? items.map((item: any) => {
            const quantity = Number(item.quantity || 1);
            const price = Number(item.price || 0);

            return {
              label: String(item.itemName || "Item"),
              detail: `${item.size ? `Size ${item.size} · ` : ""}${quantity} × ₱${price.toFixed(2)}`,
              amount: quantity * price,
            };
          })
        : undefined,
  };
}

function getKindLabel(kind: StudentTransaction["kind"]) {
  return kind === "DOCUMENT"
    ? "Document Request"
    : "Item Reservation";
}

function getTime(value: unknown): number {
  if (!value) return 0;

  const firebaseValue = value as {
    toDate?: () => Date;
    seconds?: number;
  };

  if (typeof firebaseValue.toDate === "function") {
    return firebaseValue.toDate().getTime();
  }

  if (typeof firebaseValue.seconds === "number") {
    return firebaseValue.seconds * 1000;
  }

  const date = new Date(value as string | number);

  return Number.isNaN(date.getTime())
    ? 0
    : date.getTime();
}

function toTitle(value: string): string {
  const lower = value.toLowerCase();

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function getInitials(name: string): string {
  const clean = name.includes("@") ? name.split("@")[0] : name;

  const parts = clean
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (parts.length === 0) return "ST";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getDayNumber(date: string): string {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : String(parsed.getDate());
}

function getMonthName(date: string): string {
  if (!date) return "";

  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("en-US", {
      month: "short",
    });
}

/* =========================================
   ICONS
========================================= */

function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "menu":
      return (
        <svg {...common}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      );

    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );

    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      );

    case "bag":
      return (
        <svg {...common}>
          <path d="M6 8h12l1 13H5L6 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );

    case "ticket":
      return (
        <svg {...common}>
          <path d="M3 9a3 3 0 0 0 0 6v4h18v-4a3 3 0 0 0 0-6V5H3v4z" />
          <line
            x1="13"
            y1="5"
            x2="13"
            y2="19"
            strokeDasharray="2 2"
          />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "grid":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
          <path d="M13.5 17h7M17 13.5v7" />
        </svg>
      );

    case "help":
      return (
        <svg {...common}>
          <rect x="4" y="3.5" width="16" height="17" rx="3" />
          <path d="M9.5 9.1a2.8 2.8 0 0 1 5 .9c0 1.5-2.5 1.9-2.5 3.7" />
          <path d="M12 17.2h.01" />
        </svg>
      );

    case "chat":
      return (
        <svg {...common}>
          <path d="M6.5 4h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H10l-5.5 3v-4.2A3 3 0 0 1 3.5 15V7a3 3 0 0 1 3-3Z" />
          <path d="M8 10h8M8 13.5h6" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20v-1.3a7 7 0 0 1 14 0V20H5Z" />
        </svg>
      );

    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
          <circle cx="9" cy="7" r="2" fill="var(--sdx-surface, #fff)" />
          <circle cx="15" cy="12" r="2" fill="var(--sdx-surface, #fff)" />
          <circle cx="10.5" cy="17" r="2" fill="var(--sdx-surface, #fff)" />
        </svg>
      );

    case "activity":
      return (
        <svg {...common}>
          <polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
/* function DefaultProfilePicture({ size = 36 }: { size?: number }) {
  return (
    <div
      className="header-profile-placeholder"
      style={{ width: size, height: size }}
      aria-label="Default profile picture"
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="20" r="20" fill="#E5E7EB" />
        <circle cx="20" cy="14" r="7" fill="#9CA3AF" />
        <path
          d="M7 35C7 27.82 12.82 22 20 22C27.18 22 33 27.82 33 35"
          fill="#9CA3AF"
        />
      </svg>
    </div>
  );
} */