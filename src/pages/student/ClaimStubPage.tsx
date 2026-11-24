import { useEffect, useMemo, useState } from "react";

import {
  subscribeToDocumentRequestDetails,
  subscribeToStudentDocumentRequests,
} from "../../services/documentRequests";
import {
  formatClaimDate,
  formatClaimTime,
  formatDateTime,
  millis,
} from "../../utils/format";

import "./ClaimStubPage.css";

/*
 * Claim & Release (student side).
 *
 * When the Registrar marks a request Ready for Claiming, the system saves a
 * claim code on the request (`claim_code`, status READY_FOR_PICKUP). The
 * pickup date and period come from the claiming schedule the Registrar
 * assigned (`requested_date`, `requested_time`).
 *
 * The student only shows the code at the Registrar's window; the Registrar
 * checks it and releases the document. Nothing is entered here.
 */

type ReadyRequest = {
  key: string;
  requestId: string;
  claimCode: string;
  pickupDate: string;
  pickupPeriod: string;
  updatedAt: unknown;
  isGroup: boolean;
};

type Props = { studentId: string; onBack?: () => void };

export default function ClaimStubPage({ studentId }: Props) {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!studentId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    return subscribeToStudentDocumentRequests(studentId, (rows) => {
      setRequests(rows);
      setLoading(false);
    });
  }, [studentId]);

  const ready: ReadyRequest[] = useMemo(
    () =>
      requests
        .filter(
          (row) =>
            String(row.status || "").toUpperCase() === "READY_FOR_PICKUP" &&
            row.claim_code
        )
        .map((row) => ({
          key: String(row.request_id || ""),
          requestId: String(row.request_id || ""),
          claimCode: String(row.claim_code),
          pickupDate: String(row.requested_date || ""),
          pickupPeriod: String(row.requested_time || ""),
          updatedAt: row.ready_for_pickup_at ?? row.updated_at,
          isGroup: Boolean(row.is_group_member || row.is_group_request),
        }))
        .filter((row) => row.requestId)
        .sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt)),
    [requests]
  );

  // Document names for each ready request ("Good Moral Certificate", …).
  const readyIds = ready.map((row) => row.requestId).join("|");

  useEffect(() => {
    if (!readyIds) return;

    const unsubscribers = readyIds.split("|").map((requestId) =>
      subscribeToDocumentRequestDetails(requestId, (details) => {
        const label = details
          .map((detail) => {
            const type = String(detail.document_type || "");
            const custom = String(detail.custom_document_name || "");

            return type === "Others" ? custom || "Other document" : type;
          })
          .filter(Boolean)
          .join(", ");

        setNames((previous) => ({ ...previous, [requestId]: label }));
      })
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [readyIds]);

  // Keep the selection valid when a document is released.
  const selected = ready.find((row) => row.key === selectedId) ?? null;

  const titleFor = (row: ReadyRequest) =>
    names[row.requestId] || "Document request";

  return (
    <section className="cst" aria-labelledby="cst-title">
      <header className="cst-head">
        <span className="cst-kicker">CLAIM &amp; RELEASE</span>
        <h1 id="cst-title">Your claim-ready documents</h1>
        <p>
          Select a document marked <strong>Ready for Claiming</strong> to see
          its claim code. Show the code at the Registrar's window; the
          Registrar checks it and releases your document.
        </p>
      </header>

      <div className="cst-grid">
        {/* ===== Ready list ===== */}

        <div className="cst-card cst-list">
          <div className="cst-list__head">
            <h2>Ready to claim</h2>
            {!loading && (
              <span className="cst-chip">
                {ready.length} document{ready.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {loading ? (
            <p className="cst-muted">Loading your documents…</p>
          ) : ready.length === 0 ? (
            <div className="cst-empty">
              <strong>Nothing to claim yet</strong>
              <p>
                When the Registrar marks one of your documents Ready for
                Claiming, it will appear here with its claim code.
              </p>
            </div>
          ) : (
            <div className="cst-items" role="list">
              {ready.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  role="listitem"
                  className={`cst-item ${selected?.key === row.key ? "is-active" : ""}`}
                  aria-pressed={selected?.key === row.key}
                  onClick={() => setSelectedId(row.key)}
                >
                  <span className="cst-item__body">
                    <strong>{titleFor(row)}</strong>
                    <small>
                      {row.requestId}
                      {row.updatedAt ? ` · Ready ${formatDateTime(row.updatedAt)}` : ""}
                    </small>
                  </span>
                  <span className="cst-chip cst-chip--ready">Ready</span>
                </button>
              ))}
            </div>
          )}

          <p className="cst-foot">
            Documents still being reviewed, paid for or processed are not
            listed here. Released documents move to your Transaction History.
          </p>
        </div>

        {/* ===== Claim stub ===== */}

        <div className="cst-card cst-detail">
          {!selected ? (
            <div className="cst-placeholder">
              <span className="cst-placeholder__mark" aria-hidden="true">
                CS
              </span>
              <strong>Choose a ready document</strong>
              <p>
                Your claim stub will appear here with your claim code and
                pickup schedule.
              </p>
            </div>
          ) : (
            <article className="cst-stub" aria-label="Claim stub">
              <header className="cst-stub__top">
                <span>YOUR CLAIM STUB</span>
                <h2>{titleFor(selected)}</h2>
                <small>{selected.requestId}</small>
              </header>

              <div className="cst-stub__body">
                <span className="cst-label">CLAIM CODE</span>
                <div className="cst-code" aria-label={`Claim code ${selected.claimCode}`}>
                  {selected.claimCode}
                </div>
                <p className="cst-code-hint">
                  Show this code to the Registrar when you claim your document.
                </p>

                <dl className="cst-rows">
                  <div>
                    <dt>Status</dt>
                    <dd>Ready for Claiming</dd>
                  </div>
                  <div>
                    <dt>Pickup date</dt>
                    <dd>
                      {selected.pickupDate
                        ? formatClaimDate(selected.pickupDate)
                        : "To be set by the Registrar"}
                    </dd>
                  </div>
                  <div>
                    <dt>Pickup time</dt>
                    <dd>
                      {selected.pickupPeriod
                        ? formatClaimTime(selected.pickupPeriod)
                        : "To be set by the Registrar"}
                    </dd>
                  </div>
                  <div>
                    <dt>Pickup office</dt>
                    <dd>Registrar's Office</dd>
                  </div>
                  <div>
                    <dt>Bring</dt>
                    <dd>Valid student ID</dd>
                  </div>
                  {selected.isGroup && (
                    <div>
                      <dt>Request type</dt>
                      <dd>Group request</dd>
                    </div>
                  )}
                </dl>

                <p className="cst-note">
                  The pickup schedule is assigned by the Registrar. If you
                  can't come on that date, message the Registrar Office from
                  Messages.
                </p>
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
