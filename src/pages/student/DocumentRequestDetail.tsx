import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  subscribeToDocumentRequest,
  subscribeToDocumentRequestDetails,
} from "../../services/documentRequests";

interface RequestData {
  request_id: string;
  student_id: string;
  request_method: string;
  purpose: string;
  number_of_copies: number;
  total_amount: number;
  requested_date: string;
  requested_time: string;
  created_at?: unknown;
  status: string;
  claim_code: string | null;
}

interface DetailData {
  detail_id: string;
  request_id: string;
  document_type: string;
  custom_document_name: string | null;
  quantity: number;
  unit_price: number | null;
  subtotal: number | null;
}

export default function DocumentRequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();

  const [request, setRequest] = useState<RequestData | null>(null);
  const [details, setDetails] = useState<DetailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * Subscribe to the request and its document details.
   *
   * IMPORTANT:
   * useEffect must be called before any conditional return.
   */
  useEffect(() => {
    if (!requestId) {
      setError("No request ID was provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsubscribeRequest = subscribeToDocumentRequest(
      requestId,
      (data) => {
        if (!data) {
          setRequest(null);
          setError("Request not found.");
          setLoading(false);
          return;
        }

        setRequest(data as unknown as RequestData);
        setLoading(false);
      }
    );

    const unsubscribeDetails =
      subscribeToDocumentRequestDetails(
        requestId,
        (data) => {
          setDetails(data as unknown as DetailData[]);
        }
      );

    return () => {
      unsubscribeRequest();
      unsubscribeDetails();
    };
  }, [requestId]);

  /*
   * No request ID
   */
  if (!requestId) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1>Request Not Found</h1>
          <p>No request ID was provided.</p>

          <Link to="/student/requests">
            <button type="button" style={styles.button}>
              Back to My Requests
            </button>
          </Link>
        </div>
      </div>
    );
  }

  /*
   * Loading
   */
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p>Loading request...</p>
        </div>
      </div>
    );
  }

  /*
   * Request not found
   */
  if (!request) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1>Request Not Found</h1>
          <p>
            {error ||
              "The requested document request could not be found."}
          </p>

          <Link to="/student/requests">
            <button type="button" style={styles.button}>
              Back to My Requests
            </button>
          </Link>
        </div>
      </div>
    );
  }

  /*
   * Display name for "Others"
   */
  const getDocumentName = (detail: DetailData) => {
    if (
      detail.document_type === "Others" &&
      detail.custom_document_name
    ) {
      return detail.custom_document_name;
    }

    return detail.document_type;
  };

  /*
   * Format amount
   */
  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) {
      return "—";
    }

    return `₱${amount.toFixed(2)}`;
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <Link
              to="/student/requests"
              style={styles.backLink}
            >
              ← Back to My Requests
            </Link>

            <h1 style={styles.title}>
              Document Request Details
            </h1>

            <p style={styles.subtitle}>
              Request ID: {request.request_id}
            </p>
          </div>

          <div style={styles.status}>
            {request.status}
          </div>
        </div>

        {/* Request Information */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Request Information
          </h2>

          <div style={styles.infoGrid}>
            <div>
              <strong>Request ID</strong>
              <p>{request.request_id}</p>
            </div>

            <div>
              <strong>Student ID</strong>
              <p>{request.student_id}</p>
            </div>

            <div>
              <strong>Request Method</strong>
              <p>
                {request.request_method === "WITH_OTHERS"
                  ? "With Others"
                  : "My Own"}
              </p>
            </div>

            <div>
              <strong>Status</strong>
              <p>{request.status}</p>
            </div>

            <div>
              <strong>Requested Date</strong>
              <p>{request.requested_date}</p>
            </div>

            <div>
              <strong>Requested Time</strong>
              <p>{request.requested_time}</p>
            </div>
          </div>

          <div style={styles.purposeBox}>
            <strong>Purpose</strong>
            <p>{request.purpose}</p>
          </div>
        </div>

        {/* Requested Documents */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Requested Documents
          </h2>

          {details.length === 0 ? (
            <p>No document details found.</p>
          ) : (
            <div style={styles.documentList}>
              {details.map((detail) => (
                <div
                  key={detail.detail_id}
                  style={styles.documentItem}
                >
                  <div style={styles.documentInfo}>
                    <strong>
                      {getDocumentName(detail)}
                    </strong>

                    <p>
                      Quantity: {detail.quantity}
                    </p>
                  </div>

                  <div style={styles.documentPrice}>
                    <p>
                      Unit Price:{" "}
                      {formatAmount(detail.unit_price)}
                    </p>

                    <strong>
                      Subtotal:{" "}
                      {formatAmount(detail.subtotal)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.totalBox}>
            <div>
              <strong>Total Copies</strong>
              <p>{request.number_of_copies}</p>
            </div>

            <div>
              <strong>Total Amount</strong>
              <p style={styles.totalAmount}>
                {formatAmount(request.total_amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Status Information */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Request Status
          </h2>

          <div style={styles.statusMessage}>
            {request.status === "PENDING" && (
              <>
                <strong>Pending</strong>
                <p>
                  Your request has been submitted and is
                  waiting for Registrar review.
                </p>
              </>
            )}

            {request.status === "APPROVED" && (
              <>
                <strong>Approved</strong>
                <p>
                  Your request has been approved by the
                  Registrar.
                </p>
              </>
            )}

            {request.status === "PROCESSING" && (
              <>
                <strong>Processing</strong>
                <p>
                  Your requested documents are currently
                  being prepared.
                </p>
              </>
            )}

            {request.status === "READY_FOR_PICKUP" && (
              <>
                <strong>Ready for Pick Up</strong>
                <p>
                  Your documents are ready. You may view
                  your digital claim stub below.
                </p>
              </>
            )}

            {request.status === "COMPLETED" && (
              <>
                <strong>Completed</strong>
                <p>
                  This document request has been completed.
                </p>
              </>
            )}

            {request.status === "DECLINED" && (
              <>
                <strong>Declined</strong>
                <p>
                  This request was declined by the Registrar.
                </p>
              </>
            )}

            {request.status === "CANCELLED" && (
              <>
                <strong>Cancelled</strong>
                <p>
                  This document request has been cancelled.
                </p>
              </>
            )}

            {request.status === "RESCHEDULED" && (
              <>
                <strong>Rescheduled</strong>
                <p>
                  This request has been rescheduled.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Claim Stub */}
        {request.status === "READY_FOR_PICKUP" &&
          request.claim_code && (
            <div style={styles.claimCard}>
              <h2>Digital Claim Stub</h2>

              <p>
                Your request is ready for pickup.
              </p>

              <p>
                Claim Code:
              </p>

              <strong style={styles.claimCode}>
                {request.claim_code}
              </strong>

              <br />

              <Link
                to={`/student/requests/${request.request_id}/claim`}
              >
                <button
                  type="button"
                  style={styles.button}
                >
                  View Claim Stub
                </button>
              </Link>
            </div>
          )}

        {/* Bottom Navigation */}
        <div style={styles.bottomNavigation}>
          <Link to="/student/requests">
            <button
              type="button"
              style={styles.secondaryButton}
            >
              Back to My Requests
            </button>
          </Link>

          <Link to="/student/request">
            <button
              type="button"
              style={styles.button}
            >
              New Document Request
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/*
 * Simple page styles.
 * These can later be replaced with your actual CampuServe CSS.
 */
const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    backgroundColor: "#f5f7fa",
    boxSizing: "border-box" as const,
  },

  container: {
    maxWidth: "900px",
    margin: "0 auto",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "24px",
  },

  backLink: {
    textDecoration: "none",
    fontSize: "14px",
  },

  title: {
    margin: "10px 0 4px",
  },

  subtitle: {
    margin: 0,
    color: "#666666",
  },

  status: {
    padding: "8px 14px",
    borderRadius: "20px",
    backgroundColor: "#eeeeee",
    fontWeight: 600,
    fontSize: "13px",
    whiteSpace: "nowrap" as const,
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "20px",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
  },

  purposeBox: {
    marginTop: "20px",
    padding: "16px",
    backgroundColor: "#f7f7f7",
    borderRadius: "8px",
  },

  documentList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },

  documentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "16px",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  },

  documentInfo: {
    flex: 1,
  },

  documentPrice: {
    textAlign: "right" as const,
  },

  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    marginTop: "20px",
    paddingTop: "20px",
    borderTop: "1px solid #dddddd",
  },

  totalAmount: {
    fontSize: "20px",
    fontWeight: 700,
  },

  statusMessage: {
    padding: "16px",
    backgroundColor: "#f7f7f7",
    borderRadius: "8px",
  },

  claimCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
    textAlign: "center" as const,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },

  claimCode: {
    display: "inline-block",
    fontSize: "28px",
    letterSpacing: "3px",
    margin: "10px 0 20px",
  },

  button: {
    padding: "10px 18px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  secondaryButton: {
    padding: "10px 18px",
    border: "1px solid #cccccc",
    borderRadius: "8px",
    cursor: "pointer",
    backgroundColor: "#ffffff",
  },

  bottomNavigation: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
};