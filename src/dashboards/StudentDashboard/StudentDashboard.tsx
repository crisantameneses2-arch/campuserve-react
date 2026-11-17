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

import { useNotifications } from "../../hooks/useNotifications";
import {
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
} from "../../utils/format";

import "./StudentDashboard.css";

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
  | "notifications";

type StudentTransaction = {
  key: string;
  id: string;
  kind: "DOCUMENT" | "ITEM";
  title: string;
  status: string;
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

  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort(
          (a, b) =>
            getTime(b.createdAt) - getTime(a.createdAt)
        )
        .slice(0, 4),
    [notifications]
  );

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

  function go(page: DashboardPage) {
    setMenuOpen(false);
    setActivePage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =========================================
     SUB PAGES
  ========================================= */

  if (activePage !== "dashboard") {
    return (
      <div className="student-dashboard">
        <DashboardHeader
          studentName={studentName}
          unreadNotifications={unreadNotifications}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onNavigate={go}
        />

        <div className="student-page-shell">
          <button
            className="dashboard-back"
            type="button"
            onClick={() => go("dashboard")}
          >
            ← Back to Dashboard
          </button>

          {activePage === "request" && (
            <DocumentRequestWizard studentId={studentId} />
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
            />
          )}
        </div>

        {selectedTransaction && (
          <TransactionDetailsModal
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
      </div>
    );
  }

  /* =========================================
     MAIN DASHBOARD
  ========================================= */

  return (
    <div className="student-dashboard">
      <DashboardHeader
        studentName={studentName}
        unreadNotifications={unreadNotifications}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={go}
      />

      <main className="dashboard-main">
        <div className="dashboard-content">

          {/* GROUP REQUEST */}

          {pendingInvites.length > 0 && (
            <button
              className="group-request-banner"
              type="button"
              onClick={() => go("requests")}
            >
              <span className="banner-icon">
                <Icon name="users" size={20} />
              </span>

              <span>
                <strong>Group document request</strong>

                <small>
                  You have {pendingInvites.length} request
                  {pendingInvites.length === 1 ? "" : "s"} waiting
                  for your response.
                </small>
              </span>

              <span className="banner-arrow">→</span>
            </button>
          )}

          {/* LIVE TRACKING */}

          <section className="tracking-card">
            <div className="tracking-card__header">
              <div>
                <span className="section-kicker">
                  LIVE TRACKING
                </span>

                <h1>
                  Document or Item Live Tracking
                </h1>

                <p className="tracking-subtitle">
                  Monitor your document requests and item reservations.
                </p>
              </div>

              {trackingTransactions.length > 0 && (
                <button
                  type="button"
                  className="tracking-history-button"
                  onClick={() => go("transactions")}
                >
                  View history →
                </button>
              )}
            </div>

            {transactionsLoading ? (
              <DashboardLoading />
            ) : trackingTransactions.length > 0 ? (
              <TrackingCarousel
                transactions={trackingTransactions}
                onSelect={setSelectedTransaction}
              />
            ) : (
              <div className="tracking-empty">
                <div className="tracking-empty__icon">
                  <Icon name="activity" size={26} />
                </div>

                <div>
                  <strong>No active transactions</strong>

                  <p>
                    Your document requests and item reservations
                    will appear here once submitted.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* SERVICE GRID */}

          <section className="dashboard-service-grid">

            {/* UPCOMING PICKUP */}

            <div className="dashboard-widget upcoming-widget">
              <WidgetHeader
                title="Upcoming Pick Up"
                action="View all"
                onAction={() => go("transactions")}
              />

              {transactionsLoading ? (
                <DashboardLoading />
              ) : upcomingTransactions.length === 0 ? (
                <EmptyWidget
                  icon="calendar"
                  title="Nothing scheduled yet"
                  text="Approved requests with a claiming date will appear here."
                />
              ) : (
                <div className="pickup-list">
                  {upcomingTransactions.map((transaction) => (
                    <button
                      className="pickup-row"
                      type="button"
                      key={transaction.key}
                      onClick={() =>
                        setSelectedTransaction(transaction)
                      }
                    >
                      <div className="pickup-date">
                        <strong>
                          {getDayNumber(transaction.date)}
                        </strong>

                        <span>
                          {getMonthName(transaction.date)}
                        </span>
                      </div>

                      <div className="pickup-info">
                        <strong>{transaction.title}</strong>

                        <span>
                          {formatClaimDate(transaction.date)}
                        </span>

                        <small>
                          {formatClaimTime(transaction.time)} ·{" "}
                          {getKindLabel(transaction.kind)}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SERVICES */}

            <div className="dashboard-actions-widget">
              <span className="section-kicker">SERVICES</span>

              <h2>What would you like to do?</h2>

              <ServiceAction
                icon="file"
                title="Request Document"
                text="Request certificates, copies and other school documents."
                onClick={() => go("request")}
              />

              <ServiceAction
                icon="bag"
                title="Item Reservation"
                text="Reserve available school items online."
                onClick={() => go("itemReservation")}
              />

              <ServiceAction
                icon="ticket"
                title="Claim & Release"
                text="Enter your claim stub when you are ready to claim."
                onClick={() => go("claimStub")}
              />
            </div>
          </section>

          {/* RECENT ACTIVITY */}

          <section className="recent-activity-card">
            <div className="widget-header">
              <div>
                <span className="section-kicker">
                  RECENT ACTIVITY
                </span>

                <h2>Recent Transactions</h2>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => go("transactions")}
              >
                View all →
              </button>
            </div>

            {transactionsLoading ? (
              <DashboardLoading />
            ) : transactions.length === 0 ? (
              <EmptyWidget
                icon="clock"
                title="No transactions yet"
                text="Your requests and reservations will appear here."
              />
            ) : (
              <div className="recent-transaction-list">
                {transactions.slice(0, 4).map((transaction) => (
                  <TransactionRow
                    key={transaction.key}
                    transaction={transaction}
                    onSelect={setSelectedTransaction}
                  />
                ))}
              </div>
            )}
          </section>

          {/* NOTIFICATIONS */}

          <section className="notification-strip">
            <div className="notification-strip__title">
              <span className="notification-strip__icon">
                <Icon name="bell" size={19} />
              </span>

              <div>
                <strong>Notifications</strong>

                <span>
                  {unreadNotifications > 0
                    ? `${unreadNotifications} unread update${unreadNotifications === 1 ? "" : "s"}`
                    : "You're all caught up"}
                </span>
              </div>
            </div>

            <div className="notification-strip__items">
              {notificationsLoading ? (
                <span>Loading...</span>
              ) : recentNotifications.length === 0 ? (
                <span>No new updates.</span>
              ) : (
                recentNotifications.slice(0, 2).map(
                  (notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        void handleNotificationClick(notification);
                        go("notifications");
                      }}
                    >
                      <strong>{notification.title}</strong>

                      <small>
                        {timeAgo(notification.createdAt)}
                      </small>
                    </button>
                  )
                )
              )}
            </div>

            <button
              type="button"
              className="notification-view-button"
              onClick={() => go("notifications")}
            >
              View notifications →
            </button>
          </section>
        </div>
      </main>

      {/* STOCK MODAL */}

      {stocksOpen && (
        <div
          className="stocks-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setStocksOpen(false);
            }
          }}
        >
          <div
            className="stocks-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="stocks-modal__header">
              <div>
                <span className="section-kicker">
                  LIVE INVENTORY
                </span>

                <h2>Item Stocks</h2>
              </div>

              <button
                type="button"
                className="modal-close"
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
        />
      )}
    </div>
  );
}

/* =========================================
   HEADER
========================================= */

function DashboardHeader({
  studentName,
  unreadNotifications,
  menuOpen,
  setMenuOpen,
  onNavigate,
}: {
  studentName: string;
  unreadNotifications: number;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onNavigate: (page: DashboardPage) => void;
}) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__inner">
        <button
          type="button"
          className="header-icon-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Open student menu"
          aria-expanded={menuOpen}
        >
          <Icon name="menu" size={20} />
        </button>

        <button
          type="button"
          className="brand"
          onClick={() => onNavigate("dashboard")}
        >
          CAMPUSERVE
        </button>

        <div className="header-actions">
          <button
            type="button"
            className="header-icon-button notification-button"
            onClick={() => onNavigate("notifications")}
            aria-label="Open notifications"
          >
            <Icon name="bell" size={18} />

            {unreadNotifications > 0 && (
              <span className="notification-count">
                {unreadNotifications > 9
                  ? "9+"
                  : unreadNotifications}
              </span>
            )}
          </button>

          <span className="header-user-name">
            {studentName}
          </span>
        </div>
      </div>

      {menuOpen && (
        <div className="dashboard-menu">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => onNavigate("request")}
          >
            Request Document
          </button>

          <button
            type="button"
            onClick={() => onNavigate("itemReservation")}
          >
            Item Reservation
          </button>

          <button
            type="button"
            onClick={() => onNavigate("claimStub")}
          >
            Claim & Release
          </button>

          <button
            type="button"
            onClick={() => onNavigate("transactions")}
          >
            Transaction History
          </button>

          <button
            type="button"
            onClick={() => onNavigate("notifications")}
          >
            Notifications
          </button>
        </div>
      )}
    </header>
  );
}

/* =========================================
   TRACKING CAROUSEL
========================================= */

function TrackingCarousel({
  transactions,
  onSelect,
}: {
  transactions: StudentTransaction[];
  onSelect: (transaction: StudentTransaction) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);

    if (carouselRef.current) {
      carouselRef.current.scrollTo({
        left: 0,
        behavior: "auto",
      });
    }
  }, [transactions.length]);

  function handleScroll() {
    const element = carouselRef.current;

    if (!element) return;

    const index = Math.round(
      element.scrollLeft / element.clientWidth
    );

    setActiveIndex(
      Math.max(0, Math.min(index, transactions.length - 1))
    );
  }

  function goToSlide(index: number) {
    const element = carouselRef.current;

    if (!element) return;

    element.scrollTo({
      left: index * element.clientWidth,
      behavior: "smooth",
    });

    setActiveIndex(index);
  }

  function previousSlide() {
    if (activeIndex > 0) {
      goToSlide(activeIndex - 1);
    }
  }

  function nextSlide() {
    if (activeIndex < transactions.length - 1) {
      goToSlide(activeIndex + 1);
    }
  }

  return (
    <div className="tracking-carousel">
      <div
        className="tracking-carousel__viewport"
        ref={carouselRef}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            previousSlide();
          }

          if (event.key === "ArrowRight") {
            nextSlide();
          }
        }}
        tabIndex={0}
        aria-label="Transaction tracking carousel"
      >
        {transactions.map((transaction) => (
          <div
            className="tracking-carousel__slide"
            key={transaction.key}
          >
            <div
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
              style={{ cursor: "pointer" }}
            >
              <TrackingContent transaction={transaction} />
            </div>
          </div>
        ))}
      </div>

      {transactions.length > 1 && (
        <div className="tracking-carousel__controls">
          <button
            type="button"
            className="tracking-carousel__arrow"
            onClick={previousSlide}
            disabled={activeIndex === 0}
            aria-label="Previous transaction"
          >
            ←
          </button>

          <div className="tracking-carousel__dots">
            {transactions.map((transaction, index) => (
              <button
                key={transaction.key}
                type="button"
                className={`tracking-carousel__dot ${activeIndex === index ? "active" : ""}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to transaction ${index + 1}`}
                aria-current={
                  activeIndex === index ? "true" : undefined
                }
              />
            ))}
          </div>

          <span className="tracking-carousel__counter">
            {activeIndex + 1} / {transactions.length}
          </span>

          <button
            type="button"
            className="tracking-carousel__arrow"
            onClick={nextSlide}
            disabled={activeIndex === transactions.length - 1}
            aria-label="Next transaction"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function TrackingContent({
  transaction,
}: {
  transaction: StudentTransaction;
}) {
  const status = normalizeStatus(transaction.status);
  const showClaimingDetails =
    status === "APPROVED" || status === "CLAIMED";

  /*
    TRACKING PROGRESS BASED ONLY ON STATUS

    UNPAID   = 0
    PENDING  = 1
    PAID     = 2
    APPROVED = 3
    CLAIMED  = 4
  */

  let activeIndex = 0;

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

  return (
    <div className="tracking-content">

      {/* TRANSACTION INFORMATION */}

      <div className="tracking-summary">
        <div className="tracking-type-icon">
          <Icon
            name={
              transaction.kind === "DOCUMENT"
                ? "file"
                : "bag"
            }
            size={24}
          />
        </div>

        <div className="tracking-summary__text">
          <span>
            {transaction.kind === "DOCUMENT"
              ? "DOCUMENT REQUEST"
              : "ITEM RESERVATION"}
          </span>

          <strong>{transaction.title}</strong>

          <small>ID: {transaction.id}</small>
        </div>

        <StatusBadge status={status} large />
      </div>

      {/* CURRENT STATUS AND CLAIMING CODE */}

      <div className="tracking-details">
        <div className="tracking-detail-item">
          <span>Current Status</span>
          <strong>{status.replace(/_/g, " ")}</strong>
        </div>

        {showClaimingDetails && transaction.claimCode && (
          <div className="tracking-detail-item">
            <span>Claiming Code</span>
            <strong>{transaction.claimCode}</strong>
          </div>
        )}
      </div>

      {/* TRACKING PROGRESS LINE */}

      <div className="tracking-progress">
        {TRACKING_STEPS.map((step, index) => {
          const complete = index < activeIndex;
          const current = index === activeIndex;

          return (
            <div
              className={`tracking-step ${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}
              key={step}
            >
              <span className="tracking-step__dot">
                {complete ? "✓" : index + 1}
              </span>

              <span>
                {step.charAt(0) + step.slice(1).toLowerCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* CLAIMING SCHEDULE */}

      {showClaimingDetails && (
        <div className="tracking-pickup">
          <div>
            <span>Claiming Schedule</span>

            <strong>
              {transaction.date
                ? formatClaimDate(transaction.date)
                : "Schedule pending"}
            </strong>
          </div>

          {transaction.time && (
            <strong>{formatClaimTime(transaction.time)}</strong>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================
   WIDGET HEADER
========================================= */

function WidgetHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="widget-header">
      <h2>{title}</h2>

      <button
        type="button"
        className="text-button"
        onClick={onAction}
      >
        {action} →
      </button>
    </div>
  );
}

/* =========================================
   SERVICE ACTION
========================================= */

function ServiceAction({
  icon,
  title,
  text,
  onClick,
}: {
  icon: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="service-action"
      onClick={onClick}
    >
      <span className="service-action__icon">
        <Icon name={icon} size={21} />
      </span>

      <span className="service-action__content">
        <strong>{title}</strong>
        <small>{text}</small>
      </span>

      <span className="service-action__arrow">→</span>
    </button>
  );
}

/* =========================================
   TRANSACTION ROW
========================================= */

function TransactionRow({
  transaction,
  onSelect,
}: {
  transaction: StudentTransaction;
  onSelect: (transaction: StudentTransaction) => void;
}) {
  const status = normalizeStatus(transaction.status);

  return (
    <div
      className="transaction-row"
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
      style={{ cursor: "pointer" }}
    >
      <span className="transaction-row__icon">
        <Icon
          name={
            transaction.kind === "DOCUMENT"
              ? "file"
              : "bag"
          }
          size={18}
        />
      </span>

      <div className="transaction-row__main">
        <strong>{transaction.title}</strong>

        <span>
          {getKindLabel(transaction.kind)} · ID {transaction.id}
        </span>
      </div>

      <StatusBadge status={status} />

      {transaction.claimCode && (
        <span className="transaction-claim-code">
          Claiming Code: {transaction.claimCode}
        </span>
      )}

      <span className="transaction-row__date">
        {transaction.date
          ? formatClaimDate(transaction.date)
          : timeAgo(transaction.createdAt)}
      </span>
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
    <section className="page-card">
      <PageHeading
        eyebrow="TRANSACTIONS"
        title="Transaction History"
        text="Every document request and item reservation."
      />

      {loading ? (
        <DashboardLoading />
      ) : transactions.length === 0 ? (
        <EmptyWidget
          icon="clock"
          title="No transactions yet"
          text="Your requests and reservations will appear here."
        />
      ) : (
        <div className="recent-transaction-list">
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
  );
}

/* =========================================
   TRANSACTION DETAILS MODAL
========================================= */

function TransactionDetailsModal({
  transaction,
  onClose,
}: {
  transaction: StudentTransaction;
  onClose: () => void;
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
    background: "rgba(15, 23, 42, 0.62)",
  };

  const panelStyle: CSSProperties = {
    width: "min(680px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    color: "#1f2937",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
  };

  const sectionStyle: CSSProperties = {
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
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
            color: "#6b7280",
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
                color: "#64748b",
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

            <div style={{ color: "#64748b", fontSize: "13px" }}>
              Transaction ID: {transaction.id}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close transaction details"
            style={{
              border: 0,
              background: "#f1f5f9",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              fontSize: "23px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: "16px" }}>
          <StatusBadge
            status={normalizeStatus(transaction.status)}
            large
          />
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
                  label="Payment Status"
                  value={details.payment_status}
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
                        border: "1px solid #e5e7eb",
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
              borderRadius: "8px",
              padding: "10px 18px",
              background: "#1e3a8a",
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
}: {
  notifications: AppNotification[];
  loading: boolean;
  studentId: string;
  onNotificationClick: (
    notification: AppNotification
  ) => Promise<void>;
}) {
  return (
    <section className="page-card">
      <PageHeading
        eyebrow="UPDATES"
        title="Notifications"
        text="Updates about your requests, reservations and claiming schedule."
      />

      {loading ? (
        <DashboardLoading />
      ) : notifications.length === 0 ? (
        <EmptyWidget
          icon="bell"
          title="You're all caught up"
          text="New updates will appear here."
        />
      ) : (
        <div className="notification-page-list">
          {notifications.map((notification) => {
            const unread = !notification.readBy.includes(
              studentId
            );

            return (
              <button
                type="button"
                className={`notification-page-row ${unread ? "is-unread" : ""}`}
                key={notification.id}
                onClick={() => {
                  void onNotificationClick(notification);
                }}
              >
                <span className="notification-page-row__icon">
                  <Icon name="bell" size={18} />
                </span>

                <span className="notification-page-row__body">
                  <strong>{notification.title}</strong>

                  <span>{notification.message}</span>

                  <small>
                    {timeAgo(notification.createdAt)}
                  </small>
                </span>

                {unread && <span className="unread-dot" />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
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
    <div className="page-heading">
      <span className="section-kicker">{eyebrow}</span>
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
    <div className="empty-widget">
      <span className="empty-widget__icon">
        <Icon name={icon} size={22} />
      </span>

      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

/* =========================================
   LOADING
========================================= */

function DashboardLoading() {
  return (
    <div className="dashboard-loading">
      <span className="dashboard-spinner" />
      <span>Loading...</span>
    </div>
  );
}

/* =========================================
   STATUS BADGE
========================================= */

function StatusBadge({
  status,
  large = false,
}: {
  status: string;
  large?: boolean;
}) {
  return (
    <span
      className={`status-badge status-badge--${status.toLowerCase()} ${large ? "status-badge--large" : ""}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* =========================================
   HELPERS
========================================= */

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