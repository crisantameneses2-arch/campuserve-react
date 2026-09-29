import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { TEST_STUDENT_ID } from "../../constants/student";
import {
  subscribeToStudentDocumentRequests,
} from "../../services/documentRequests";

interface StudentRequest {
  request_id: string;
  student_id: string;
  request_method: "OWN" | "WITH_OTHERS";
  purpose: string;
  number_of_copies: number;
  total_amount: number;
  requested_date: string;
  requested_time: string;
  status: string;
  claim_code: string | null;
}

export default function DocumentRequestList() {
  const [requests, setRequests] = useState<
    StudentRequest[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const unsubscribe =
      subscribeToStudentDocumentRequests(
        TEST_STUDENT_ID,
        (data) => {
          const converted =
            data as unknown as StudentRequest[];

          converted.sort((a, b) => {
            const dateA =
              `${a.requested_date} ${a.requested_time}`;

            const dateB =
              `${b.requested_date} ${b.requested_time}`;

            return dateB.localeCompare(dateA);
          });

          setRequests(converted);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>My Requests</h1>

      <Link to="/student">
        ← Student Dashboard
      </Link>

      {loading && (
        <p>Loading your requests...</p>
      )}

      {error && (
        <p>{error}</p>
      )}

      {!loading &&
        requests.length === 0 && (
          <p>
            You don't have any document
            requests yet.
          </p>
        )}

      <div
        style={{
          marginTop: "20px",
        }}
      >
        {requests.map((request) => (
          <div
            key={request.request_id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "12px",
            }}
          >
            <h3>
              {request.request_id}
            </h3>

            <p>
              Purpose: {request.purpose}
            </p>

            <p>
              Schedule:{" "}
              {request.requested_date}
              {" • "}
              {request.requested_time}
            </p>

            <p>
              Status:{" "}
              <strong>
                {request.status}
              </strong>
            </p>

            {request.status ===
              "READY_FOR_PICKUP" && (
              <Link
                to={`/student/requests/${request.request_id}/claim`}
              >
                <button type="button">
                  View Claim Stub
                </button>
              </Link>
            )}

            <div
              style={{
                marginTop: "8px",
              }}
            >
              <Link
                to={`/student/requests/${request.request_id}`}
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}