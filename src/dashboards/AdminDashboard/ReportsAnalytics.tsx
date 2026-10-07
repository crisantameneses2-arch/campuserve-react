import "./ReportsAnalytics.css";

function ReportsAnalytics() {
  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>Reports & Analytics</h1>
          <p>
            View system activity, requests, reservations, and usage statistics.
          </p>
        </div>

        <div className="reports-actions">
          <select defaultValue="Last 30 Days">
            <option>Last 30 Days</option>
            <option>Last 7 Days</option>
            <option>This Month</option>
            <option>This Year</option>
          </select>

          <button>
            Export Report
          </button>
        </div>
      </div>

      <div className="reports-summary">
        <div className="report-stat-card">
          <span>Document Requests</span>
          <strong>324</strong>
          <small>↑ 12.4% from last month</small>
        </div>

        <div className="report-stat-card">
          <span>Item Reservations</span>
          <strong>186</strong>
          <small>↑ 8.2% from last month</small>
        </div>

        <div className="report-stat-card">
          <span>Completed Transactions</span>
          <strong>428</strong>
          <small>↑ 15.6% from last month</small>
        </div>

        <div className="report-stat-card">
          <span>Active Students</span>
          <strong>128</strong>
          <small>Current active accounts</small>
        </div>
      </div>

      <div className="reports-grid">
        <div className="report-chart-card large">
          <div className="report-card-header">
            <div>
              <h2>Requests Overview</h2>
              <p>
                Document requests over the selected period.
              </p>
            </div>
          </div>

          <div className="mock-chart">
            <div className="chart-bars">
              <div style={{ height: "45%" }} />
              <div style={{ height: "65%" }} />
              <div style={{ height: "52%" }} />
              <div style={{ height: "78%" }} />
              <div style={{ height: "60%" }} />
              <div style={{ height: "88%" }} />
              <div style={{ height: "72%" }} />
            </div>

            <div className="chart-labels">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>

        <div className="report-chart-card">
          <div className="report-card-header">
            <h2>Request Status</h2>
          </div>

          <div className="status-report">
            <div>
              <span>Completed</span>
              <strong>76%</strong>
            </div>

            <div>
              <span>Processing</span>
              <strong>14%</strong>
            </div>

            <div>
              <span>Pending</span>
              <strong>7%</strong>
            </div>

            <div>
              <span>Rejected</span>
              <strong>3%</strong>
            </div>
          </div>
        </div>

        <div className="report-chart-card">
          <div className="report-card-header">
            <h2>Most Requested Documents</h2>
          </div>

          <div className="ranking-list">
            <div>
              <span>1</span>
              <p>Transcript of Records</p>
              <strong>84</strong>
            </div>

            <div>
              <span>2</span>
              <p>Certificate of Enrollment</p>
              <strong>71</strong>
            </div>

            <div>
              <span>3</span>
              <p>Certificate of Grades</p>
              <strong>59</strong>
            </div>

            <div>
              <span>4</span>
              <p>Good Moral Certificate</p>
              <strong>42</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsAnalytics;