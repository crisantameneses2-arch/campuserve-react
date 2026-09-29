import "./AdminDashboard.css";

import { useState } from "react";
import {
addDoc,
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../../../firebase";

type RecordData = {
  id: string;
  [key: string]: unknown;
};

function AdminDashboard() {
  const [selectedCollection, setSelectedCollection] =
    useState("");

  const [records, setRecords] =
    useState<RecordData[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

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

  const handleRetrieve = async () => {
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

      const data: RecordData[] = snapshot.docs.map(
        (document) => ({
          id: document.id,
          ...document.data(),
        })
      );

      setRecords(data);
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
      const accountData: Record<string, string> = {
        name: createName,
        email: createEmail,
        role: createRole,
        status: createStatus,
      };

      if (createRole === "student") {
        accountData.student_id =
          createStudentId;
      }

      await addDoc(
        collection(db, "accounts"),
        accountData
      );

      setCreateMessage(
        "Account created successfully."
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

  return (
    <div className="admin-dashboard">

      <h1>CampuServe Admin Dashboard</h1>

      <p>Welcome, Administrator!</p>

      <hr />

      <h2>System Management</h2>

      <p>
        Select a Firestore collection to view
        its data.
      </p>

      <select
        value={selectedCollection}
        onChange={(event) =>
          setSelectedCollection(event.target.value)
        }
      >
        <option value="">
          -- Select Collection --
        </option>

        {collections.map((collectionName) => (
          <option
            key={collectionName}
            value={collectionName}
          >
            {collectionName}
          </option>
        ))}
      </select>

      <button
        onClick={handleRetrieve}
        disabled={loading}
      >
        {loading
          ? "Loading..."
          : "Retrieve Data"}
      </button>

      {error && (
        <p>{error}</p>
      )}

      {records.length > 0 && (
        <div>
          <h2>
            {selectedCollection} Data
          </h2>

          {records.map((record) => (
            <div key={record.id}>
              <hr />

              <p>
                <strong>ID:</strong>{" "}
                {record.id}
              </p>

              <pre>
                {JSON.stringify(
                  record,
                  null,
                  2
                )}
              </pre>
            </div>
          ))}
        </div>
      )}

      <hr />

      <h2>Create Account</h2>

      <p>
        Create a new account in the accounts collection.
      </p>

      <div>
        <label>
          Student ID:
          <input
            type="text"
            value={createStudentId}
            onChange={(event) =>
              setCreateStudentId(event.target.value)
            }
            placeholder="Required for students"
          />
        </label>
      </div>

      <br />

      <div>
        <label>
          Name:
          <input
            type="text"
            value={createName}
            onChange={(event) =>
              setCreateName(event.target.value)
            }
            placeholder="Enter name"
          />
        </label>
      </div>

      <br />

      <div>
        <label>
          Email:
          <input
            type="email"
            value={createEmail}
            onChange={(event) =>
              setCreateEmail(event.target.value)
            }
            placeholder="Enter email"
          />
        </label>
      </div>

      <br />

      <div>
        <label>
          Role:
          <select
            value={createRole}
            onChange={(event) =>
              setCreateRole(event.target.value)
            }
          >
            <option value="student">
              Student
            </option>

            <option value="admin">
              Administrator
            </option>

            <option value="registrar">
              Registrar Staff
            </option>

            <option value="general_office">
              Supply Staff
            </option>
          </select>
        </label>
      </div>

      <br />

      <div>
        <label>
          Status:
          <select
            value={createStatus}
            onChange={(event) =>
              setCreateStatus(event.target.value)
            }
          >
            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </label>
      </div>

      <br />

      <button onClick={handleCreateAccount}>
        Create Account
      </button>

      {createMessage && (
        <p>{createMessage}</p>
      )}

      {!loading &&
        selectedCollection &&
        records.length === 0 &&
        !error && (
          <p>
            No records found in this collection.
          </p>
        )}

    </div>
  );
}

export default AdminDashboard;