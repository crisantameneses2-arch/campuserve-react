import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
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
  createdAt: unknown;
};

type InventoryItem = {
  id: string;
  itemName: string;
  size?: string;
  availableOnline?: number;
  totalStock?: number;
  status?: string;
};

const ACTIVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "RESCHEDULED",
];

const TRACKING_STEPS = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "COMPLETED",
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

  /* -------------------------------------------
     DOCUMENT REQUESTS
  ------------------------------------------- */

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
              id: String(
                data.request_id || document.id
              ),
              kind: "DOCUMENT",
              title: String(
                data.purpose || "Document Request"
              ),
              status: String(
                data.status || "PENDING"
              ),
              date: String(
                data.requested_date || ""
              ),
              time: String(
                data.requested_time || ""
              ),
              createdAt: data.created_at,
            };
          })
        );

        setDocumentsLoading(false);
      },
      (error) => {
        console.warn(
          "Could not load document transactions:",
          error
        );

        setDocumentTransactions([]);
        setDocumentsLoading(false);
      }
    );
  }, [studentId]);

  /* -------------------------------------------
     ITEM RESERVATIONS
  ------------------------------------------- */

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
              id: String(
                data.reservationId || document.id
              ),
              kind: "ITEM",
              title: String(
                data.itemName || "Item Reservation"
              ),
              status: String(
                data.status || "PENDING"
              ),
              date: String(
                data.requestedDate || ""
              ),
              time: String(
                data.requestedTime || ""
              ),
              createdAt: data.createdAt,
            };
          })
        );

        setItemsLoading(false);
      },
      (error) => {
        console.warn(
          "Could not load item reservations:",
          error
        );

        setItemTransactions([]);
        setItemsLoading(false);
      }
    );
  }, [studentId]);

  /* -------------------------------------------
     COMBINED TRANSACTIONS
  ------------------------------------------- */

  const transactions = useMemo(
    () =>
      [
        ...documentTransactions,
        ...itemTransactions,
      ].sort(
        (a, b) =>
          getTime(b.createdAt) -
          getTime(a.createdAt)
      ),
    [
      documentTransactions,
      itemTransactions,
    ]
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

  /* -------------------------------------------
     LIVE TRACKING TRANSACTION
  ------------------------------------------- */

  const trackingTransaction = useMemo(() => {
    const priority = [
      "READY_FOR_PICKUP",
      "PROCESSING",
      "APPROVED",
      "RESCHEDULED",
      "PENDING",
    ];

    for (const status of priority) {
      const found = transactions.find(
        (transaction) =>
          normalizeStatus(
            transaction.status
          ) === status
      );

      if (found) {
        return found;
      }
    }

    return transactions[0] ?? null;
  }, [transactions]);

  /* -------------------------------------------
     UPCOMING TRANSACTIONS
  ------------------------------------------- */

  const upcomingTransactions = useMemo(
    () =>
      [...activeTransactions]
        .filter(
          (transaction) =>
            Boolean(transaction.date)
        )
        .sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(
            `${b.date} ${b.time}`
          )
        )
        .slice(0, 3),
    [activeTransactions]
  );

  /* -------------------------------------------
     NOTIFICATIONS
  ------------------------------------------- */

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
  } = useNotifications(
    notificationAudience,
    studentId
  );

  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort(
          (a, b) =>
            getTime(b.createdAt) -
            getTime(a.createdAt)
        )
        .slice(0, 4),
    [notifications]
  );

  /* -------------------------------------------
     GROUP REQUESTS
  ------------------------------------------- */

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
        (invite) =>
          invite.status === "PENDING"
      ),
    [groupInvites]
  );

  /* -------------------------------------------
     LIVE INVENTORY
  ------------------------------------------- */

  const [inventory, setInventory] =
    useState<InventoryItem[]>([]);

  const [inventoryLoading, setInventoryLoading] =
    useState(true);

  useEffect(() => {
    const inventoryQuery = query(
      collection(db, "inventory"),
      orderBy("itemName")
    );

    return onSnapshot(
      inventoryQuery,
      (snapshot) => {
        setInventory(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<
              InventoryItem,
              "id"
            >),
          }))
        );

        setInventoryLoading(false);
      },
      (error) => {
        console.warn(
          "Could not load live stock:",
          error
        );

        setInventory([]);
        setInventoryLoading(false);
      }
    );
  }, []);

  const liveStocks = useMemo(
    () =>
      inventory
        .filter(
          (item) =>
            Number(
              item.availableOnline ?? 0
            ) > 0
        )
        .slice(0, 4),
    [inventory]
  );

  /* -------------------------------------------
     NOTIFICATION CLICK
  ------------------------------------------- */

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

  /* -------------------------------------------
     NAVIGATION
  ------------------------------------------- */

  function go(page: DashboardPage) {
    setMenuOpen(false);
    setActivePage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* -------------------------------------------
     SUB PAGES
  ------------------------------------------- */

  if (activePage !== "dashboard") {
    return (
      <div className="student-dashboard">
        <DashboardHeader
          studentName={studentName}
          unreadNotifications={
            unreadNotifications
          }
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
            <DocumentRequestWizard
              studentId={studentId}
            />
          )}

          {activePage === "requests" && (
            <DocumentRequestList
              studentId={studentId}
            />
          )}

          {activePage ===
            "itemReservation" && (
            <ItemReservation
              studentId={studentId}
              onBack={() =>
                go("dashboard")
              }
            />
          )}

          {activePage === "claimStub" && (
            <ClaimStubPage
              studentId={studentId}
              onBack={() =>
                go("dashboard")
              }
            />
          )}

          {activePage ===
            "transactions" && (
            <TransactionHistory
              transactions={transactions}
              loading={transactionsLoading}
            />
          )}

          {activePage ===
            "notifications" && (
            <NotificationPage
              notifications={notifications}
              loading={notificationsLoading}
              studentId={studentId}
              onNotificationClick={
                handleNotificationClick
              }
            />
          )}
        </div>
      </div>
    );
  }

  /* -------------------------------------------
     MAIN DASHBOARD
  ------------------------------------------- */

  return (
    <div className="student-dashboard">
      <DashboardHeader
        studentName={studentName}
        unreadNotifications={
          unreadNotifications
        }
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
              onClick={() =>
                go("requests")
              }
            >
              <span className="banner-icon">
                <Icon
                  name="users"
                  size={20}
                />
              </span>

              <span>
                <strong>
                  Group document request
                </strong>

                <small>
                  You have{" "}
                  {pendingInvites.length}{" "}
                  request
                  {pendingInvites.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  waiting for your response.
                </small>
              </span>

              <span className="banner-arrow">
                →
              </span>
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
                  Document or Item Live
                  Tracking
                </h1>
              </div>

              {trackingTransaction && (
                <button
                  type="button"
                  className="tracking-history-button"
                  onClick={() =>
                    go("transactions")
                  }
                >
                  View history →
                </button>
              )}
            </div>

            {transactionsLoading ? (
              <DashboardLoading />
            ) : trackingTransaction ? (
              <TrackingContent
                transaction={
                  trackingTransaction
                }
              />
            ) : (
              <div className="tracking-empty">
                <div className="tracking-empty__icon">
                  <Icon
                    name="activity"
                    size={26}
                  />
                </div>

                <div>
                  <strong>
                    No active transaction
                  </strong>

                  <p>
                    Your current document
                    requests and item
                    reservations will appear
                    here with live status
                    updates.
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
                onAction={() =>
                  go("transactions")
                }
              />

              {transactionsLoading ? (
                <DashboardLoading />
              ) : upcomingTransactions.length ===
                0 ? (
                <EmptyWidget
                  icon="calendar"
                  title="Nothing scheduled yet"
                  text="Approved requests with a claiming date will appear here."
                />
              ) : (
                <div className="pickup-list">
                  {upcomingTransactions.map(
                    (transaction) => (
                      <button
                        className="pickup-row"
                        type="button"
                        key={
                          transaction.key
                        }
                        onClick={() =>
                          go(
                            "transactions"
                          )
                        }
                      >
                        <div className="pickup-date">
                          <strong>
                            {getDayNumber(
                              transaction.date
                            )}
                          </strong>

                          <span>
                            {getMonthName(
                              transaction.date
                            )}
                          </span>
                        </div>

                        <div className="pickup-info">
                          <strong>
                            {
                              transaction.title
                            }
                          </strong>

                          <span>
                            {formatClaimDate(
                              transaction.date
                            )}
                          </span>

                          <small>
                            {formatClaimTime(
                              transaction.time
                            )}{" "}
                            ·{" "}
                            {getKindLabel(
                              transaction.kind
                            )}
                          </small>
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* LIVE STOCKS */}

            <div className="dashboard-widget stocks-widget">
              <WidgetHeader
                title="Live Stocks"
                action="View all"
                onAction={() =>
                  setStocksOpen(true)
                }
              />

              <p className="widget-description">
                Check available items before
                making a reservation.
              </p>

              {inventoryLoading ? (
                <DashboardLoading />
              ) : liveStocks.length === 0 ? (
                <EmptyWidget
                  icon="box"
                  title="No online stock available"
                  text="Inventory will appear here when items are available for online reservation."
                />
              ) : (
                <div className="stock-widget-list">
                  {liveStocks.map((item) => (
                    <div
                      className="stock-widget-row"
                      key={item.id}
                    >
                      <div>
                        <strong>
                          {item.itemName}
                        </strong>

                        {item.size && (
                          <small>
                            Size: {item.size}
                          </small>
                        )}
                      </div>

                      <span>
                        {Number(
                          item.availableOnline ??
                            0
                        )}

                        <small>
                          {" "}
                          online
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="widget-secondary-button"
                onClick={() =>
                  setStocksOpen(true)
                }
              >
                View complete inventory
              </button>
            </div>

            {/* SERVICES */}

            <div className="dashboard-actions-widget">
              <span className="section-kicker">
                SERVICES
              </span>

              <h2>
                What would you like to
                do?
              </h2>

              <ServiceAction
                icon="file"
                title="Request Document"
                text="Request certificates, copies and other school documents."
                onClick={() =>
                  go("request")
                }
              />

              <ServiceAction
                icon="bag"
                title="Item Reservation"
                text="Reserve available school items online."
                onClick={() =>
                  go(
                    "itemReservation"
                  )
                }
              />

              <ServiceAction
                icon="ticket"
                title="Claim & Release"
                text="Enter your claim stub when you are ready to claim."
                onClick={() =>
                  go("claimStub")
                }
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

                <h2>
                  Recent Transactions
                </h2>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() =>
                  go("transactions")
                }
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
                {transactions
                  .slice(0, 4)
                  .map(
                    (transaction) => (
                      <TransactionRow
                        key={
                          transaction.key
                        }
                        transaction={
                          transaction
                        }
                      />
                    )
                  )}
              </div>
            )}
          </section>

          {/* NOTIFICATIONS */}

          <section className="notification-strip">
            <div className="notification-strip__title">
              <span className="notification-strip__icon">
                <Icon
                  name="bell"
                  size={19}
                />
              </span>

              <div>
                <strong>
                  Notifications
                </strong>

                <span>
                  {unreadNotifications >
                  0
                    ? `${unreadNotifications} unread update${
                        unreadNotifications ===
                        1
                          ? ""
                          : "s"
                      }`
                    : "You're all caught up"}
                </span>
              </div>
            </div>

            <div className="notification-strip__items">
              {notificationsLoading ? (
                <span>
                  Loading...
                </span>
              ) : recentNotifications.length ===
                0 ? (
                <span>
                  No new updates.
                </span>
              ) : (
                recentNotifications
                  .slice(0, 2)
                  .map(
                    (notification) => (
                      <button
                        key={
                          notification.id
                        }
                        type="button"
                        onClick={() => {
                          void handleNotificationClick(
                            notification
                          );

                          go(
                            "notifications"
                          );
                        }}
                      >
                        <strong>
                          {
                            notification.title
                          }
                        </strong>

                        <small>
                          {timeAgo(
                            notification.createdAt
                          )}
                        </small>
                      </button>
                    )
                  )
              )}
            </div>

            <button
              type="button"
              className="notification-view-button"
              onClick={() =>
                go("notifications")
              }
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
            if (
              event.target ===
              event.currentTarget
            ) {
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

                <h2>
                  Item Stocks
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setStocksOpen(false)
                }
                aria-label="Close inventory"
              >
                ×
              </button>
            </div>

            <ItemStocks />
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------
   HEADER
------------------------------------------- */

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
  onNavigate: (
    page: DashboardPage
  ) => void;
}) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__inner">
        <button
          type="button"
          className="header-icon-button"
          onClick={() =>
            setMenuOpen(!menuOpen)
          }
          aria-label="Open student menu"
          aria-expanded={menuOpen}
        >
          <Icon
            name="menu"
            size={20}
          />
        </button>

        <button
          type="button"
          className="brand"
          onClick={() =>
            onNavigate("dashboard")
          }
        >
          CAMPUSERVE
        </button>

        <div className="header-actions">
          <button
            type="button"
            className="header-icon-button notification-button"
            onClick={() =>
              onNavigate(
                "notifications"
              )
            }
            aria-label="Open notifications"
          >
            <Icon
              name="bell"
              size={18}
            />

            {unreadNotifications >
              0 && (
              <span className="notification-count">
                {unreadNotifications >
                9
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
            onClick={() =>
              onNavigate("dashboard")
            }
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigate("request")
            }
          >
            Request Document
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                "itemReservation"
              )
            }
          >
            Item Reservation
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigate("claimStub")
            }
          >
            Claim & Release
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                "transactions"
              )
            }
          >
            Transaction History
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                "notifications"
              )
            }
          >
            Notifications
          </button>
        </div>
      )}
    </header>
  );
}

/* -------------------------------------------
   TRACKING
------------------------------------------- */

function TrackingContent({
  transaction,
}: {
  transaction: StudentTransaction;
}) {
  const status = normalizeStatus(
    transaction.status
  );

  const statusIndex =
    TRACKING_STEPS.indexOf(status);

  const activeIndex =
    statusIndex >= 0
      ? statusIndex
      : 0;

  return (
    <div className="tracking-content">
      <div className="tracking-summary">
        <div className="tracking-type-icon">
          <Icon
            name={
              transaction.kind ===
              "DOCUMENT"
                ? "file"
                : "bag"
            }
            size={24}
          />
        </div>

        <div className="tracking-summary__text">
          <span>
            {transaction.kind ===
            "DOCUMENT"
              ? "DOCUMENT REQUEST"
              : "ITEM RESERVATION"}
          </span>

          <strong>
            {transaction.title}
          </strong>

          <small>
            ID: {transaction.id}
          </small>
        </div>

        <StatusBadge
          status={status}
          large
        />
      </div>

      <div className="tracking-progress">
        {TRACKING_STEPS.map(
          (step, index) => {
            const complete =
              index < activeIndex;

            const current =
              index === activeIndex;

            return (
              <div
                className={`tracking-step ${
                  complete
                    ? "is-complete"
                    : ""
                } ${
                  current
                    ? "is-current"
                    : ""
                }`}
                key={step}
              >
                <span className="tracking-step__dot">
                  {complete
                    ? "✓"
                    : index + 1}
                </span>

                <span>
                  {formatTrackingLabel(
                    step
                  )}
                </span>
              </div>
            );
          }
        )}
      </div>

      {(transaction.date ||
        transaction.time) && (
        <div className="tracking-pickup">
          <div>
            <span>
              Claiming schedule
            </span>

            <strong>
              {transaction.date
                ? formatClaimDate(
                    transaction.date
                  )
                : "Schedule pending"}
            </strong>
          </div>

          {transaction.time && (
            <strong>
              {formatClaimTime(
                transaction.time
              )}
            </strong>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------
   WIDGET HEADER
------------------------------------------- */

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

/* -------------------------------------------
   SERVICE ACTION
------------------------------------------- */

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
        <Icon
          name={icon}
          size={21}
        />
      </span>

      <span className="service-action__content">
        <strong>{title}</strong>

        <small>{text}</small>
      </span>

      <span className="service-action__arrow">
        →
      </span>
    </button>
  );
}

/* -------------------------------------------
   TRANSACTION ROW
------------------------------------------- */

function TransactionRow({
  transaction,
}: {
  transaction: StudentTransaction;
}) {
  const status = normalizeStatus(
    transaction.status
  );

  return (
    <div className="transaction-row">
      <span className="transaction-row__icon">
        <Icon
          name={
            transaction.kind ===
            "DOCUMENT"
              ? "file"
              : "bag"
          }
          size={18}
        />
      </span>

      <div className="transaction-row__main">
        <strong>
          {transaction.title}
        </strong>

        <span>
          {getKindLabel(
            transaction.kind
          )}{" "}
          · ID {transaction.id}
        </span>
      </div>

      <StatusBadge status={status} />

      <span className="transaction-row__date">
        {transaction.date
          ? formatClaimDate(
              transaction.date
            )
          : timeAgo(
              transaction.createdAt
            )}
      </span>
    </div>
  );
}

/* -------------------------------------------
   TRANSACTION HISTORY
------------------------------------------- */

function TransactionHistory({
  transactions,
  loading,
}: {
  transactions: StudentTransaction[];
  loading: boolean;
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
          {transactions.map(
            (transaction) => (
              <TransactionRow
                key={transaction.key}
                transaction={
                  transaction
                }
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------
   NOTIFICATION PAGE
------------------------------------------- */

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
          {notifications.map(
            (notification) => {
              const unread =
                !notification.readBy.includes(
                  studentId
                );

              return (
                <button
                  type="button"
                  className={`notification-page-row ${
                    unread
                      ? "is-unread"
                      : ""
                  }`}
                  key={notification.id}
                  onClick={() => {
                    void onNotificationClick(
                      notification
                    );
                  }}
                >
                  <span className="notification-page-row__icon">
                    <Icon
                      name="bell"
                      size={18}
                    />
                  </span>

                  <span className="notification-page-row__body">
                    <strong>
                      {
                        notification.title
                      }
                    </strong>

                    <span>
                      {
                        notification.message
                      }
                    </span>

                    <small>
                      {timeAgo(
                        notification.createdAt
                      )}
                    </small>
                  </span>

                  {unread && (
                    <span className="unread-dot" />
                  )}
                </button>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------
   PAGE HEADING
------------------------------------------- */

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
      <span className="section-kicker">
        {eyebrow}
      </span>

      <h1>{title}</h1>

      <p>{text}</p>
    </div>
  );
}

/* -------------------------------------------
   EMPTY WIDGET
------------------------------------------- */

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
        <Icon
          name={icon}
          size={22}
        />
      </span>

      <strong>{title}</strong>

      <p>{text}</p>
    </div>
  );
}

/* -------------------------------------------
   LOADING
------------------------------------------- */

function DashboardLoading() {
  return (
    <div className="dashboard-loading">
      <span className="dashboard-spinner" />
      <span>Loading...</span>
    </div>
  );
}

/* -------------------------------------------
   STATUS BADGE
------------------------------------------- */

function StatusBadge({
  status,
  large = false,
}: {
  status: string;
  large?: boolean;
}) {
  return (
    <span
      className={`status-badge status-badge--${status.toLowerCase()} ${
        large
          ? "status-badge--large"
          : ""
      }`}
    >
      {status.replace(
        /_/g,
        " "
      )}
    </span>
  );
}

/* -------------------------------------------
   HELPERS
------------------------------------------- */

function getKindLabel(
  kind: StudentTransaction["kind"]
) {
  return kind === "DOCUMENT"
    ? "Document Request"
    : "Item Reservation";
}

function formatTrackingLabel(
  status: string
) {
  switch (status) {
    case "PENDING":
      return "Submitted";

    case "APPROVED":
      return "Approved";

    case "PROCESSING":
      return "Processing";

    case "READY_FOR_PICKUP":
      return "Ready";

    case "COMPLETED":
      return "Completed";

    default:
      return status.replace(
        /_/g,
        " "
      );
  }
}

function getTime(
  value: unknown
): number {
  if (!value) return 0;

  const firebaseValue =
    value as {
      toDate?: () => Date;
      seconds?: number;
    };

  if (
    typeof firebaseValue.toDate ===
    "function"
  ) {
    return firebaseValue
      .toDate()
      .getTime();
  }

  if (
    typeof firebaseValue.seconds ===
    "number"
  ) {
    return (
      firebaseValue.seconds *
      1000
    );
  }

  const date = new Date(
    value as string | number
  );

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function getDayNumber(
  date: string
): string {
  if (!date) return "—";

  const parsed = new Date(
    `${date}T00:00:00`
  );

  return Number.isNaN(
    parsed.getTime()
  )
    ? "—"
    : String(parsed.getDate());
}

function getMonthName(
  date: string
): string {
  if (!date) return "";

  const parsed = new Date(
    `${date}T00:00:00`
  );

  return Number.isNaN(
    parsed.getTime()
  )
    ? ""
    : parsed.toLocaleDateString(
        "en-US",
        {
          month: "short",
        }
      );
}

/* -------------------------------------------
   ICONS
------------------------------------------- */

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
    strokeLinecap:
      "round" as const,
    strokeLinejoin:
      "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "menu":
      return (
        <svg {...common}>
          <line
            x1="4"
            y1="6"
            x2="20"
            y2="6"
          />

          <line
            x1="4"
            y1="12"
            x2="20"
            y2="12"
          />

          <line
            x1="4"
            y1="18"
            x2="20"
            y2="18"
          />
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

          <line
            x1="8"
            y1="13"
            x2="16"
            y2="13"
          />

          <line
            x1="8"
            y1="17"
            x2="16"
            y2="17"
          />
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
          <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="2"
          />

          <line
            x1="16"
            y1="2"
            x2="16"
            y2="6"
          />

          <line
            x1="8"
            y1="2"
            x2="8"
            y2="6"
          />

          <line
            x1="3"
            y1="10"
            x2="21"
            y2="10"
          />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="12"
            r="9"
          />

          <polyline points="12 7 12 12 15 14" />
        </svg>
      );

    case "box":
      return (
        <svg {...common}>
          <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />

          <path d="M3 7.5V17l9 4 9-4V7.5" />

          <path d="M12 12v9" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />

          <circle
            cx="9"
            cy="7"
            r="4"
          />

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
          <circle
            cx="12"
            cy="12"
            r="9"
          />
        </svg>
      );
  }
}