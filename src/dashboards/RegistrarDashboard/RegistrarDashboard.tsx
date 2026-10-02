
import "./RegistrarDashboard.css";

type RegistrarDashboardProps = {
  account: {
    name?: string;
    email?: string;
  };
};

export default function RegistrarDashboard({
  account,
}: RegistrarDashboardProps) {
  return (
    <div className="registrar-dashboard">
      <header className="registrar-header">
        <div>
          <p className="registrar-label">CAMPUSERVE</p>
          <h1>Registrar Dashboard</h1>
          <p>
            Welcome, {account.name || account.email || "Registrar Staff"}
          </p>
        </div>
      </header>

      <main className="registrar-content">
        <h2>Overview</h2>
        <p className="registrar-description">
          Manage student document requests and claiming schedules.
        </p>

        <div className="registrar-stats">
          <div className="registrar-card">
            <p>Pending Requests</p>
            <h3>—</h3>
            <span>Awaiting review</span>
          </div>

          <div className="registrar-card">
            <p>Processing</p>
            <h3>—</h3>
            <span>Documents being prepared</span>
          </div>

          <div className="registrar-card">
            <p>Ready for Claiming</p>
            <h3>—</h3>
            <span>Ready for student pickup</span>
          </div>
        </div>

        <h2 className="registrar-section-title">Registrar Services</h2>

        <div className="registrar-services">
          <div className="registrar-service-card">
            <h3>Document Requests</h3>
            <p>Review, approve, decline, and process student requests.</p>
            <button type="button" disabled>
              Manage Requests
            </button>
          </div>

          <div className="registrar-service-card">
            <h3>Claiming Schedule</h3>
            <p>View the schedule for students claiming their documents.</p>
            <button type="button" disabled>
              View Schedule
            </button>
          </div>

          <div className="registrar-service-card">
            <h3>Daily Summary</h3>
            <p>Check the documents prepared and claimed for the day.</p>
            <button type="button" disabled>
              View Summary
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}