import "./ActivityLogs.css";

function ActivityLogs() {
  const logs = [
    {
      user: "Maria Santos",
      role: "Student",
      action: "Submitted Request",
      description:
        "Submitted a Transcript of Records request.",
      date: "Oct 7, 2026",
      time: "10:42 AM",
    },
    {
      user: "Admin User",
      role: "Administrator",
      action: "Updated Account",
      description:
        "Updated the account information of John Dela Cruz.",
      date: "Oct 7, 2026",
      time: "10:21 AM",
    },
    {
      user: "Registrar Office",
      role: "Registrar",
      action: "Approved Request",
      description:
        "Approved document request DR-00122.",
      date: "Oct 7, 2026",
      time: "9:48 AM",
    },
    {
      user: "Kevin Garcia",
      role: "Student",
      action: "Created Reservation",
      description:
        "Reserved a projector for October 8.",
      date: "Oct 6, 2026",
      time: "4:32 PM",
    },
    {
      user: "Admin User",
      role: "Administrator",
      action: "Changed Settings",
      description:
        "Updated system notification settings.",
      date: "Oct 6, 2026",
      time: "2:17 PM",
    },
  ];

  return (
    <div className="logs-page">
      <div className="logs-header">
        <div>
          <h1>Activity Logs</h1>
          <p>
            Monitor important activities performed within CampuServe.
          </p>
        </div>

        <button className="logs-refresh-button">
          ↻ Refresh
        </button>
      </div>

      <div className="logs-summary">
        <div>
          <span>Today's Activities</span>
          <strong>48</strong>
        </div>

        <div>
          <span>This Week</span>
          <strong>286</strong>
        </div>

        <div>
          <span>Administrators</span>
          <strong>12</strong>
        </div>

        <div>
          <span>System Events</span>
          <strong>36</strong>
        </div>
      </div>

      <div className="logs-card">
        <div className="logs-toolbar">
          <div className="logs-search">
            <input
              type="text"
              placeholder="Search activity logs..."
            />

            <button>
              Search
            </button>
          </div>

          <select defaultValue="All Roles">
            <option>All Roles</option>
            <option>Student</option>
            <option>Alumni</option>
            <option>General Office</option>
            <option>Registrar</option>
            <option>Administrator</option>
          </select>

          <select defaultValue="All Activities">
            <option>All Activities</option>
            <option>Requests</option>
            <option>Reservations</option>
            <option>Accounts</option>
            <option>Settings</option>
          </select>
        </div>

        <div className="logs-list">
          {logs.map((log, index) => (
            <div
              className="log-item"
              key={index}
            >
              <div className="log-icon">
                {log.user.charAt(0)}
              </div>

              <div className="log-main">
                <div className="log-title">
                  <strong>{log.user}</strong>

                  <span className="log-role">
                    {log.role}
                  </span>

                  <span className="log-action">
                    {log.action}
                  </span>
                </div>

                <p>
                  {log.description}
                </p>
              </div>

              <div className="log-time">
                <strong>{log.date}</strong>
                <span>{log.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ActivityLogs;