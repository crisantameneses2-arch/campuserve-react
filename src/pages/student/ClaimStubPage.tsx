import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { createClaimRequest, verifyClaimCode } from "../../services/claiming";

type ClaimStub = {
  id: string;
  claimStubId?: string;
  claimCode?: string;
  claimType?: "DOCUMENT" | "ITEM";
  referenceId?: string;
  claimDate?: string;
  timeSlot?: string;
  pickupDate?: string;
  pickupTime?: string;
  office?: string;
  totalAmount?: number;
  status?: string;
  createdAt?: unknown;
};

type Props = { studentId: string; onBack: () => void };

export default function ClaimStubPage({ studentId, onBack }: Props) {
  const [stubs, setStubs] = useState<ClaimStub[]>([]);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [claimType, setClaimType] = useState<"DOCUMENT" | "ITEM">("DOCUMENT");
  const [claimCode, setClaimCode] = useState("");
  const [message, setMessage] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!studentId) { setStubs([]); setLoading(false); return; }
    const q = query(collection(db, "claimStubs"), where("studentId", "==", studentId));
    return onSnapshot(q, (snap) => {
      setStubs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClaimStub, "id">) })));
      setLoading(false);
    }, (error) => { console.error("Could not load claim stubs:", error); setStubs([]); setLoading(false); });
  }, [studentId]);

  async function handleVerify() {
    if (!claimCode.trim()) { setMessage("Please enter your claim code."); return; }
    try {
      setVerifying(true); setMessage("");
      const result = await verifyClaimCode(claimCode, studentId, claimType);
      if (!result.matched || !result.claimStub) { setMessage("The claim code does not match a valid claim for this account."); return; }
      await createClaimRequest(result.claimStub);
      setMessage("Claim code matched successfully. The Registrar has been notified.");
    } catch (error) {
      console.error("Claim verification failed:", error);
      setMessage("Something went wrong while verifying your claim.");
    } finally { setVerifying(false); }
  }

  return (
    <section className="page-card">
      <div className="page-heading">
        <span className="section-kicker">CLAIM & RELEASE</span>
        <h1>Claim & Release</h1>
        <p>Your document and item claim stubs are shown here when they are ready for pickup.</p>
      </div>

      {loading ? <div className="dashboard-loading"><span className="dashboard-spinner" /><span>Loading claim stubs...</span></div> : stubs.length === 0 ? (
        <div className="empty-widget"><strong>No claim stubs yet</strong><p>When a document or item reservation is ready for pickup, its claim stub will appear here.</p></div>
      ) : (
        <div className="recent-transaction-list">
          {stubs.map((stub) => {
            const type = stub.claimType === "ITEM" ? "Item Reservation" : "Document Request";
            const date = stub.claimType === "ITEM" ? stub.pickupDate : stub.claimDate;
            const time = stub.claimType === "ITEM" ? stub.pickupTime : stub.timeSlot;
            return (
              <div className="transaction-row" key={stub.id}>
                <span className="transaction-row__icon">{stub.claimType === "ITEM" ? "▣" : "▤"}</span>
                <div className="transaction-row__main">
                  <strong>{type}</strong>
                  <span>ID {stub.referenceId || "—"}</span>
                  {date && <small>{date}{time ? ` · ${time}` : ""}</small>}
                  <small>Claim Code: <strong>{stub.claimCode || "—"}</strong></small>
                </div>
                <span className={`status-badge status-badge--${String(stub.status || "PENDING").toLowerCase()}`}>{String(stub.status || "PENDING").replace(/_/g, " ")}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <h2>Verify Claim Code</h2>
        <p>Use this when you are ready to submit your claim to the Registrar.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          <button type="button" className="transaction-filter active" onClick={() => setClaimType("DOCUMENT")}>Document</button>
          <button type="button" className={`transaction-filter ${claimType === "ITEM" ? "active" : ""}`} onClick={() => setClaimType("ITEM")}>Item</button>
        </div>
        <input value={claimCode} onChange={(e) => setClaimCode(e.target.value.toUpperCase())} placeholder="Enter claim code" disabled={verifying} style={{ width: "100%", maxWidth: 420, padding: 12, border: "1px solid #d7dce3", borderRadius: 10 }} />
        <div style={{ marginTop: 10 }}><button type="button" className="transaction-filter active" onClick={handleVerify} disabled={verifying}>{verifying ? "Checking..." : "Verify Claim Code"}</button></div>
        {message && <p style={{ marginTop: 12 }}>{message}</p>}
      </div>

      <button type="button" className="dashboard-back" onClick={onBack} style={{ marginTop: 24 }}>← Back to Dashboard</button>
    </section>
  );
}
