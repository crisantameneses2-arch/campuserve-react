import "./AdminDashboard.css";

import { useEffect, useState } from "react";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../../../firebase";

import UserAccounts from "./UserAccounts";
import RolesPermissions from "./RolesPermissions";
import DocumentRequests from "./DocumentRequests";
import ItemReservations from "./ItemReservations";
import ReportsAnalytics from "./ReportsAnalytics";
import ActivityLogs from "./ActivityLogs";
import SystemSettings from "./SystemSettings";

type RecordData = {
  id: string;
  [key: string]: unknown;
};

type AdminAccount = {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  firebaseUid?: string;
  student_id?: string;
};

type AdminDashboardProps = {
  account: AdminAccount;
};

function AdminDashboard({
  account,
}: AdminDashboardProps) {
  /* =====================================================
     STATE
  ===================================================== */

  const [selectedCollection, setSelectedCollection] =
    useState("");

  const [showDeletedAccounts, setShowDeletedAccounts] =
    useState(false);

  const [records, setRecords] =
    useState<RecordData[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showProfile, setShowProfile] =
    useState(false);

  /*
    Controls which admin page is currently displayed.
  */
  const [currentPage, setCurrentPage] =
    useState("dashboard");

    const [dashboardStats, setDashboardStats] = useState({
  totalStudents: 0,
  pendingRequests: 0,
  activeReservations: 0,
  systemAlerts: 0,
});

const [statsLoading, setStatsLoading] = useState(false);

const loadDashboardStats = async () => {
  setStatsLoading(true);

  try {
    // ==============================
    // TOTAL STUDENTS
    // ==============================
    const accountsSnapshot = await getDocs(
      collection(db, "accounts")
    );

    const totalStudents = accountsSnapshot.docs.filter(
      (document) => {
        const data = document.data();

        return (
          data.role === "student" &&
          data.status !== "deleted"
        );
      }
    ).length;

    // ==============================
    // PENDING DOCUMENT REQUESTS
    // ==============================
    const requestsSnapshot = await getDocs(
      collection(db, "documentRequests")
    );

    const pendingRequests =
      requestsSnapshot.docs.filter((document) => {
        const data = document.data();

        const status = String(
          data.status ?? data.Status ?? ""
        ).toLowerCase();

        return status === "pending";
      }).length;

    // ==============================
    // ACTIVE ITEM RESERVATIONS
    // ==============================
    const reservationsSnapshot = await getDocs(
      collection(db, "itemReservations")
    );

    const activeReservations =
      reservationsSnapshot.docs.filter((document) => {
        const data = document.data();

        const status = String(
          data.status ?? data.Status ?? ""
        ).toLowerCase();

        return (
          status === "active" ||
          status === "approved"
        );
      }).length;

    // ==============================
    // SYSTEM ALERTS
    // ==============================
    const notificationsSnapshot = await getDocs(
      collection(db, "notifications")
    );

    const systemAlerts =
      notificationsSnapshot.docs.filter((document) => {
        const data = document.data();

        return (
          data.Is_Read === false ||
          data.isRead === false
        );
      }).length;

    // ==============================
    // UPDATE DASHBOARD
    // ==============================
    setDashboardStats({
      totalStudents,
      pendingRequests,
      activeReservations,
      systemAlerts,
    });
  } catch (error) {
    console.error(
      "Error loading dashboard statistics:",
      error
    );
  } finally {
    setStatsLoading(false);
  }
};

useEffect(() => {
  if (currentPage === "dashboard") {
    loadDashboardStats();
  }
}, [currentPage]);

  /* =====================================================
     FIRESTORE COLLECTIONS
  ===================================================== */

  const collections = [
    "accounts",
    "documentRequests",
    "groupRequestMembers",
    "documentRequestDetails",
    "itemReservations",
    "itemReservationDetails",
    "inventoryItems",
    "requestScheduling",
    "claimingSchedules",
    "claimingReleases",
    "transactionHistory",
    "notifications",
    "messages",
    "activityLogs",
    "reports",
  ];


  /* =====================================================
     RETRIEVE FIRESTORE DATA
  ===================================================== */

  const handleRetrieve = async (
    deletedView = showDeletedAccounts
  ) => {
    if (!selectedCollection) {
      setError("Please select a collection.");
      return;
    }

    setError("");
    setLoading(true);
    setRecords([]);

    try {
      const snapshot = await getDocs(
        collection(db, selectedCollection)
      );

      const data: RecordData[] =
        snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

      /*
        For the accounts collection:
        - Active Accounts = everything except deleted
        - Deleted Accounts = status === deleted

        Other collections are displayed normally.
      */
      const filteredRecords =
        selectedCollection === "accounts"
          ? data.filter((record) =>
              deletedView
                ? record.status === "deleted"
                : record.status !== "deleted"
            )
          : data;

      setRecords(filteredRecords);

    } catch (error) {
      console.error(
        "Error retrieving data:",
        error
      );

      setError(
        "Failed to retrieve data from Firestore."
      );

    } finally {
      setLoading(false);
    }
  };


  /* =====================================================
     DISPLAY FIRESTORE VALUES
  ===================================================== */

  const displayValue = (
    value: unknown
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    if (
      typeof value === "object"
    ) {
      try {
        return JSON.stringify(value);
      } catch {
        return "[Object]";
      }
    }

    return String(value);
  };


  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <div className="admin-dashboard">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="admin-sidebar">

        <div className="sidebar-logo">
          <h2>CampuServe</h2>
          <span>Administrator</span>
        </div>


        <nav className="sidebar-navigation">

          {/* ================= DASHBOARD ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "dashboard"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("dashboard")
            }
          >
            <span>▣</span>
            Dashboard
          </button>


          {/* ================= USER ACCOUNTS ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "userAccounts"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("userAccounts")
            }
          >
            <span>👤</span>
            User accounts
          </button>


          {/* ================= ROLES & PERMISSIONS ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "rolesPermissions"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("rolesPermissions")
            }
          >
            <span>🔐</span>
            Roles & permissions
          </button>


          {/* ================= DOCUMENT REQUESTS ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "documentRequests"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("documentRequests")
            }
          >
            <span>📄</span>
            Document requests
          </button>


          {/* ================= ITEM RESERVATIONS ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "itemReservations"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("itemReservations")
            }
          >
            <span>📦</span>
            Item reservations
          </button>


          {/* ================= REPORTS & ANALYTICS ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "reportsAnalytics"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("reportsAnalytics")
            }
          >
            <span>📊</span>
            Reports & analytics
          </button>


          {/* ================= ACTIVITY LOGS ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "activityLogs"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("activityLogs")
            }
          >
            <span>📝</span>
            Activity logs
          </button>


          {/* ================= SYSTEM SETTINGS ================= */}

          <button
            className={`sidebar-item ${
              currentPage === "systemSettings"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setCurrentPage("systemSettings")
            }
          >
            <span>⚙</span>
            System settings
          </button>

        </nav>

      </aside>


      {/* =================================================
          MAIN AREA
      ================================================= */}

      <main className="admin-main">


        {/* =================================================
            HEADER
        ================================================= */}

        <header className="admin-header">

          <div>

            <h1>
              Administrator Dashboard
            </h1>

            <p>
              Manage CampuServe system data
              and users.
            </p>

          </div>


          {/* ================= PROFILE ================= */}

          <div className="admin-profile-container">

            <button
              className="admin-profile-button"
              onClick={() =>
                setShowProfile(
                  !showProfile
                )
              }
            >

              <span className="profile-avatar">
                👤
              </span>

              <span>
                Administrator
              </span>

              <span>
                ▾
              </span>

            </button>


            {/* PROFILE DROPDOWN */}

            {showProfile && (
              <div className="profile-panel">

                <div className="profile-panel-header">

                  <div className="profile-panel-icon">
                    👤
                  </div>

                  <div>

                    <strong>
                      {account.name ||
                        "Administrator"}
                    </strong>

                    <span>
                      Administrator
                    </span>

                  </div>

                </div>


                <div className="profile-details">

                  <div>

                    <small>
                      Email
                    </small>

                    <p>
                      {account.email}
                    </p>

                  </div>


                  <div>

                    <small>
                      Role
                    </small>

                    <p>
                      {account.role}
                    </p>

                  </div>


                  <div>

                    <small>
                      Status
                    </small>

                    <p>
                      {account.status}
                    </p>

                  </div>

                </div>

              </div>
            )}

          </div>

        </header>


        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="admin-content">


          {/* =================================================
              USER ACCOUNTS
          ================================================= */}

          {currentPage === "userAccounts" ? (

            <UserAccounts />


          /* =================================================
             ROLES & PERMISSIONS
          ================================================= */

          ) : currentPage === "rolesPermissions" ? (

            <RolesPermissions />


          /* =================================================
             DOCUMENT REQUESTS
          ================================================= */

          ) : currentPage === "documentRequests" ? (

            <DocumentRequests />


          /* =================================================
             ITEM RESERVATIONS
          ================================================= */

          ) : currentPage === "itemReservations" ? (

            <ItemReservations />


          /* =================================================
             REPORTS & ANALYTICS
          ================================================= */

          ) : currentPage === "reportsAnalytics" ? (

            <ReportsAnalytics />


          /* =================================================
             ACTIVITY LOGS
          ================================================= */

          ) : currentPage === "activityLogs" ? (

            <ActivityLogs />


          /* =================================================
             SYSTEM SETTINGS
          ================================================= */

          ) : currentPage === "systemSettings" ? (

            <SystemSettings />


          /* =================================================
             DASHBOARD
          ================================================= */

          ) : (

            <>


              {/* ================= DESCRIPTION ================= */}

              <p className="dashboard-description">
                View and monitor CampuServe system data.
              </p>


              {/* =================================================
                  SUMMARY CARDS
              ================================================= */}

              <section className="dashboard-summary">

  <div className="dashboard-summary-card">
    <span>Total Students</span>

    <strong>
      {statsLoading
        ? "..."
        : dashboardStats.totalStudents}
    </strong>
  </div>

  <div className="dashboard-summary-card">
    <span>Pending Requests</span>

    <strong>
      {statsLoading
        ? "..."
        : dashboardStats.pendingRequests}
    </strong>
  </div>

  <div className="dashboard-summary-card">
    <span>Active Reservations</span>

    <strong>
      {statsLoading
        ? "..."
        : dashboardStats.activeReservations}
    </strong>
  </div>

  <div className="dashboard-summary-card">
    <span>System Alerts</span>

    <strong>
      {statsLoading
        ? "..."
        : dashboardStats.systemAlerts}
    </strong>
  </div>

</section>


              {/* =================================================
                  RETRIEVE SYSTEM DATA
              ================================================= */}

              <section className="retrieve-data-section">


                <div className="retrieve-data-header">

                  <div>

                    <h3>
                      Retrieve System Data
                    </h3>

                    <p>
                      Search and view records from the CampuServe system.
                    </p>

                  </div>

                </div>


                {/* ================= SEARCH BAR ================= */}

                <div className="retrieve-search-bar">


                  <span className="retrieve-search-icon">
                    🔍
                  </span>


                  <select
                    value={selectedCollection}
                    onChange={(event) => {

                      setSelectedCollection(
                        event.target.value
                      );

                      setRecords([]);
                      setError("");

                    }}
                  >

                    <option value="">
                      Select collection...
                    </option>


                    {collections.map(
                      (collectionName) => (

                        <option
                          key={collectionName}
                          value={collectionName}
                        >
                          {collectionName}
                        </option>

                      )
                    )}

                  </select>


                  <button
                    onClick={() =>
                      handleRetrieve()
                    }
                    disabled={
                      loading ||
                      !selectedCollection
                    }
                  >

                    {loading
                      ? "Loading..."
                      : "Retrieve Data"}

                  </button>


                </div>


                {/* =================================================
                    ACCOUNT FILTERS
                ================================================= */}

                {selectedCollection ===
                  "accounts" && (

                  <div className="account-filter-buttons">


                    {/* ACTIVE ACCOUNTS */}

                    <button
                      className={
                        !showDeletedAccounts
                          ? "active-filter"
                          : ""
                      }
                      onClick={() => {

                        setShowDeletedAccounts(
                          false
                        );

                        handleRetrieve(false);

                      }}
                    >
                      Active Accounts
                    </button>


                    {/* DELETED ACCOUNTS */}

                    <button
                      className={
                        showDeletedAccounts
                          ? "active-filter"
                          : ""
                      }
                      onClick={() => {

                        setShowDeletedAccounts(
                          true
                        );

                        handleRetrieve(true);

                      }}
                    >
                      Deleted Accounts
                    </button>


                  </div>

                )}

              </section>


              {/* =================================================
                  ERROR MESSAGE
              ================================================= */}

              {error && (

                <div className="retrieve-error">

                  <strong>
                    Error:
                  </strong>{" "}

                  {error}

                </div>

              )}


              {/* =================================================
                  RETRIEVED RECORDS
              ================================================= */}

              {records.length > 0 && (

                <section className="retrieved-records-section">


                  {/* ================= RECORD HEADER ================= */}

                  <div className="retrieved-records-header">


                    <div>

                      <h3>
                        Retrieved Records
                      </h3>

                      <p>
                        Collection:{" "}

                        <strong>
                          {selectedCollection}
                        </strong>

                      </p>

                    </div>


                    <span className="records-count">

                      {records.length} records

                    </span>


                  </div>


                  {/* ================= TABLE ================= */}

                  <div className="retrieved-table-container">

                    <table className="retrieved-data-table">


                      {/* TABLE HEADER */}

                      <thead>

                        <tr>


                          {selectedCollection ===
                          "accounts" ? (

                            <>

                              <th>
                                Name
                              </th>

                              <th>
                                Email
                              </th>

                              <th>
                                Role
                              </th>

                              <th>
                                Status
                              </th>

                              <th>
                                Student ID
                              </th>

                            </>

                          ) : (

                            Object.keys(records[0])

                              .filter(
                                (key) =>
                                  key !== "id"
                              )

                              .map((key) => (

                                <th key={key}>
                                  {key}
                                </th>

                              ))

                          )}


                        </tr>

                      </thead>


                      {/* TABLE BODY */}

                      <tbody>


                        {records.map(
                          (record) => (

                            <tr
                              key={record.id}
                            >


                              {/* ================= ACCOUNTS ================= */}

                              {selectedCollection ===
                              "accounts" ? (

                                <>


                                  <td>
                                    {displayValue(
                                      record.name
                                    )}
                                  </td>


                                  <td>
                                    {displayValue(
                                      record.email
                                    )}
                                  </td>


                                  <td>
                                    {displayValue(
                                      record.role
                                    )}
                                  </td>


                                  <td>

                                    <span
                                      className={`table-status ${String(
                                        record.status || ""
                                      )}`}
                                    >

                                      {displayValue(
                                        record.status
                                      )}

                                    </span>

                                  </td>


                                  <td>
                                    {displayValue(
                                      record.student_id
                                    )}
                                  </td>


                                </>


                              /* ================= OTHER COLLECTIONS ================= */

                              ) : (

                                Object.entries(
                                  record
                                )

                                  .filter(
                                    ([key]) =>
                                      key !== "id"
                                  )

                                  .map(
                                    ([
                                      key,
                                      value,
                                    ]) => (

                                      <td
                                        key={key}
                                      >
                                        {displayValue(
                                          value
                                        )}
                                      </td>

                                    )
                                  )

                              )}


                            </tr>

                          )
                        )}


                      </tbody>


                    </table>

                  </div>


                </section>

              )}


              {/* =================================================
                  NO RESULTS
              ================================================= */}

              {selectedCollection &&
                records.length === 0 &&
                !loading &&
                !error && (

                  <div className="no-records-message">

                    No records found.

                  </div>

                )}


            </>

          )}

        </div>

      </main>

    </div>
  );
}

export default AdminDashboard;