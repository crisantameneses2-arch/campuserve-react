
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../firebase";
import "./CashierDashboard.css";

type CashierDashboardProps = {
  account: {
    name?: string;
    email?: string;
    firebaseUid?: string;
  };
};

type PaymentRecord = {
  id: string;
  recordType: "Document Request" | "Item Reservation";

  request_id?: string;
  reservationId?: string;

  payment_stub_code?: string;
  paymentCode?: string;

  claim_code?: string;
  claimStubId?: string;

  student_id?: string;
  studentId?: string;
  fullName?: string;
  name?: string;

  total_amount?: number;
  totalAmount?: number;

  payment_status?: string;
  status?: string;
};

const generateCode = (prefix: string) => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomValues = new Uint32Array(6);

  crypto.getRandomValues(randomValues);

  const suffix = Array.from(
    randomValues,
    (value) => characters[value % characters.length]
  ).join("");

  return `${prefix}-${Date.now()}-${suffix}`;
};

function CashierDashboard({ account }: CashierDashboardProps) {
  const [documentRequests, setDocumentRequests] = useState<PaymentRecord[]>([]);
  const [itemReservations, setItemReservations] = useState<PaymentRecord[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);

  const [activeTab, setActiveTab] = useState<
    "documents" | "reservations" | "history"
  >("documents");

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState("");

  const isPaid = (payment: PaymentRecord) =>
    payment.payment_status?.toUpperCase() === "PAID";

  // Load actual payment records from Firestore.
  const loadPayments = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [documentsSnapshot, reservationsSnapshot] = await Promise.all([
        getDocs(collection(db, "document_requests")),
        getDocs(collection(db, "itemReservations")),
      ]);

      const documents: PaymentRecord[] = documentsSnapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...item.data(),
            recordType: "Document Request",
          }) as PaymentRecord
      );

      const reservations: PaymentRecord[] = reservationsSnapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...item.data(),
            recordType: "Item Reservation",
          }) as PaymentRecord
      );

      // Approved and unpaid document requests.
      setDocumentRequests(
        documents.filter(
          (item) =>
            item.status?.toUpperCase() === "APPROVED" && !isPaid(item)
        )
      );

      // Approved and unpaid item reservations.
      setItemReservations(
        reservations.filter(
          (item) =>
            item.status?.toLowerCase() === "approved" && !isPaid(item)
        )
      );

      // All transactions with confirmed payments.
      setPaymentHistory([
        ...documents.filter(isPaid),
        ...reservations.filter(isPaid),
      ]);
    } catch (error) {
      console.error("Error loading payments:", error);
      setMessage("Failed to load payment records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Confirm payment and generate the appropriate claiming code.
  const confirmPayment = async (payment: PaymentRecord) => {
    const confirmed = window.confirm(
      `Confirm that you have received payment for this ${payment.recordType.toLowerCase()}?`
    );

    if (!confirmed) return;

    const collectionName =
      payment.recordType === "Document Request"
        ? "document_requests"
        : "itemReservations";

    const paymentRef = doc(db, collectionName, payment.id);

    setProcessingId(payment.id);
    setMessage("");

    try {
      const result = await runTransaction(db, async (transaction) => {
        const paymentSnapshot = await transaction.get(paymentRef);

        if (!paymentSnapshot.exists()) {
          throw new Error("Payment record was not found.");
        }

        const currentData = paymentSnapshot.data();

        // Do not generate another code if payment was already confirmed.
        if (currentData.payment_status?.toUpperCase() === "PAID") {
          return {
            alreadyPaid: true,
            claimingCode:
              payment.recordType === "Document Request"
                ? currentData.claim_code
                : currentData.claimStubId,
          };
        }

        const updates: Record<string, any> = {
          payment_status: "PAID",
          payment_confirmed_at: serverTimestamp(),
          payment_confirmed_by: account.firebaseUid || "",
        };

        let claimingCode = "";

        if (payment.recordType === "Document Request") {
          // Generate the Registrar's claiming code.
          claimingCode = currentData.claim_code || generateCode("DOC");
          updates.claim_code = claimingCode;
        } else {
          // Generate the General Office's claiming stub.
          claimingCode = currentData.claimStubId || generateCode("CS");
          updates.claimStubId = claimingCode;
        }

        transaction.update(paymentRef, updates);

        return {
          alreadyPaid: false,
          claimingCode,
        };
      });

      if (result.alreadyPaid) {
        setMessage(
          `This transaction is already paid. Claiming code: ${
            result.claimingCode || "Not available"
          }`
        );
      } else {
        setMessage(
          `Payment confirmed successfully! Claiming code: ${result.claimingCode}`
        );
      }

      await loadPayments();
    } catch (error) {
      console.error("Error confirming payment:", error);
      setMessage("Failed to confirm payment. Please try again.");
    } finally {
      setProcessingId("");
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const currentRecords =
    activeTab === "documents"
      ? documentRequests
      : activeTab === "reservations"
        ? itemReservations
        : paymentHistory;

  const getName = (payment: PaymentRecord) =>
    payment.fullName ||
    payment.name ||
    payment.student_id ||
    payment.studentId ||
    "Unknown";

  const getReference = (payment: PaymentRecord) =>
    payment.payment_stub_code ||
    payment.paymentCode ||
    payment.request_id ||
    payment.reservationId ||
    payment.id;

  const getClaimingCode = (payment: PaymentRecord) =>
    payment.recordType === "Document Request"
      ? payment.claim_code
      : payment.claimStubId;

  const getAmount = (payment: PaymentRecord) =>
    Number(payment.total_amount ?? payment.totalAmount ?? 0);

  return (
    <div className="cashier-dashboard">
      <div className="cashier-header">
        <div>
          <h1>Cashier Dashboard</h1>
          <p>Welcome, {account.name || account.email || "Cashier"}!</p>
        </div>

        <button onClick={loadPayments} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="cashier-summary">
        <div className="cashier-summary-card">
          <span>Unpaid Document Requests</span>
          <strong>{documentRequests.length}</strong>
        </div>

        <div className="cashier-summary-card">
          <span>Unpaid Item Reservations</span>
          <strong>{itemReservations.length}</strong>
        </div>

        <div className="cashier-summary-card">
          <span>Completed Payments</span>
          <strong>{paymentHistory.length}</strong>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="cashier-tabs">
        <button
          className={activeTab === "documents" ? "active" : ""}
          onClick={() => setActiveTab("documents")}
        >
          Document Requests
        </button>

        <button
          className={activeTab === "reservations" ? "active" : ""}
          onClick={() => setActiveTab("reservations")}
        >
          Item Reservations
        </button>

        <button
          className={activeTab === "history" ? "active" : ""}
          onClick={() => setActiveTab("history")}
        >
          Payment History
        </button>
      </div>

      {message && <p className="cashier-message">{message}</p>}

      {/* Payment Records */}
      {loading ? (
        <p>Loading payment records...</p>
      ) : currentRecords.length === 0 ? (
        <p>
          {activeTab === "history"
            ? "No completed payments found."
            : "No approved unpaid transactions found."}
        </p>
      ) : (
        <div className="cashier-table-container">
          <table className="cashier-table">
            <thead>
              <tr>
                <th>Name / Student ID</th>
                <th>Payment Reference</th>
                <th>Amount</th>
                <th>Payment Status</th>

                {activeTab === "history" && <th>Claiming Code</th>}
                {activeTab === "history" && <th>Transaction Type</th>}
                {activeTab !== "history" && <th>Action</th>}
              </tr>
            </thead>

            <tbody>
              {currentRecords.map((payment) => (
                <tr key={`${payment.recordType}-${payment.id}`}>
                  <td>
                    {getName(payment)}
                    {(payment.student_id || payment.studentId) && (
                      <>
                        <br />
                        <small>
                          {payment.student_id || payment.studentId}
                        </small>
                      </>
                    )}
                  </td>

                  <td>{getReference(payment)}</td>

                  <td>
                    ₱
                    {getAmount(payment).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td>{payment.payment_status || "UNPAID"}</td>

                  {activeTab === "history" && (
                    <td>{getClaimingCode(payment) || "Not available"}</td>
                  )}

                  {activeTab === "history" && (
                    <td>{payment.recordType}</td>
                  )}

                  {activeTab !== "history" && (
                    <td>
                      <button
                        disabled={processingId === payment.id}
                        onClick={() => confirmPayment(payment)}
                      >
                        {processingId === payment.id
                          ? "Processing..."
                          : "Payment Completed"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CashierDashboard;