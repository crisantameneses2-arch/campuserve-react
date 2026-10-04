import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  cancelDocumentRequest,
  getAvailableClaimingSchedules,
  rescheduleDocumentRequest,
  subscribeToDocumentRequest,
  subscribeToDocumentRequestDetails,
  type AvailableClaimingSchedule,
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

  const [request, setRequest] =
    useState<RequestData | null>(null);

  const [details, setDetails] =
    useState<DetailData[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [cancelling, setCancelling] =
    useState(false);

  // Rescheduling states
  const [rescheduling, setRescheduling] =
    useState(false);

  const [availableSchedules, setAvailableSchedules] =
    useState<AvailableClaimingSchedule[]>([]);

  const [selectedSchedule, setSelectedSchedule] =
    useState<AvailableClaimingSchedule | null>(null);

  const [loadingSchedules, setLoadingSchedules] =
    useState(false);

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

    const unsubscribeRequest =
      subscribeToDocumentRequest(
        requestId,
        (data) => {
          if (!data) {
            setRequest(null);
            setError("Request not found.");
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
   * Cancel document request
   *
   * Students can only cancel requests
   * while the status is PENDING.
   */
  const handleCancelRequest = async () => {
    if (!request) {
      return;
    }

    if (request.status !== "PENDING") {
      window.alert(
        "This request can no longer be cancelled."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel this document request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setCancelling(true);
      setError("");

      await cancelDocumentRequest(
        request.request_id
      );

      window.alert(
        "Your document request has been cancelled."
      );
    } catch (err) {
      console.error(
        "Failed to cancel document request:",
        err
      );

      setError(
        "Failed to cancel the request. Please try again."
      );
    } finally {
      setCancelling(false);
    }
  };

  /*
   * Load available claiming schedules.
   *
   * Students can reschedule when the request
   * is either PENDING or APPROVED.
   *
   * PENDING:
   *   Reschedule -> remains PENDING
   *
   * APPROVED:
   *   Reschedule -> becomes RESCHEDULED
   */
  const handleOpenReschedule = async () => {
    if (!request) {
      return;
    }

    if (
      request.status !== "PENDING" &&
      request.status !== "APPROVED"
    ) {
      window.alert(
        "This request can no longer be rescheduled."
      );
      return;
    }

    try {
      setLoadingSchedules(true);
      setError("");
      setSelectedSchedule(null);

      const schedules =
        await getAvailableClaimingSchedules();

      setAvailableSchedules(schedules);
    } catch (err) {
      console.error(
        "Failed to load claiming schedules:",
        err
      );

      setError(
        "Failed to load available schedules. Please try again."
      );
    } finally {
      setLoadingSchedules(false);
    }
  };

  /*
   * Confirm the selected reschedule.
   */
  const handleConfirmReschedule = async () => {
    if (!request || !selectedSchedule) {
      return;
    }

    const confirmed = window.confirm(
      `Reschedule your claiming schedule to ${selectedSchedule.claimDate} at ${selectedSchedule.timeSlot}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRescheduling(true);
      setError("");

      await rescheduleDocumentRequest(
        request.request_id,
        request.requested_date,
        request.requested_time,
        selectedSchedule.claimDate,
        selectedSchedule.timeSlot,
        request.status
      );

      setSelectedSchedule(null);
      setAvailableSchedules([]);

      if (request.status === "PENDING") {
        window.alert(
          "Your claiming schedule has been rescheduled successfully. Your request remains pending for Registrar approval."
        );
      } else {
        window.alert(
          "Your claiming schedule has been rescheduled successfully."
        );
      }
    } catch (err) {
      console.error(
        "Failed to reschedule document request:",
        err
      );

      setError(
        "Failed to reschedule the request. Please try again."
      );
    } finally {
      setRescheduling(false);
    }
  };

  /*
   * No request ID
   */
  if (!requestId) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1>Request Not Found</h1>

          <p>
            No request ID was provided.
          </p>

          <Link to="/student/requests">
            <button
              type="button"
              style={styles.button}
            >
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
            <button
              type="button"
              style={styles.button}
            >
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
  const getDocumentName = (
    detail: DetailData
  ) => {
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
  const formatAmount = (
    amount: number | null
  ) => {
    if (
      amount === null ||
      amount === undefined
    ) {
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

        {/* Error Message */}
        {error && (
          <div style={styles.errorCard}>
            {error}
          </div>
        )}

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
                {request.request_method ===
                "WITH_OTHERS"
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

            <p>
              {request.purpose}
            </p>
          </div>
        </div>

        {/* Requested Documents */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Requested Documents
          </h2>

          {details.length === 0 ? (
            <p>
              No document details found.
            </p>
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
                      Quantity:{" "}
                      {detail.quantity}
                    </p>
                  </div>

                  <div
                    style={styles.documentPrice}
                  >
                    <p>
                      Unit Price:{" "}
                      {formatAmount(
                        detail.unit_price
                      )}
                    </p>

                    <strong>
                      Subtotal:{" "}
                      {formatAmount(
                        detail.subtotal
                      )}
                    </strong>
                  </div>
                </div>
              ))}

            </div>
          )}

          <div style={styles.totalBox}>

            <div>
              <strong>
                Total Copies
              </strong>

              <p>
                {request.number_of_copies}
              </p>
            </div>

            <div>
              <strong>
                Total Amount
              </strong>

              <p style={styles.totalAmount}>
                {formatAmount(
                  request.total_amount
                )}
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
                <strong>
                  Pending
                </strong>

                <p>
                  Your request has been submitted
                  and is waiting for Registrar review.
                  You may still cancel or reschedule
                  your claiming schedule while the
                  request is pending.
                </p>
              </>
            )}

            {request.status === "APPROVED" && (
              <>
                <strong>
                  Approved
                </strong>

                <p>
                  Your request has been approved
                  by the Registrar. You may
                  reschedule your claiming schedule
                  if needed.
                </p>
              </>
            )}

            {request.status === "PROCESSING" && (
              <>
                <strong>
                  Processing
                </strong>

                <p>
                  Your requested documents are
                  currently being prepared.
                </p>
              </>
            )}

            {request.status ===
              "READY_FOR_PICKUP" && (
              <>
                <strong>
                  Ready for Pick Up
                </strong>

                <p>
                  Your documents are ready.
                  You may view your digital
                  claim stub below.
                </p>
              </>
            )}

            {request.status === "COMPLETED" && (
              <>
                <strong>
                  Completed
                </strong>

                <p>
                  This document request has
                  been completed.
                </p>
              </>
            )}

            {request.status === "DECLINED" && (
              <>
                <strong>
                  Declined
                </strong>

                <p>
                  This request was declined
                  by the Registrar.
                </p>
              </>
            )}

            {request.status === "CANCELLED" && (
              <>
                <strong>
                  Cancelled
                </strong>

                <p>
                  This document request has
                  been cancelled.
                </p>
              </>
            )}

            {request.status ===
              "RESCHEDULED" && (
              <>
                <strong>
                  Rescheduled
                </strong>

                <p>
                  This request has been
                  rescheduled to a new
                  claiming schedule.
                </p>
              </>
            )}

          </div>
        </div>

        {/* Claim Stub */}
        {request.status ===
          "READY_FOR_PICKUP" &&
          request.claim_code && (
            <div style={styles.claimCard}>

              <h2>
                Digital Claim Stub
              </h2>

              <p>
                Your request is ready
                for pickup.
              </p>

              <p>
                Claim Code:
              </p>

              <strong
                style={styles.claimCode}
              >
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

        {/* Request Actions */}

        {/* PENDING Actions */}
        {request.status === "PENDING" && (
          <div style={styles.actionCard}>

            <h2 style={styles.sectionTitle}>
              Request Actions
            </h2>

            <p>
              Your request is still pending.
              You may cancel the request or
              change your claiming schedule.
              Rescheduling will not affect the
              pending approval status.
            </p>

            <div style={styles.actionButtons}>

              {/* Cancel */}
              <button
                type="button"
                style={styles.cancelButton}
                onClick={handleCancelRequest}
                disabled={
                  cancelling ||
                  rescheduling
                }
              >
                {cancelling
                  ? "Cancelling..."
                  : "Cancel Request"}
              </button>

              {/* Reschedule */}
              <button
                type="button"
                style={styles.button}
                onClick={handleOpenReschedule}
                disabled={
                  loadingSchedules ||
                  cancelling ||
                  rescheduling
                }
              >
                {loadingSchedules
                  ? "Loading Schedules..."
                  : "Reschedule Claiming Schedule"}
              </button>

            </div>

            {/* Available schedules */}
            {availableSchedules.length > 0 && (
              <div style={styles.scheduleList}>

                <h3>
                  Available Claiming Schedules
                </h3>

                <p style={styles.scheduleInstruction}>
                  Select a new date and time:
                </p>

                {availableSchedules.map(
                  (schedule) => (
                    <button
                      key={schedule.id}
                      type="button"
                      style={
                        selectedSchedule?.id ===
                        schedule.id
                          ? styles.selectedSchedule
                          : styles.scheduleItem
                      }
                      onClick={() =>
                        setSelectedSchedule(
                          schedule
                        )
                      }
                      disabled={rescheduling}
                    >
                      <strong>
                        {schedule.claimDate}
                      </strong>

                      <span>
                        {schedule.timeSlot}
                      </span>

                      <span>
                        {schedule.availableSlot}{" "}
                        slots available
                      </span>
                    </button>
                  )
                )}

                {/* Confirm */}
                {selectedSchedule && (
                  <div
                    style={
                      styles.selectedScheduleBox
                    }
                  >
                    <p>
                      <strong>
                        Selected Schedule
                      </strong>
                    </p>

                    <p>
                      Date:{" "}
                      {selectedSchedule.claimDate}
                    </p>

                    <p>
                      Time:{" "}
                      {selectedSchedule.timeSlot}
                    </p>

                    <p style={styles.pendingNotice}>
                      Your request will remain
                      <strong> PENDING </strong>
                      after rescheduling.
                    </p>

                    <button
                      type="button"
                      style={
                        styles.confirmButton
                      }
                      onClick={
                        handleConfirmReschedule
                      }
                      disabled={rescheduling}
                    >
                      {rescheduling
                        ? "Rescheduling..."
                        : "Confirm Reschedule"}
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* No schedules */}
            {!loadingSchedules &&
              availableSchedules.length === 0 && (
                <p
                  style={
                    styles.noScheduleMessage
                  }
                >
                  No available claiming schedules
                  were found within the next
                  14 days.
                </p>
              )}

          </div>
        )}

        {/* APPROVED Actions */}
        {request.status === "APPROVED" && (
          <div style={styles.actionCard}>

            <h2 style={styles.sectionTitle}>
              Request Actions
            </h2>

            <p>
              Your request has been approved.
              If you cannot attend your original
              claiming schedule, you may select
              another available schedule.
            </p>

            <button
              type="button"
              style={styles.button}
              onClick={handleOpenReschedule}
              disabled={loadingSchedules}
            >
              {loadingSchedules
                ? "Loading Schedules..."
                : "Reschedule Claiming Schedule"}
            </button>

            {/* Available schedules */}
            {availableSchedules.length > 0 && (
              <div style={styles.scheduleList}>

                <h3>
                  Available Claiming Schedules
                </h3>

                <p style={styles.scheduleInstruction}>
                  Select a new date and time:
                </p>

                {availableSchedules.map(
                  (schedule) => (
                    <button
                      key={schedule.id}
                      type="button"
                      style={
                        selectedSchedule?.id ===
                        schedule.id
                          ? styles.selectedSchedule
                          : styles.scheduleItem
                      }
                      onClick={() =>
                        setSelectedSchedule(
                          schedule
                        )
                      }
                      disabled={rescheduling}
                    >
                      <strong>
                        {schedule.claimDate}
                      </strong>

                      <span>
                        {schedule.timeSlot}
                      </span>

                      <span>
                        {schedule.availableSlot}{" "}
                        slots available
                      </span>
                    </button>
                  )
                )}

                {/* Confirm */}
                {selectedSchedule && (
                  <div
                    style={
                      styles.selectedScheduleBox
                    }
                  >
                    <p>
                      <strong>
                        Selected Schedule
                      </strong>
                    </p>

                    <p>
                      Date:{" "}
                      {selectedSchedule.claimDate}
                    </p>

                    <p>
                      Time:{" "}
                      {selectedSchedule.timeSlot}
                    </p>

                    <button
                      type="button"
                      style={
                        styles.confirmButton
                      }
                      onClick={
                        handleConfirmReschedule
                      }
                      disabled={rescheduling}
                    >
                      {rescheduling
                        ? "Rescheduling..."
                        : "Confirm Reschedule"}
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* No schedules */}
            {!loadingSchedules &&
              availableSchedules.length === 0 && (
                <p
                  style={
                    styles.noScheduleMessage
                  }
                >
                  No available claiming schedules
                  were found within the next
                  14 days.
                </p>
              )}

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
 * Page styles
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
    boxShadow:
      "0 2px 8px rgba(0, 0, 0, 0.08)",
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
    boxShadow:
      "0 2px 8px rgba(0, 0, 0, 0.08)",
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
    backgroundColor: "#333333",
    color: "#ffffff",
    fontWeight: 600,
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

  errorCard: {
    backgroundColor: "#fff1f1",
    border: "1px solid #f0b5b5",
    color: "#b42318",
    borderRadius: "8px",
    padding: "14px 16px",
    marginBottom: "20px",
  },

  actionCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow:
      "0 2px 8px rgba(0, 0, 0, 0.08)",
  },

  actionButtons: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap" as const,
    marginTop: "16px",
  },

  cancelButton: {
    padding: "10px 18px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    backgroundColor: "#d9534f",
    color: "#ffffff",
    fontWeight: 600,
  },

  scheduleList: {
    marginTop: "24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },

  scheduleInstruction: {
    color: "#666666",
    marginTop: 0,
  },

  scheduleItem: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: "6px",
    width: "100%",
    padding: "16px",
    border: "1px solid #dddddd",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    textAlign: "left" as const,
  },

  selectedSchedule: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: "6px",
    width: "100%",
    padding: "16px",
    border: "2px solid #333333",
    borderRadius: "8px",
    backgroundColor: "#f5f5f5",
    cursor: "pointer",
    textAlign: "left" as const,
  },

  selectedScheduleBox: {
    marginTop: "10px",
    padding: "18px",
    borderRadius: "8px",
    backgroundColor: "#f7f7f7",
    border: "1px solid #dddddd",
  },

  pendingNotice: {
    padding: "12px",
    backgroundColor: "#fff8e1",
    borderRadius: "8px",
  },

  confirmButton: {
    marginTop: "10px",
    padding: "12px 18px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    backgroundColor: "#333333",
    color: "#ffffff",
    fontWeight: 600,
  },

  noScheduleMessage: {
    marginTop: "20px",
    padding: "12px",
    backgroundColor: "#f7f7f7",
    borderRadius: "8px",
    color: "#666666",
  },
};