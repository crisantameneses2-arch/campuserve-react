import "./AdminDashboard.css";

import { useState } from "react";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../../../firebase";

import UserAccounts from "./UserAccounts";

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

  const [currentPage, setCurrentPage] =
    useState("dashboard");

  const collections = [
    "accounts",
    "document_requests",
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

  return (
    <div className="admin-dashboard">

      {/* SIDEBAR */}
      <aside className="admin-sidebar">

        <div className="sidebar-logo">
          <h2>CampuServe</h2>
          <span>Administrator</span>
        </div>

        <nav className="sidebar-navigation">

          {/* Dashboard */}
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

          {/* User Accounts */}
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

          {/* Roles & Permissions */}
          <button
            className="sidebar-item"
          >
            <span>🔐</span>
            Roles & permissions
          </button>

          {/* Document Requests */}
          <button
            className="sidebar-item"
          >
            <span>📄</span>
            Document requests
          </button>

          {/* Item Reservations */}
          <button
            className="sidebar-item"
          >
            <span>📦</span>
            Item reservations
          </button>

          {/* Reports & Analytics */}
          <button
            className="sidebar-item"
          >
            <span>📊</span>
            Reports & analytics
          </button>

          {/* Activity Logs */}
          <button
            className="sidebar-item"
          >
            <span>📝</span>
            Activity logs
          </button>

          {/* System Settings */}
          <button
            className="sidebar-item"
          >
            <span>⚙</span>
            System settings
          </button>

        </nav>

      </aside>

      {/* MAIN AREA */}
      <main className="admin-main">

        {/* HEADER */}
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
                      {account.email ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <small>
                      Role
                    </small>

                    <p>
                      {account.role ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <small>
                      Status
                    </small>

                    <p>
                      {account.status ||
                        "—"}
                    </p>
                  </div>

                </div>

              </div>
            )}

          </div>

        </header>

        {/* CONTENT */}
        <div className="admin-content">

          {currentPage === "userAccounts" ? (

            <UserAccounts />

          ) : (

            <>

              {/* DASHBOARD INTRODUCTION */}
              <p className="dashboard-description">
                View and monitor CampuServe
                system data.
              </p>


              {/* SUMMARY CARDS */}
              <section className="dashboard-summary">

                <div className="dashboard-summary-card">
                  <span>
                    Total Students
                  </span>

                  <strong>
                    0
                  </strong>
                </div>


                <div className="dashboard-summary-card">
                  <span>
                    Pending Requests
                  </span>

                  <strong>
                    0
                  </strong>
                </div>


                <div className="dashboard-summary-card">
                  <span>
                    Active Reservations
                  </span>

                  <strong>
                    0
                  </strong>
                </div>


                <div className="dashboard-summary-card">
                  <span>
                    System Alerts
                  </span>

                  <strong>
                    0
                  </strong>
                </div>

              </section>


              {/* RETRIEVE DATA */}
              <section className="retrieve-data-section">

                <div className="retrieve-data-header">

                  <div>
                    <h3>
                      Retrieve System Data
                    </h3>

                    <p>
                      Search and view records
                      from the CampuServe system.
                    </p>
                  </div>

                </div>


                {/* SEARCH-STYLE RETRIEVE BAR */}
                <div className="retrieve-search-bar">

                  <span className="retrieve-search-icon">
                    🔍
                  </span>

                  <select
                    value={
                      selectedCollection
                    }
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
                          key={
                            collectionName
                          }
                          value={
                            collectionName
                          }
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


                {/* ACCOUNT FILTERS */}
                {selectedCollection ===
                  "accounts" && (

                  <div className="account-filter-buttons">

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

                        handleRetrieve(
                          false
                        );

                      }}
                    >
                      Active Accounts
                    </button>


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

                        handleRetrieve(
                          true
                        );

                      }}
                    >
                      Deleted Accounts
                    </button>

                  </div>

                )}

              </section>


              {/* ERROR */}
              {error && (

                <div className="retrieve-error">

                  <strong>
                    Error:
                  </strong>{" "}

                  {error}

                </div>

              )}


              {/* RETRIEVED RECORDS */}
              {records.length > 0 && (

                <section className="retrieved-records-section">

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
                      {records.length}{" "}
                      {records.length === 1
                        ? "record"
                        : "records"}
                    </span>

                  </div>


                  <div className="retrieved-table-container">

                    <table className="retrieved-data-table">

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

                            Object.keys(
                              records[0]
                            )
                              .filter(
                                (key) =>
                                  key !==
                                  "id"
                              )
                              .map(
                                (key) => (
                                  <th
                                    key={
                                      key
                                    }
                                  >
                                    {key}
                                  </th>
                                )
                              )

                          )}

                        </tr>

                      </thead>


                      <tbody>

                        {records.map(
                          (record) => (

                            <tr
                              key={
                                record.id
                              }
                            >

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
                                      className={`table-status ${
                                        record.status
                                      }`}
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

                              ) : (

                                Object.entries(
                                  record
                                )
                                  .filter(
                                    ([key]) =>
                                      key !==
                                      "id"
                                  )
                                  .map(
                                    ([
                                      key,
                                      value,
                                    ]) => (

                                      <td
                                        key={
                                          key
                                        }
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


              {/* NO RESULTS */}
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