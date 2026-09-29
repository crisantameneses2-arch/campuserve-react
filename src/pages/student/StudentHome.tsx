import { Link } from "react-router-dom";

export default function StudentHome() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>CampuServe</h1>

      <h2>Student Dashboard</h2>

      <p>
        Welcome to the Student Document Services portal.
      </p>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "24px",
          flexWrap: "wrap",
        }}
      >
        <Link to="/student/request">
          <button type="button">
            Document Request
          </button>
        </Link>

        <Link to="/student/requests">
          <button type="button">
            My Requests
          </button>
        </Link>
      </div>
    </div>
  );
}