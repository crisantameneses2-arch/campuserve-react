import "./DocumentRequests.css";

function DocumentRequests() {
  const requests = [
    {
      id: "DR-00124",
      student: "Maria Santos",
      document: "Certificate of Enrollment",
      date: "Oct 7, 2026",
      status: "Pending",
    },
    {
      id: "DR-00123",
      student: "John Dela Cruz",
      document: "Transcript of Records",
      date: "Oct 7, 2026",
      status: "Processing",
    },
    {
      id: "DR-00122",
      student: "Angela Reyes",
      document: "Certificate of Grades",
      date: "Oct 6, 2026",
      status: "Ready for Claim",
    },
    {
      id: "DR-00121",
      student: "Kevin Garcia",
      document: "Good Moral Certificate",
      date: "Oct 6, 2026",
      status: "Completed",
    },
    {
      id: "DR-00120",
      student: "Sofia Mendoza",
      document: "Transcript of Records",
      date: "Oct 5, 2026",
      status: "Rejected",
    },
  ];

  return (
    <div className="requests-page">
      <div className="requests-header">
        <div>
          <h1>Document Requests</h1>
          <p>
            Monitor and manage student document requests.
          </p>
        </div>

        <button className="requests-refresh-button">
          ↻ Refresh
        </button>
      </div>

      <div className="requests-summary">
        <div className="request-stat">
          <span>All Requests</span>
          <strong>124</strong>
        </div>

        <div className="request-stat pending">
          <span>Pending</span>
          <strong>18</strong>
        </div>

        <div className="request-stat processing">
          <span>Processing</span>
          <strong>24</strong>
        </div>

        <div className="request-stat completed">
          <span>Completed</span>
          <strong>76</strong>
        </div>

        <div className="request-stat rejected">
          <span>Rejected</span>
          <strong>6</strong>
        </div>
      </div>

      <div className="requests-table-card">
        <div className="requests-toolbar">
          <div className="request-search">
            <input
              type="text"
              placeholder="Search requests..."
            />

            <button>Search</button>
          </div>

          <select defaultValue="All Status">
            <option>All Status</option>
            <option>Pending</option>
            <option>Processing</option>
            <option>Ready for Claim</option>
            <option>Completed</option>
            <option>Rejected</option>
          </select>
        </div>

        <div className="requests-table-wrapper">
          <table className="requests-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Student</th>
                <th>Document</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.id}</strong>
                  </td>

                  <td>{request.student}</td>

                  <td>{request.document}</td>

                  <td>{request.date}</td>

                  <td>
                    <span
                      className={`request-status ${request.status
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {request.status}
                    </span>
                  </td>

                  <td>
                    <button className="request-view-button">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DocumentRequests;