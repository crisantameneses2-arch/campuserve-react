import "./AdminDashboard.css";

import { useState } from "react";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../firebase";

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
  // ==============================
  // RETRIEVE DATA
  // ==============================

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

  // ==============================
  // CREATE ACCOUNT
  // ==============================

  const [createStudentId, setCreateStudentId] =
    useState("");

  const [createName, setCreateName] =
    useState("");

  const [createEmail, setCreateEmail] =
    useState("");

  const [createRole, setCreateRole] =
    useState("student");

  const [createStatus, setCreateStatus] =
    useState("active");

  const [createMessage, setCreateMessage] =
    useState("");

  // ==============================
  // UPDATE ACCOUNT
  // ==============================

  const [editingId, setEditingId] =
    useState("");

  const [updateId, setUpdateId] =
    useState("");

  const [updateStudentId, setUpdateStudentId] =
    useState("");

  const [updateName, setUpdateName] =
    useState("");

  const [updateEmail, setUpdateEmail] =
    useState("");

  const [updateRole, setUpdateRole] =
    useState("student");

  const [updateStatus, setUpdateStatus] =
    useState("active");

  const [updateMessage, setUpdateMessage] =
    useState("");

  const [showProfile, setShowProfile] =
  useState(false);

  // ==============================
  // COLLECTIONS
  // ==============================

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

  // ==============================
  // RETRIEVE DATA
  // ==============================

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

  // ==============================
  // CREATE ACCOUNT
  // ==============================

const handleCreateAccount = async () => {
  setError("");
  setCreateMessage("");

  if (
    !createName ||
    !createEmail ||
    !createRole ||
    !createStatus
  ) {
    setError(
      "Please fill in all required fields."
    );
    return;
  }

  if (
    createRole === "student" &&
    !createStudentId
  ) {
    setError(
      "Student ID is required for student accounts."
    );
    return;
  }

  try {
    const normalizedEmail =
      createEmail.trim().toLowerCase();

    const accountData: Record<string, string> = {
      name: createName.trim(),
      email: normalizedEmail,
      role: createRole,
      status: createStatus,
    };

    if (createRole === "student") {
      accountData.student_id =
        createStudentId.trim();
    }

    // Use the email as the Firestore document ID
    const accountRef = doc(
      db,
      "accounts",
      normalizedEmail
    );

    await setDoc(
      accountRef,
      accountData
    );

    setCreateMessage(
      "Account pre-registered successfully."
    );

    setCreateStudentId("");
    setCreateName("");
    setCreateEmail("");
    setCreateRole("student");
    setCreateStatus("active");

  } catch (error) {
    console.error(
      "Error creating account:",
      error
    );

    setError(
      "Failed to create account."
    );
  }
};

  // ==============================
  // SELECT ACCOUNT FOR UPDATE
  // ==============================

  const handleSelectForUpdate = (
    record: RecordData
  ) => {
    setUpdateId(record.id);

    setUpdateStudentId(
      typeof record.student_id === "string"
        ? record.student_id
        : ""
    );

    setUpdateName(
      typeof record.name === "string"
        ? record.name
        : ""
    );

    setUpdateEmail(
      typeof record.email === "string"
        ? record.email
        : ""
    );

    setUpdateRole(
      typeof record.role === "string"
        ? record.role
        : "student"
    );

    setUpdateStatus(
      typeof record.status === "string"
        ? record.status
        : "active"
    );

    setUpdateMessage("");
  };

  // ==============================
  // UPDATE ACCOUNT
  // ==============================

  const handleUpdateAccount = async () => {
    setError("");
    setUpdateMessage("");

    if (!updateId) {
      setError(
        "Please select an account to update."
      );
      return;
    }

    if (
      !updateName ||
      !updateEmail ||
      !updateRole ||
      !updateStatus
    ) {
      setError(
        "Please fill in all required fields."
      );
      return;
    }

    if (
      updateRole === "student" &&
      !updateStudentId
    ) {
      setError(
        "Student ID is required for student accounts."
      );
      return;
    }

    try {
      const accountRef = doc(
        db,
        "accounts",
        updateId
      );

      const accountData: Record<string, string> = {
        name: updateName,
        email: updateEmail,
        role: updateRole,
        status: updateStatus,
      };

      if (updateRole === "student") {
        accountData.student_id =
          updateStudentId;
      }

      await updateDoc(
        accountRef,
        accountData
      );

      setUpdateMessage(
        "Account updated successfully."
      );

      setEditingId("");

      if (selectedCollection === "accounts") {
        await handleRetrieve();
      }

    } catch (error) {
      console.error(
        "Error updating account:",
        error
      );

      setError(
        "Failed to update account."
      );
    }
  };

  // ==============================
  // SOFT DELETE ACCOUNT
  // ==============================

  const handleDeleteAccount = async (
    accountId: string
  ) => {
    const confirmed = window.confirm(
      "Are you sure you want to move this account to Deleted Accounts?"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setCreateMessage("");
    setUpdateMessage("");

    try {
      await updateDoc(
        doc(db, "accounts", accountId),
        {
          status: "deleted",
          deletedAt: new Date(),
        }
      );

      if (editingId === accountId) {
        setEditingId("");
      }

      setCreateMessage(
        "Account moved to Deleted Accounts."
      );

      if (selectedCollection === "accounts") {
        await handleRetrieve();
      }

    } catch (error) {
      console.error(
        "Error deleting account:",
        error
      );

      setError(
        "Failed to move account to Deleted Accounts."
      );
    }
  };

  // ==============================
  // RESTORE ACCOUNT
  // ==============================

  const handleRestoreAccount = async (
    accountId: string
  ) => {
    const confirmed = window.confirm(
      "Restore this account?"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setCreateMessage("");
    setUpdateMessage("");

    try {
      await updateDoc(
        doc(db, "accounts", accountId),
        {
          status: "active",
        }
      );

      setCreateMessage(
        "Account restored successfully."
      );

      if (selectedCollection === "accounts") {
        await handleRetrieve(true);
      }

    } catch (error) {
      console.error(
        "Error restoring account:",
        error
      );

      setError(
        "Failed to restore account."
      );
    }
  };

  // ==============================
  // DISPLAY RECORD VALUE
  // ==============================

  const displayValue = (
    value: unknown
  ) => {
    if (value === null || value === undefined) {
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

  // ==============================
  // UI
  // ==============================

  return (
  <div className="admin-layout">

    <aside className="admin-sidebar">

      <div className="sidebar-logo">
        CampuServe
      </div>

      <nav className="sidebar-nav">

        <button className="sidebar-item active">
          <span>▣</span>
          Dashboard
        </button>

        <button className="sidebar-item">
          <span>👤</span>
          User accounts
        </button>

        <button className="sidebar-item">
          <span>🛡</span>
          Roles & permissions
        </button>

        <button className="sidebar-item">
          <span>📄</span>
          Document requests
        </button>

        <button className="sidebar-item">
          <span>📦</span>
          Item reservations
        </button>

        <button className="sidebar-item">
          <span>📊</span>
          Reports & analytics
        </button>

        <button className="sidebar-item">
          <span>📝</span>
          Activity logs
        </button>

        <button className="sidebar-item">
          <span>⚙</span>
          System settings
        </button>

      </nav>

    </aside>

    <main className="admin-main">

      <header className="admin-header">
        <div>
          <h1>Administrator Dashboard</h1>
          <p>Manage CampuServe system data and users.</p>
        </div>

        <div className="admin-profile">
  <button
    className="profile-button"
    onClick={() =>
      setShowProfile(!showProfile)
    }
  >
    <span className="profile-icon">
      👤
    </span>

    <span className="profile-name">
      Administrator
    </span>

    <span className="profile-arrow">
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
            {account.name || "Administrator"}
          </strong>

          <span>
            Administrator
          </span>
        </div>
      </div>

      <div className="profile-details">

        <div>
          <small>Email</small>
          <p>{account.email}</p>
        </div>

        <div>
          <small>Role</small>
          <p>{account.role}</p>
        </div>

        <div>
          <small>Status</small>
          <p>{account.status}</p>
        </div>

      </div>

    </div>
  )}
</div>
      </header>

      <div className="admin-content">

      <p>
        Manage CampuServe accounts and
        system data.
      </p>

      <hr />

      {/* ==========================
          CREATE ACCOUNT
      ========================== */}

      <section>
        <h3>Create Account</h3>

        <div>
          <label>
            Student ID:
          </label>

          <input
            type="text"
            value={createStudentId}
            onChange={(event) =>
              setCreateStudentId(
                event.target.value
              )
            }
            placeholder="Student ID"
          />
        </div>

        <br />

        <div>
          <label>
            Name:
          </label>

          <input
            type="text"
            value={createName}
            onChange={(event) =>
              setCreateName(
                event.target.value
              )
            }
            placeholder="Full Name"
          />
        </div>

        <br />

        <div>
          <label>
            Email:
          </label>

          <input
            type="email"
            value={createEmail}
            onChange={(event) =>
              setCreateEmail(
                event.target.value
              )
            }
            placeholder="Email"
          />
        </div>

        <br />

        <div>
          <label>
            Role:
          </label>

          <select
            value={createRole}
            onChange={(event) =>
              setCreateRole(
                event.target.value
              )
            }
          >
            <option value="student">
              Student
            </option>

            <option value="admin">
              Administrator
            </option>

            <option value="registrar">
              Registrar
            </option>

            <option value="general_office">
              General Office
            </option>
          </select>
        </div>

        <br />

        <div>
          <label>
            Status:
          </label>

          <select
            value={createStatus}
            onChange={(event) =>
              setCreateStatus(
                event.target.value
              )
            }
          >
            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>

        <br />

        <button
          onClick={handleCreateAccount}
        >
          Create Account
        </button>

        {createMessage && (
          <p>
            {createMessage}
          </p>
        )}
      </section>

      <hr />

      {/* ==========================
          RETRIEVE DATA
      ========================== */}

      <section>
        <h3>Retrieve Data</h3>

        <select
          value={selectedCollection}
          onChange={(event) =>
            setSelectedCollection(
              event.target.value
            )
          }
        >
          <option value="">
            -- Select Collection --
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
          disabled={loading}
        >
          {loading
            ? "Loading..."
            : "Retrieve Data"}
        </button>

        {selectedCollection ===
          "accounts" && (
          <div>
            <br />

            <button
              onClick={() => {
                setShowDeletedAccounts(
                  false
                );

                handleRetrieve(false);
              }}
            >
              Active Accounts
            </button>

            <button
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

      <br />

      {/* ==========================
          ERROR MESSAGE
      ========================== */}

      {error && (
        <div>
          <p>
            <strong>
              Error:
            </strong>{" "}
            {error}
          </p>
        </div>
      )}

      {/* ==========================
          RECORDS
      ========================== */}

      {records.length > 0 && (
        <section>
          <h3>
            Retrieved Records
          </h3>

          <p>
            Collection:{" "}
            <strong>
              {selectedCollection}
            </strong>
          </p>

          <p>
            Records found:{" "}
            {records.length}
          </p>

          {records.map(
            (record) => (
              <div
                key={record.id}
                style={{
                  border:
                    "1px solid #ccc",
                  padding: "15px",
                  marginBottom: "15px",
                }}
              >

                {/* ==================
                    ACCOUNT RECORD
                ================== */}

                {selectedCollection ===
                  "accounts" ? (
                  <div>

                    <p>
                      <strong>
                        Document ID:
                      </strong>{" "}
                      {record.id}
                    </p>

                    {editingId ===
                    record.id ? (
                      <div>

                        <h4>
                          Edit Account
                        </h4>

                        <div>
                          <label>
                            Student ID:
                          </label>

                          <input
                            type="text"
                            value={
                              updateStudentId
                            }
                            onChange={(
                              event
                            ) =>
                              setUpdateStudentId(
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </div>

                        <br />

                        <div>
                          <label>
                            Name:
                          </label>

                          <input
                            type="text"
                            value={
                              updateName
                            }
                            onChange={(
                              event
                            ) =>
                              setUpdateName(
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </div>

                        <br />

                        <div>
                          <label>
                            Email:
                          </label>

                          <input
                            type="email"
                            value={
                              updateEmail
                            }
                            onChange={(
                              event
                            ) =>
                              setUpdateEmail(
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </div>

                        <br />

                        <div>
                          <label>
                            Role:
                          </label>

                          <select
                            value={
                              updateRole
                            }
                            onChange={(
                              event
                            ) =>
                              setUpdateRole(
                                event
                                  .target
                                  .value
                              )
                            }
                          >
                            <option value="student">
                              Student
                            </option>

                            <option value="admin">
                              Administrator
                            </option>

                            <option value="registrar">
                              Registrar
                            </option>

                            <option value="general_office">
                              General Office
                            </option>
                          </select>
                        </div>

                        <br />

                        <div>
                          <label>
                            Status:
                          </label>

                          <select
                            value={
                              updateStatus
                            }
                            onChange={(
                              event
                            ) =>
                              setUpdateStatus(
                                event
                                  .target
                                  .value
                              )
                            }
                          >
                            <option value="active">
                              Active
                            </option>

                            <option value="inactive">
                              Inactive
                            </option>

                            <option value="deleted">
                              Deleted
                            </option>
                          </select>
                        </div>

                        <br />

                        <button
                          onClick={
                            handleUpdateAccount
                          }
                        >
                          Save Changes
                        </button>

                        <button
                          onClick={() => {
                            setEditingId("");
                            setUpdateMessage("");
                          }}
                        >
                          Cancel
                        </button>

                        {updateMessage && (
                          <p>
                            {
                              updateMessage
                            }
                          </p>
                        )}

                      </div>
                    ) : (
                      <div>

                        <p>
                          <strong>
                            Student ID:
                          </strong>{" "}
                          {displayValue(
                            record.student_id
                          )}
                        </p>

                        <p>
                          <strong>
                            Name:
                          </strong>{" "}
                          {displayValue(
                            record.name
                          )}
                        </p>

                        <p>
                          <strong>
                            Email:
                          </strong>{" "}
                          {displayValue(
                            record.email
                          )}
                        </p>

                        <p>
                          <strong>
                            Role:
                          </strong>{" "}
                          {displayValue(
                            record.role
                          )}
                        </p>

                        <p>
                          <strong>
                            Status:
                          </strong>{" "}
                          {displayValue(
                            record.status
                          )}
                        </p>

                        <button
                          onClick={() => {
                            handleSelectForUpdate(
                              record
                            );

                            setEditingId(
                              record.id
                            );
                          }}
                        >
                          Edit
                        </button>

                        {record.status ===
                        "deleted" ? (
                          <button
                            onClick={() =>
                              handleRestoreAccount(
                                record.id
                              )
                            }
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleDeleteAccount(
                                record.id
                              )
                            }
                          >
                            Delete
                          </button>
                        )}

                      </div>
                    )}

                  </div>
                ) : (

                  /* ==================
                     OTHER COLLECTIONS
                  ================== */

                  <div>

                    <p>
                      <strong>
                        Document ID:
                      </strong>{" "}
                      {record.id}
                    </p>

                    {Object.entries(
                      record
                    ).map(
                      ([key, value]) => {
                        if (
                          key === "id"
                        ) {
                          return null;
                        }

                        return (
                          <p
                            key={key}
                          >
                            <strong>
                              {key}:
                            </strong>{" "}
                            {displayValue(
                              value
                            )}
                          </p>
                        );
                      }
                    )}

                  </div>
                )}

              </div>
            )
          )}

        </section>
      )}

      {selectedCollection &&
        records.length === 0 &&
        !loading && (
          <p>
            No records found.
          </p>
        )}

          </div>

    </main>

  </div>
);
}
export default AdminDashboard;