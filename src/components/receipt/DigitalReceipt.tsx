import { useEffect, useState } from "react";

import { subscribeToDocumentRequestDetails } from "../../services/documentRequests";
import { toDate } from "../../utils/format";
import { downloadReceiptImage } from "./receiptImage";

import "./DigitalReceipt.css";

/*
 * Digital receipt shown to a student after the Cashier confirms payment.
 * It "prints" out of a small receipt printer: the paper feeds out line by
 * line, then a PAID stamp lands on it. People who prefer reduced motion
 * see the finished receipt straight away.
 */

export type ReceiptLine = {
  label: string;
  detail?: string;
  amount: number;
};

export type ReceiptData = {
  kind: "DOCUMENT" | "ITEM";
  receiptNumber: string;
  referenceId: string;
  /** Firestore request_id, used to load document lines. */
  requestId?: string;
  paidAt: unknown;
  amount: number;
  cashierName?: string;
  paymentStubCode?: string;
  claimCode?: string;
  studentName: string;
  studentId: string;
  /** Lines known up front (item reservations). */
  lines?: ReceiptLine[];
};

const PRINT_MS = 1500;

export default function DigitalReceipt({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const [run, setRun] = useState(0); // bump to print again
  const [printed, setPrinted] = useState(false);
  const [lines, setLines] = useState<ReceiptLine[]>(receipt.lines ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleDownload() {
    setSaving(true);
    setSaveError("");
    try {
      await downloadReceiptImage(receipt, lines, toDate(receipt.paidAt));
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Couldn't download the receipt."
      );
    } finally {
      setSaving(false);
    }
  }

  // Document requests keep their documents in a separate collection.
  useEffect(() => {
    if (receipt.kind !== "DOCUMENT" || !receipt.requestId) return;

    return subscribeToDocumentRequestDetails(receipt.requestId, (rows) =>
      setLines(
        rows.map((row) => {
          const type = String(row.document_type || "Document");
          const quantity = Number(row.quantity || 1);
          const unitPrice = Number(row.unit_price || 0);

          return {
            label:
              type === "Others"
                ? String(row.custom_document_name || "Other document")
                : type,
            detail: `${quantity} × ${peso(unitPrice)}`,
            amount: Number(row.subtotal ?? quantity * unitPrice),
          };
        })
      )
    );
  }, [receipt.kind, receipt.requestId]);

  // Finish state after the print animation (instantly for reduced motion).
  useEffect(() => {
    setPrinted(false);

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const timer = window.setTimeout(
      () => setPrinted(true),
      reduced ? 0 : PRINT_MS + 350
    );

    return () => window.clearTimeout(timer);
  }, [run]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const paidAt = toDate(receipt.paidAt);
  const isDocument = receipt.kind === "DOCUMENT";

  return (
    <div
      className="rcp-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`rcp ${printed ? "is-printed" : "is-printing"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rcp-title"
      >
        <p className="rcp-status" aria-live="polite">
          {printed ? "Payment received" : "Printing your receipt…"}
        </p>

        {/* ===== Printer ===== */}

        <div className="rcp-printer" aria-hidden="true">
          <span className="rcp-printer__light" />
          <span className="rcp-printer__brand">campuserve.</span>
          <span className="rcp-printer__slot" />
        </div>

        {/* ===== Paper (remounted to print again) ===== */}

        <div className="rcp-feed" key={run}>
          <article className="rcp-paper">
            <header className="rcp-paper__head">
              <strong>CAMPUSERVE</strong>
              <small>Pangasinan State University · Lingayen</small>
              <h2 id="rcp-title">PAYMENT RECEIPT</h2>
            </header>

            <dl className="rcp-meta">
              <div>
                <dt>Receipt no.</dt>
                <dd>{receipt.receiptNumber || "—"}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>
                  {paidAt
                    ? paidAt.toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Received from</dt>
                <dd>{receipt.studentName}</dd>
              </div>
              <div>
                <dt>Student ID</dt>
                <dd>{receipt.studentId || "—"}</dd>
              </div>
              <div>
                <dt>{isDocument ? "Request" : "Reservation"}</dt>
                <dd>{receipt.referenceId}</dd>
              </div>
            </dl>

            <div className="rcp-rule" />

            <ul className="rcp-lines">
              {lines.length === 0 ? (
                <li>
                  <span>
                    {isDocument ? "Document request" : "Item reservation"}
                  </span>
                  <b>{peso(receipt.amount)}</b>
                </li>
              ) : (
                lines.map((line, index) => (
                  <li key={`${line.label}-${index}`}>
                    <span>
                      {line.label}
                      {line.detail && <small>{line.detail}</small>}
                    </span>
                    <b>{peso(line.amount)}</b>
                  </li>
                ))
              )}
            </ul>

            <div className="rcp-rule" />

            <div className="rcp-total">
              <span>TOTAL PAID</span>
              <strong>{peso(receipt.amount)}</strong>
            </div>

            <dl className="rcp-meta">
              <div>
                <dt>Paid at</dt>
                <dd>Cashier's Office</dd>
              </div>
              {receipt.cashierName && (
                <div>
                  <dt>Received by</dt>
                  <dd>{receipt.cashierName}</dd>
                </div>
              )}
              {receipt.paymentStubCode && (
                <div>
                  <dt>Payment stub</dt>
                  <dd>{receipt.paymentStubCode}</dd>
                </div>
              )}
              {!isDocument && receipt.claimCode && (
                <div>
                  <dt>Claim code</dt>
                  <dd>{receipt.claimCode}</dd>
                </div>
              )}
            </dl>

            <div className="rcp-rule" />

            <p className="rcp-next">
              {isDocument
                ? "Your request is now in the Registrar's processing queue. We'll notify you when it's ready for claiming."
                : "Your reservation is paid. Show your claim code when you pick up your items."}
            </p>

            <p className="rcp-thanks">Thank you!</p>

            <span className="rcp-stamp" aria-hidden="true">
              PAID
            </span>
          </article>
        </div>

        {saveError && (
          <p className="rcp-error" role="alert">
            {saveError}
          </p>
        )}

        <div className="rcp-actions rcp-actions--three">
          <button
            type="button"
            className="rcp-btn rcp-btn--soft"
            onClick={() => setRun((value) => value + 1)}
            disabled={!printed}
          >
            Print again
          </button>
          <button
            type="button"
            className="rcp-btn rcp-btn--soft rcp-btn--download"
            onClick={handleDownload}
            disabled={!printed || saving}
          >
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
              <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 15.5h12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {saving ? "Saving…" : "Download"}
          </button>
          <button
            type="button"
            className="rcp-btn rcp-btn--primary"
            onClick={onClose}
            autoFocus
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
