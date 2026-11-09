
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
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
  request_id?: string;
  reservationId?: string;
  claimStubId?: string;
  claim_code?: string;
  approval_code?: string;
  student_id?: string;
  fullName?: string;
  name?: string;
  total_amount?: number;
  totalAmount?: number;
  payment_status?: string;
  status?: string;
};

function CashierDashboard({ account }: CashierDashboardProps) {
  const [documentRequests, setDocumentRequests] = useState<PaymentRecord[]>([]);
  const [itemReservations, setItemReservations] = useState<PaymentRecord[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState("documents");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadPayments = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [documentsSnapshot, reservationsSnapshot] = await Promise.all([
        getDocs(collection(db, "document_requests")),
        getDocs(collection(db, "itemReservations")),
      ]);

      const documents = documentsSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PaymentRecord[];

      const reservations = reservationsSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PaymentRecord[];

      setDocumentRequests(
        documents.filter((item) => item.payment_status !== "PAID")
      );

      setItemReservations(
        reservations.filter((item) => item.payment_status !== "PAID")
      );

      setPaymentHistory([
        ...documents.filter((item) => item.payment_status === "PAID"),
        ...reservations.filter((item) => item.payment_status === "PAID"),
      ]);
    } catch (error) {
      console.error("Error loading payments:", error);
      setMessage("Failed to load payment records.");
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (
    collectionName: string,
    payment: PaymentRecord
  ) => {
    const confirmed = window.confirm(
      "Confirm that you have received the payment for this transaction?"
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, collectionName, payment.id), {
        payment_status: "PAID",
        paid_at: serverTimestamp(),
        paid_by: account.firebaseUid || "",
      });

      setMessage("Payment confirmed successfully.");
      await loadPayments();
    } catch (error) {
      console.error("Error confirming payment:", error);
      setMessage("Failed to confirm payment.");
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
    payment.fullName || payment.name || payment.student_id || "Unknown";

  const getReference = (payment: PaymentRecord) =>
    payment.approval_code ||
    payment.claimStubId ||
    payment.request_id ||
    payment.reservationId ||
    payment.claim_code ||
    payment.id;

  const getAmount = (payment: PaymentRecord) =>
    payment.total_amount ?? payment.totalAmount ?? 0;

  return (
    <div className="cashier-dashboard">
      <div className="cashier-header">
        <div>
          <h1>Cashier Dashboard</h1>
          <p>Welcome, {account.name || account.email || "Cashier"}!</p>
        </div>

        <button onClick={loadPayments}>Refresh</button>
      </div>

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

      {loading ? (
        <p>Loading payment records...</p>
      ) : currentRecords.length === 0 ? (
        <p>No payment records found.</p>
      ) : (
        <div className="cashier-table-container">
          <table className="cashier-table">
            <thead>
              <tr>
                <th>Name / Student ID</th>
                <th>Reference / Stub</th>
                <th>Amount</th>
                <th>Payment Status</th>
                {activeTab !== "history" && <th>Action</th>}
              </tr>
            </thead>

            <tbody>
              {currentRecords.map((payment) => (
                <tr key={payment.id}>
                  <td>{getName(payment)}</td>
                  <td>{getReference(payment)}</td>
                  <td>
                    ₱{getAmount(payment).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    {payment.payment_status || "UNPAID"}
                  </td>

                  {activeTab !== "history" && (
                    <td>
                      <button
                        onClick={() =>
                          confirmPayment(
                            activeTab === "documents"
                              ? "document_requests"
                              : "itemReservations",
                            payment
                          )
                        }
                      >
                        Payment Completed
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
