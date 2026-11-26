import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
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
  cancelDocumentRequest,
  canStudentCancelDocumentRequest,
  subscribeToDocumentRequestDetails,
} from "../../services/documentRequests";

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
import { useApplyDarkMode } from "../../theme/darkMode";
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

const PAGE_TITLES: Record<DashboardPage, string> = {
  dashboard: "Dashboard",
  request: "Document Request",
  requests: "Document requests",
  itemReservation: "Item Reservation",
  claimStub: "Claim & release",
  transactions: "Transaction history",
  notifications: "Notifications",
  messages: "Messages",
  help: "Help Center & FAQs",
  contact: "Contact support",
  profile: "My profile",
  settings: "Account settings",
};

/** How long a cancelled or declined request or reservation stays in Live tracking. */
const CANCELLED_TRACKING_MS = 24 * 60 * 60 * 1000;

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

  // Laptop "full view": hides the sidebar so pages use the whole width.
  // Remembered on this device.
  const [fullView, setFullView] = useState(() => {
    try {
      return localStorage.getItem("campuserve-full-view") === "1";
    } catch {
      return false;
    }
  });

  function toggleFullView() {
    setFullView((value) => {
      try {
        localStorage.setItem("campuserve-full-view", value ? "0" : "1");
      } catch {
        // Storage unavailable: the choice lasts until the page reloads.
      }
      return !value;
    });
  }
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

  // Document requests are titled by the documents requested (not the purpose),
  // everywhere on the dashboard: live tracking, history and details.
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const documentRequestIds = documentTransactions
    .map((transaction) => transaction.id)
    .join("|");

  useEffect(() => {
    if (!documentRequestIds) return;

    const unsubscribers = documentRequestIds.split("|").map((requestId) =>
      subscribeToDocumentRequestDetails(requestId, (details) => {
        const names = details
          .map((detail) => {
            const type = String(detail.document_type || "");
            return type === "Others"
              ? String(detail.custom_document_name || "Other document")
              : type;
          })
          .filter(Boolean)
          .join(", ");

        setDocumentNames((previous) => ({ ...previous, [requestId]: names }));
      })
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [documentRequestIds]);

  const transactions = useMemo(
    () =>
      [
        ...documentTransactions.map((transaction) =>
          documentNames[transaction.id]
            ? { ...transaction, title: documentNames[transaction.id] }
            : transaction
        ),
        ...itemTransactions,
      ].sort(
        (a, b) => getTime(b.createdAt) - getTime(a.createdAt)
      ),
    [documentTransactions, itemTransactions, documentNames]
  );

  /* The open details modal follows live updates (e.g. right after a cancel). */
  const liveSelectedTransaction = selectedTransaction
    ? transactions.find(
        (transaction) => transaction.key === selectedTransaction.key
      ) ?? selectedTransaction
    : null;

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

  // Re-checked every minute so a cancelled request drops off on time.
  const [trackingNow, setTrackingNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setTrackingNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const trackingTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const status = normalizeStatus(transaction.status);

        if (!status) return false;

        // Received by the student: no longer tracked.
        if (status === "CLAIMED" || status === "COMPLETED") return false;

        // Cancelled or declined requests and reservations stay visible
        // for 24 hours only.
        if (
          status === "CANCELLED" ||
          status === "CANCELED" ||
          status === "DECLINED"
        ) {
          const details = transaction.details ?? {};
          const endedAt = getTime(
            details.cancelled_at ?? // document requests
              details.declined_at ??
              details.cancelledAt ?? // item reservations
              details.updated_at ??
              details.updatedAt
          );

          return (
            endedAt > 0 &&
            trackingNow - endedAt < CANCELLED_TRACKING_MS
          );
        }

        return true;
      }),
    [transactions, trackingNow]
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
  useApplyDarkMode();

  const pageTitle = PAGE_TITLES[activePage];

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

  return (
    <div
      className={`sdx ${menuOpen ? "sdx--menu-open" : ""} ${fullView ? "sdx--full" : ""}`}
    >
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
          unreadMessages={unreadMessages}
          fullView={fullView}
          onToggleFullView={toggleFullView}
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
                    onSelect={setSelectedTransaction}
                  />

                  <TrackingBox
                    variant="item"
                    title="Item reservations"
                    loading={transactionsLoading}
                    transactions={itemTrackingTransactions}
                    emptyTitle="No active item reservations"
                    emptyText="Reservations you make will be tracked here."
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
              {activePage === "request" && (
                <DocumentRequestWizard
                  studentId={studentId}
                  draftRequestId={selectedDraftRequestId}
                />
              )}

              {activePage === "requests" && (
                <DocumentRequestList
                  studentId={studentId}
                  embedded
                  onViewDetails={(requestId) => {
                    const match = documentTransactions.find(
                      (transaction) => transaction.id === requestId
                    );
                    if (match) setSelectedTransaction(match);
                  }}
                />
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

              {activePage === "settings" && <AccountSettings studentId={studentId} />}
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

      {liveSelectedTransaction && (
        <TransactionDetailsModal
          key={liveSelectedTransaction.key}
          transaction={liveSelectedTransaction}
          studentId={studentId}
          onClose={() => setSelectedTransaction(null)}
          onViewReceipt={
            isPaidTransaction(liveSelectedTransaction)
              ? () => {
                  setReceiptTransaction(liveSelectedTransaction);
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
  unreadMessages,
  fullView,
  onToggleFullView,
  menuOpen,
  onToggleMenu,
  onNavigate,
}: {
  title: string;
  studentName: string;
  studentEmail: string;
  unreadNotifications: number;
  unreadMessages: number;
  fullView: boolean;
  onToggleFullView: () => void;
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

        <button
          type="button"
          className="sdx-full-btn"
          onClick={onToggleFullView}
          aria-pressed={fullView}
          aria-label={fullView ? "Show the menu" : "Full view (hide the menu)"}
          title={fullView ? "Show the menu" : "Full view"}
        >
          <Icon name="menu" size={18} />
        </button>

        <div className="sdx-topbar__title">
          <strong>{title}</strong>
        </div>
      </div>

      <div className="sdx-top-actions">
        <button
          type="button"
          className="sdx-bell sdx-bell--chat"
          onClick={() => onNavigate("messages")}
          aria-label={
            unreadMessages > 0
              ? `Open messages (${unreadMessages} unread)`
              : "Open messages"
          }
        >
          <Icon name="chat" size={19} />

          {unreadMessages > 0 && (
            <span className="sdx-bell__count">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </button>

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
          {/* The avatar opens My Profile; the name and ⌄ open the menu. */}
          <button
            type="button"
            className="sdx-avatar sdx-avatar--link"
            onClick={() => openPage("profile")}
            aria-label="Open my profile"
            title="My profile"
          >
            {getInitials(studentName)}
          </button>

          <button
            type="button"
            className="sdx-account__trigger"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            aria-label="Account menu"
            onClick={() => setAccountOpen(!accountOpen)}
          >
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
  onSelect,
}: {
  variant: "document" | "item";
  title: string;
  loading: boolean;
  transactions: StudentTransaction[];
  emptyTitle: string;
  emptyText: string;
  onSelect: (transaction: StudentTransaction) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = transactions.length;
  const safeIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);
  const current = transactions[safeIndex];

  // Which way the new card slides in from.
  const [direction, setDirection] = useState<"next" | "prev">("next");

  // Swipe: the card follows the finger, then slides to the next or
  // previous one (or springs back if the swipe was too short).
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ id: number; x: number; y: number; horizontal: boolean | null } | null>(null);
  const swiped = useRef(false);

  // Automatically rotate every 5 seconds (paused on hover / focus / drag).
  useEffect(() => {
    if (count <= 1 || paused || dragging) return;

    const timer = window.setInterval(() => {
      setDirection("next");
      setActiveIndex((index) => (index + 1) % count);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [count, paused, dragging]);

  // Reset when the number of tracked transactions changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [count]);

  function previous() {
    if (safeIndex === 0) return;
    setDirection("prev");
    setActiveIndex(safeIndex - 1);
  }

  function next() {
    if (safeIndex >= count - 1) return;
    setDirection("next");
    setActiveIndex(safeIndex + 1);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (count <= 1 || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: null };
    swiped.current = false;
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    // Decide once whether this is a sideways swipe or a page scroll.
    if (start.horizontal === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      start.horizontal = Math.abs(dx) > Math.abs(dy);
      if (start.horizontal) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }
    }

    if (!start.horizontal) return;

    // Resist at the ends, where there is nothing to swipe to.
    const atEdge = (dx > 0 && safeIndex === 0) || (dx < 0 && safeIndex === count - 1);
    setDragX(atEdge ? dx * 0.25 : dx);
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    pointer.current = null;

    if (start.horizontal) {
      const dx = event.clientX - start.x;
      swiped.current = Math.abs(dx) > 8; // a drag is not a click
      if (dx <= -45) next();
      else if (dx >= 45) previous();
    }

    setDragging(false);
    setDragX(0);
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
          </div>
        </div>
      ) : (
        <>
          <div className="sdx-track-viewport">
            <div
              className={`sdx-track-slide is-from-${direction} ${dragging ? "is-dragging" : ""}`}
              role="button"
              tabIndex={0}
              key={current.key}
              style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onClick={() => {
                if (swiped.current) {
                  swiped.current = false;
                  return;
                }
                onSelect(current);
              }}
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
          </div>

          {/* Swipe (or drag, or use the arrow keys) to move between cards;
              the card itself opens the details. */}
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

/* Stage icons: flat illustrated objects with soft gradients, each with its
   own short loop on the current stage (`animated`).
   submitted · pending · approved · unpaid · paid · processing · ready ·
   claimed · cancelled */

const GEAR_PATH =
  "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z";

/* Gradient stops per part (top-left → bottom-right). */
const PAINT = {
  pinkWing: ["#ff8cc6", "#ffcbe6"],
  pinkWingBack: ["#f56fb3", "#ffb3d9"],
  blueFold: ["#3352f5", "#7d93ff"],
  wood: ["#6a4a3e", "#a17a68"],
  glass: ["#a9d4ff", "#e6f3ff"],
  sand: ["#f58a07", "#ffc24d"],
  folder: ["#f39a12", "#ffcc5c"],
  paper: ["#f3f7ff", "#ffffff"],
  ring: ["#4f6676", "#7d95a5"],
  disc: ["#e8edf2", "#f7f9fb"],
  check: ["#1fa952", "#7fe08f"],
  cross: ["#e83a4b", "#ff8597"],
  wallet: ["#f0336d", "#ff7aa5"],
  walletFlap: ["#b81f53", "#e34c7d"],
  bills: ["#12a34a", "#6fe08c"],
  warn: ["#ffb300", "#ffe066"],
  printer: ["#17b6e0", "#7fe3f8"],
  receipt: ["#ffd96a", "#fff4cc"],
  gearBig: ["#1fc8e3", "#8eeefa"],
  gearSmall: ["#5422f0", "#9b6bff"],
  box: ["#f4a90f", "#ffd65c"],
  tape: ["#e2730a", "#f7a134"],
  badge: ["#3346c4", "#6b7ef0"],
} as const;

type Paint = keyof typeof PAINT;

function StageArt({
  stage,
  animated = false,
}: {
  stage: StageKey;
  animated?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const a = animated ? " sdx-anim" : "";
  const used = new Set<Paint>();
  const paint = (name: Paint) => {
    used.add(name);
    return `url(#${uid}-${name})`;
  };
  const round = {
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  // Shared parts
  const documentStack = (
    <>
      <rect x="11" y="12" width="28" height="36" rx="2.5" transform="rotate(-9 25 30)" fill={paint("folder")} />
      <rect x="17" y="10" width="27" height="36" rx="2.5" transform="rotate(-4 30 28)" fill={paint("paper")} />
      <g transform="rotate(-4 30 28)">
        <rect x="21" y="15" width="14" height="3" rx="1.5" fill="#4f7cf0" />
        <rect x="21" y="21" width="18" height="1.8" rx=".9" fill="#a9c0fb" />
        <rect x="21" y="25" width="16" height="1.8" rx=".9" fill="#a9c0fb" />
        <rect x="21" y="29" width="18" height="1.8" rx=".9" fill="#a9c0fb" />
        <rect x="21" y="33" width="12" height="1.8" rx=".9" fill="#a9c0fb" />
      </g>
    </>
  );

  const box = (
    <>
      <rect x="10" y="16" width="34" height="30" rx="2.5" fill={paint("box")} />
      <rect x="21" y="16" width="11" height="8" fill={paint("tape")} />
      <rect className={`sdx-a-flap${a}`} x="40" y="16" width="4" height="30" fill="#e2730a" opacity=".75" />
    </>
  );

  const ringBadge = (inner: JSX.Element) => (
    <>
      <circle cx="45" cy="45" r="12.5" fill={paint("ring")} />
      <circle cx="45" cy="45" r="9.5" fill={paint("disc")} />
      {inner}
    </>
  );

  const art = (() => {
    switch (stage) {
      case "submitted":
        return (
          <g className={`sdx-a-float${a}`}>
            <path d="M6 30 55 13 25 38Z" fill={paint("pinkWingBack")} />
            <path d="M55 13 21 38 26 52 32 46Z" fill={paint("blueFold")} />
            <path d="M55 13 38 53 28 42Z" fill={paint("pinkWing")} />
          </g>
        );

      case "pending": {
        // Sand levels are rects clipped to each half of the glass; moving a
        // rect raises or lowers the sand, so it drains and fills smoothly.
        const glass = "M22 15h20c0 9.5-7 11.5-7 17s7 7.5 7 17H22c0-9.5 7-11.5 7-17s-7-7.5-7-17Z";
        return (
          <g className={`sdx-a-turn${a}`}>
            <defs>
              <clipPath id={`${uid}-clip-glass`}>
                <path d={glass} />
              </clipPath>
              <clipPath id={`${uid}-clip-top`}>
                <rect x="16" y="15" width="32" height="17" />
              </clipPath>
              <clipPath id={`${uid}-clip-bottom`}>
                <rect x="16" y="32" width="32" height="17" />
              </clipPath>
            </defs>
            <path d={glass} fill={paint("glass")} />
            <g clipPath={`url(#${uid}-clip-glass)`}>
              <g clipPath={`url(#${uid}-clip-top)`}>
                <rect className={`sdx-a-sand-top${a}`} x="16" y="16" width="32" height="16" fill={paint("sand")} />
              </g>
              <g clipPath={`url(#${uid}-clip-bottom)`}>
                <rect className={`sdx-a-sand-bottom${a}`} x="16" y="32" width="32" height="16" fill={paint("sand")} />
              </g>
              <rect className={`sdx-a-stream${a}`} x="31.2" y="27" width="1.6" height="10" rx=".8" fill="#f58a07" />
            </g>
            <path d="M25.5 19c.4 4.6 2.6 7 4.2 9" stroke="#fff" strokeWidth="1.6" opacity=".8" {...round} />
            <rect x="17" y="9" width="30" height="5" rx="2.2" fill={paint("wood")} />
            <rect x="20" y="13.5" width="24" height="2.5" rx="1" fill="#5a3d33" />
            <rect x="20" y="48" width="24" height="2.5" rx="1" fill="#5a3d33" />
            <rect x="17" y="50" width="30" height="5" rx="2.2" fill={paint("wood")} />
          </g>
        );
      }

      case "approved":
        return (
          <>
            {documentStack}
            {ringBadge(
              <g className={`sdx-a-badge${a}`}>
                <circle cx="45" cy="45" r="9.5" fill={paint("check")} />
                <path d="m40.6 45.2 3.2 3.2 5.8-6.4" stroke="#fff" strokeWidth="2.8" {...round} />
              </g>
            )}
          </>
        );

      case "unpaid":
        return (
          <>
            <g className={`sdx-a-sway${a}`}>
              <g transform="rotate(-18 34 36)">
                <rect x="20" y="16" width="26" height="12" rx="2" fill="#0e8a3e" />
                <rect x="22" y="13" width="24" height="12" rx="2" fill={paint("bills")} />
                <rect x="16" y="22" width="34" height="28" rx="5" fill={paint("wallet")} />
                <rect x="40" y="30" width="12" height="11" rx="3.5" fill={paint("walletFlap")} />
                <circle cx="46" cy="35.5" r="1.7" fill="#ffd37a" />
              </g>
            </g>
            <g className={`sdx-a-pop${a}`}>
              <path d="M17 16.5 29.5 38.5h-25Z" fill={paint("warn")} stroke="#ec4d1d" strokeWidth="2.6" strokeLinejoin="round" />
              <rect x="15.9" y="23.5" width="2.4" height="8.2" rx="1.2" fill="#2b2b2b" />
              <circle cx="17.1" cy="34.6" r="1.5" fill="#2b2b2b" />
            </g>
          </>
        );

      case "paid":
        return (
          <>
            <defs>
              <clipPath id={`${uid}-slot`}>
                <rect x="0" y="17" width="64" height="47" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${uid}-slot)`}>
              <g className={`sdx-a-print${a}`}>
                <path
                  d="M17 14h30v33l-3.75 2.6-3.75-2.6-3.75 2.6-3.75-2.6-3.75 2.6-3.75-2.6-3.75 2.6-3.75-2.6Z"
                  fill={paint("receipt")}
                />
                <rect x="21" y="23" width="16" height="1.8" rx=".9" fill="#fff" />
                <rect x="21" y="27.5" width="16" height="1.8" rx=".9" fill="#fff" />
                <rect x="21" y="32" width="16" height="1.8" rx=".9" fill="#fff" />
                <rect x="39.5" y="23" width="3.5" height="1.8" rx=".9" fill="#fff" />
                <rect x="39.5" y="27.5" width="3.5" height="1.8" rx=".9" fill="#fff" />
                <rect x="39.5" y="32" width="3.5" height="1.8" rx=".9" fill="#fff" />
                <rect x="21" y="39" width="22" height="1.8" rx=".9" fill="#fff" />
              </g>
            </g>
            <rect x="11" y="11" width="42" height="7" rx="3.5" fill={paint("printer")} />
            <rect x="15" y="15.5" width="34" height="2.2" rx="1.1" fill="#0b86a8" />
          </>
        );

      case "processing":
        return (
          <>
            {/* Gear outline from Lucide "settings" (ISC licence), filled. */}
            <g className={`sdx-a-spin${a}`} style={{ transformOrigin: "25px 40px" }}>
              <path transform="translate(7 22) scale(1.5)" d={GEAR_PATH} fill={paint("gearBig")} />
              <circle cx="25" cy="40" r="8.6" fill="#a7f2fb" opacity=".7" />
              <path d="M25 40v-6.2M25 40l5.4 3.1M25 40l-5.4 3.1" stroke="#0fb3d1" strokeWidth="3" {...round} />
              <circle cx="25" cy="40" r="3.4" fill="#0fb3d1" />
            </g>
            <g className={`sdx-a-spin-rev${a}`} style={{ transformOrigin: "45px 20px" }}>
              <path transform="translate(34 9) scale(0.917)" d={GEAR_PATH} fill={paint("gearSmall")} />
              <circle cx="45" cy="20" r="4.6" fill="#2c0fb5" />
            </g>
          </>
        );

      case "ready":
        return (
          <>
            <g className={`sdx-a-bob${a}`}>{box}</g>
            <circle cx="45" cy="45" r="12" fill={paint("badge")} />
            <path className={`sdx-a-arrow${a}`} d="M41 41l8.5 8.5M41 41h6.4M41 41v6.4" stroke="#fff" strokeWidth="2.8" {...round} />
          </>
        );

      case "claimed":
        return (
          <>
            {box}
            {ringBadge(
              <g className={`sdx-a-badge${a}`}>
                <circle cx="45" cy="45" r="9.5" fill={paint("check")} />
                <path d="m40.6 45.2 3.2 3.2 5.8-6.4" stroke="#fff" strokeWidth="2.8" {...round} />
              </g>
            )}
          </>
        );

      case "stopped":
        return (
          <>
            {documentStack}
            <g className={`sdx-a-shake${a}`}>
              {ringBadge(
                <>
                  <circle cx="45" cy="45" r="9.5" fill={paint("cross")} />
                  <path d="m41.2 41.2 7.6 7.6M48.8 41.2l-7.6 7.6" stroke="#fff" strokeWidth="2.8" {...round} />
                </>
              )}
            </g>
          </>
        );
    }
  })();

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`sdx-stage-icon is-${stage}`}>
      <defs>
        {[...used].map((name) => (
          <linearGradient key={name} id={`${uid}-${name}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={PAINT[name][0]} />
            <stop offset="1" stopColor={PAINT[name][1]} />
          </linearGradient>
        ))}
      </defs>
      {art}
    </svg>
  );
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
  studentId,
  onClose,
  onViewReceipt,
}: {
  transaction: StudentTransaction;
  studentId: string;
  onClose: () => void;
  onViewReceipt?: () => void;
}) {
  const details = transaction.details || {};
  const isDocument = transaction.kind === "DOCUMENT";

  /* ---- Cancel (document requests, only while not yet paid) ---- */
  const canCancel =
    isDocument &&
    canStudentCancelDocumentRequest({
      status: transaction.status,
      payment_status: transaction.payment_status,
    });
  const isAlreadyPaid =
    isDocument && normalizeStatus(transaction.payment_status) === "PAID";
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelDone, setCancelDone] = useState(false);

  async function handleConfirmCancel() {
    setCancelBusy(true);
    setCancelError("");
    try {
      await cancelDocumentRequest(transaction.id, studentId, cancelReason);
      setCancelDone(true);
      setConfirmingCancel(false);
    } catch (error) {
      setCancelError(
        error instanceof Error
          ? error.message
          : "Could not cancel the request. Please try again."
      );
    } finally {
      setCancelBusy(false);
    }
  }
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

        {/* CANCEL REQUEST — only while not yet paid */}

        {cancelDone && (
          <div
            role="status"
            style={{
              marginTop: "16px",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#eef6f0",
              border: "1px solid #cfe3d4",
              color: "#2e602e",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Your request has been cancelled.
          </div>
        )}

        {canCancel && !cancelDone && (
          <div
            style={{
              marginTop: "16px",
              padding: "14px",
              borderRadius: "14px",
              background: "#fff7f6",
              border: "1px solid #f3d6d2",
            }}
          >
            {!confirmingCancel ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: "13px", color: "#7a4a44" }}>
                  You can still cancel this request because it hasn't been
                  paid yet.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingCancel(true);
                    setCancelError("");
                  }}
                  style={{
                    border: "1px solid #e3a9a1",
                    background: "#ffffff",
                    color: "#b2382b",
                    borderRadius: "10px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel request
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#7a2a20",
                  }}
                >
                  Cancel this request?
                </div>
                <div style={{ fontSize: "13px", color: "#7a4a44" }}>
                  This can't be undone. You'll need to submit a new request
                  if you change your mind.
                </div>
                <label
                  style={{
                    display: "grid",
                    gap: "6px",
                    fontSize: "12px",
                    color: "#7a4a44",
                  }}
                >
                  Reason (optional)
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="e.g. I no longer need this document"
                    style={{
                      font: "inherit",
                      fontSize: "13px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "1px solid #e3c4bf",
                      resize: "vertical",
                    }}
                  />
                </label>
                {cancelError && (
                  <div
                    role="alert"
                    style={{
                      fontSize: "13px",
                      color: "#b2382b",
                      fontWeight: 600,
                    }}
                  >
                    {cancelError}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    disabled={cancelBusy}
                    onClick={() => {
                      setConfirmingCancel(false);
                      setCancelError("");
                    }}
                    style={{
                      border: "1px solid #d5e1d8",
                      background: "#ffffff",
                      color: "#2e602e",
                      borderRadius: "10px",
                      padding: "8px 14px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Keep request
                  </button>
                  <button
                    type="button"
                    disabled={cancelBusy}
                    onClick={handleConfirmCancel}
                    style={{
                      border: 0,
                      background: "#b2382b",
                      color: "#ffffff",
                      borderRadius: "10px",
                      padding: "8px 14px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: cancelBusy ? "wait" : "pointer",
                      opacity: cancelBusy ? 0.7 : 1,
                    }}
                  >
                    {cancelBusy ? "Cancelling…" : "Yes, cancel it"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isAlreadyPaid &&
          !cancelDone &&
          ["APPROVED", "PROCESSING", "READY_FOR_PICKUP", "RESCHEDULED"].includes(
            normalizeStatus(transaction.status)
          ) && (
            <div
              style={{
                marginTop: "12px",
                fontSize: "12px",
                color: "#6f8b7a",
              }}
            >
              This request is already paid, so it can no longer be cancelled.
              For concerns, message the Registrar Office.
            </div>
          )}

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