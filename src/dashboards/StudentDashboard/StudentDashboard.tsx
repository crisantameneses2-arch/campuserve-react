import { useState } from "react";

import DocumentRequestWizard from "../../pages/student/DocumentRequestWizard";
import DocumentRequestList from "../../pages/student/DocumentRequestList";

import "./StudentDashboard.css";

type StudentDashboardProps = {
  account: {
    name?: string;
    email?: string;
    student_id?: string;
  };
};

export default function StudentDashboard({
  account,
}: StudentDashboardProps) {
  const studentId =
    account.student_id ||
    account.email?.split("@")[0].replace("dummytest", "") ||
    "";

  const [activePage, setActivePage] = useState<
    "dashboard" | "request" | "requests"
  >("dashboard");

  // --------------------------------------------------
  // DOCUMENT REQUEST PAGE
  // --------------------------------------------------

  if (activePage === "request") {
    return (
      <div className="student-dashboard">

        <button
          type="button"
          onClick={() => setActivePage("dashboard")}
        >
          ← Back to Dashboard
        </button>

       <DocumentRequestWizard
  studentId={studentId}
/>

      </div>
    );
  }

  // --------------------------------------------------
  // MY REQUESTS PAGE
  // --------------------------------------------------

  if (activePage === "requests") {
    return (
      <div className="student-dashboard">

        <button
          type="button"
          onClick={() => setActivePage("dashboard")}
        >
          ← Back to Dashboard
        </button>

       <DocumentRequestList
  studentId={studentId}
/>

      </div>
    );
  }

  // --------------------------------------------------
  // MAIN STUDENT DASHBOARD
  // --------------------------------------------------

  return (
    <div className="student-dashboard">

      {/* HEADER */}
      <div className="student-header">
        <div>
          <h1>CampuServe</h1>

          <p>
            Welcome,{" "}
            <strong>
              {account.name ||
                account.email ||
                "Student"}
            </strong>
          </p>

          {account.student_id && (
            <p>
              Student ID: {account.student_id}
            </p>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="student-content">

        <h2>Student Dashboard</h2>

        <p>
          Access CampuServe services
          without repeatedly visiting
          different offices.
        </p>

        {/* ------------------------------------------ */}
        {/* DOCUMENT REQUEST */}
        {/* ------------------------------------------ */}

        <div className="dashboard-card">

          <h3>Document Services</h3>

          <p>
            Request official school
            documents online.
          </p>

          <button
            type="button"
            onClick={() =>
              setActivePage("request")
            }
          >
            Request a Document
          </button>

          <button
            type="button"
            onClick={() =>
              setActivePage("requests")
            }
          >
            My Requests
          </button>

        </div>

        {/* ------------------------------------------ */}
        {/* ITEM RESERVATION */}
        {/* ------------------------------------------ */}

        <div className="dashboard-card">

          <h3>Item Reservation</h3>

          <p>
            Reserve school items and
            supplies.
          </p>

          <button
            type="button"
            disabled
          >
            Reserve an Item
          </button>

        </div>

        {/* ------------------------------------------ */}
        {/* TRANSACTIONS */}
        {/* ------------------------------------------ */}

        <div className="dashboard-card">

          <h3>Transactions</h3>

          <p>
            View your previous
            CampuServe transactions.
          </p>

          <button
            type="button"
            disabled
          >
            View Transactions
          </button>

        </div>

      </div>
    </div>
  );
}