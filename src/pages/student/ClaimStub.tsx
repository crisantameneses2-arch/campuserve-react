import { useEffect, useState } from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import {
  subscribeToDocumentRequest,
  subscribeToDocumentRequestDetails,
} from "../../services/documentRequests";

interface RequestData {
  request_id: string;
  student_id: string;
  requested_date: string;
  requested_time: string;
  status: string;
  claim_code: string | null;
}

interface DetailData {
  detail_id: string;
  document_type: string;
  custom_document_name: string | null;
  quantity: number;
}

export default function ClaimStub() {
  const { requestId } = useParams<{
    requestId: string;
  }>();

  const [request, setRequest] =
    useState<RequestData | null>(null);

  const [details, setDetails] =
    useState<DetailData[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * Load request and document details
   */
  useEffect(() => {
    if (!requestId) {
      setError("No request ID was provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsubscribeRequest =
      subscribeToDocumentRequest(
        requestId,
        (data) => {
          if (!data) {
            setRequest(null);
            setError(
              "The requested document request could not be found."
            );
            setLoading(false);
            return;
          }

          setRequest(
            data as unknown as RequestData
          );

          setLoading(false);
        }
      );

    const unsubscribeDetails =
      subscribeToDocumentRequestDetails(
        requestId,
        (data) => {
          setDetails(
            data as unknown as DetailData[]
          );
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
          <h1>
            Claim Stub Not Found
          </h1>

          <p>
            No request ID was provided.
          </p>

          <Link to="/student/requests">
            ← Back to My Requests
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
          <p>
            Loading claim stub...
          </p>
        </div>
      </div>
    );
  }

  /*
   * Error / request not found
   */
  if (!request) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1>
            Claim Stub Not Found
          </h1>

          <p>
            {error ||
              "The request could not be found."}
          </p>

          <Link to="/student/requests">
            ← Back to My Requests
          </Link>
        </div>
      </div>
    );
  }

  /*
   * Claim stub is only available
   * when the request is ready for pickup.
   */
  if (
    request.status !==
    "READY_FOR_PICKUP"
  ) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Link
            to={`/student/requests/${request.request_id}`}
          >
            ← Request Details
          </Link>

          <h1>
            Claim Stub Not Available
          </h1>

          <p>
            This request is not yet ready
            for pickup.
          </p>

          <p>
            Current status:{" "}
            <strong>
              {request.status}
            </strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Back */}
        <Link
          to={`/student/requests/${request.request_id}`}
          style={styles.backLink}
        >
          ← Request Details
        </Link>

        {/* Claim Stub */}
        <div style={styles.claimStub}>

          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.logo}>
              CAMPUSERVE
            </h1>

            <h2 style={styles.claimTitle}>
              CLAIM STUB
            </h2>

            <p style={styles.readyText}>
              READY FOR PICKUP
            </p>
          </div>

          {/* Student Information */}
          <div style={styles.section}>
            <h3>
              Request Information
            </h3>

            <div style={styles.infoRow}>
              <strong>
                Student ID
              </strong>

              <span>
                {request.student_id}
              </span>
            </div>

            <div style={styles.infoRow}>
              <strong>
                Request ID
              </strong>

              <span>
                {request.request_id}
              </span>
            </div>
          </div>

          {/* Claim Code */}
          <div style={styles.codeBox}>
            <p style={styles.codeLabel}>
              CLAIM CODE
            </p>

            <h1 style={styles.claimCode}>
              {request.claim_code ||
                "—"}
            </h1>
          </div>

          {/* Documents */}
          <div style={styles.section}>
            <h3>
              Documents
            </h3>

            {details.length === 0 ? (
              <p>
                No document details found.
              </p>
            ) : (
              details.map(
                (detail) => (
                  <div
                    key={
                      detail.detail_id
                    }
                    style={styles.documentRow}
                  >
                    <span>
                      {detail.document_type ===
                      "Others"
                        ? detail.custom_document_name ||
                          "Others"
                        : detail.document_type}
                    </span>

                    <strong>
                      × {detail.quantity}
                    </strong>
                  </div>
                )
              )
            )}
          </div>

          {/* Schedule */}
          <div style={styles.section}>
            <h3>
              Claiming Schedule
            </h3>

            <div style={styles.infoRow}>
              <strong>
                Date
              </strong>

              <span>
                {request.requested_date}
              </span>
            </div>

            <div style={styles.infoRow}>
              <strong>
                Time
              </strong>

              <span>
                {request.requested_time}
              </span>
            </div>
          </div>

          {/* Notice */}
          <div style={styles.notice}>
            <strong>
              Important
            </strong>

            <p>
              Present this claim stub and
              your claim code when claiming
              your requested documents.
            </p>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <p>
              CampuServe
            </p>

            <p>
              Digital Claim Stub
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div style={styles.navigation}>
          <Link
            to={`/student/requests/${request.request_id}`}
          >
            <button
              type="button"
              style={styles.secondaryButton}
            >
              Back to Request
            </button>
          </Link>

          <Link to="/student/requests">
            <button
              type="button"
              style={styles.button}
            >
              My Requests
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/*
 * Styles
 */
const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    backgroundColor: "#f5f7fa",
    boxSizing: "border-box" as const,
  },

  container: {
    maxWidth: "600px",
    margin: "0 auto",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "24px",
    boxShadow:
      "0 2px 8px rgba(0, 0, 0, 0.08)",
  },

  backLink: {
    display: "inline-block",
    marginBottom: "20px",
    textDecoration: "none",
  },

  claimStub: {
    backgroundColor: "#ffffff",
    border:
      "2px solid #222222",
    borderRadius: "12px",
    padding: "28px",
    boxShadow:
      "0 4px 12px rgba(0, 0, 0, 0.08)",
  },

  header: {
    textAlign: "center" as const,
    paddingBottom: "20px",
    borderBottom:
      "1px dashed #cccccc",
  },

  logo: {
    margin: 0,
    letterSpacing: "2px",
  },

  claimTitle: {
    margin:
      "8px 0",
    letterSpacing: "3px",
  },

  readyText: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
  },

  section: {
    marginTop: "24px",
  },

  infoRow: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "20px",
    padding:
      "8px 0",
    borderBottom:
      "1px solid #eeeeee",
  },

  codeBox: {
    marginTop: "24px",
    padding: "20px",
    textAlign: "center" as const,
    border:
      "1px solid #dddddd",
    borderRadius: "8px",
  },

  codeLabel: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "2px",
  },

  claimCode: {
    margin:
      "10px 0 0",
    letterSpacing: "5px",
  },

  documentRow: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "16px",
    padding:
      "10px 0",
    borderBottom:
      "1px solid #eeeeee",
  },

  notice: {
    marginTop: "24px",
    padding: "16px",
    backgroundColor: "#f7f7f7",
    borderRadius: "8px",
    fontSize: "14px",
  },

  footer: {
    marginTop: "24px",
    paddingTop: "16px",
    borderTop:
      "1px dashed #cccccc",
    textAlign: "center" as const,
    fontSize: "12px",
  },

  navigation: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "12px",
    marginTop: "20px",
    flexWrap: "wrap" as const,
  },

  button: {
    padding:
      "10px 18px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  secondaryButton: {
    padding:
      "10px 18px",
    border:
      "1px solid #cccccc",
    borderRadius: "8px",
    cursor: "pointer",
    backgroundColor: "#ffffff",
  },
};