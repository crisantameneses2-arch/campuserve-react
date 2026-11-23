import type { SelectedDocument } from "./StepDocuments";
import { formatPeso } from "./formatPeso";

interface StepDetailsProps {
  purpose: string;
  onPurposeChange: (purpose: string) => void;
  selectedDocuments: SelectedDocument[];
  numberOfCopies: number;
  totalAmount: number;
}

export default function StepDetails({
  purpose,
  onPurposeChange,
  selectedDocuments,
  totalAmount,
}: StepDetailsProps) {
  const hasUnpriced = selectedDocuments.some(
    (document) => document.unit_price === null
  );

  // With a single document, its subtotal is the total — don't repeat it.
  const showRowSubtotals = selectedDocuments.length > 1;

  return (
    <section className="rwx-screen">
      <div className="rwx-screen-heading">
        <div>
          <span className="rwx-eyebrow">
            STEP 03 · REQUEST DETAILS
          </span>

          <h2>What is the request for?</h2>

          <p>
            Tell the Registrar why you need these documents, then
            review your request before submitting.
          </p>
        </div>
      </div>

      <div className="rwx-details-grid">
        <div className="rwx-field">
          <label htmlFor="rwx-purpose">Purpose of request</label>

          <textarea
            id="rwx-purpose"
            className="rwx-input rwx-textarea"
            value={purpose}
            onChange={(event) =>
              onPurposeChange(event.target.value)
            }
            placeholder="Enter the purpose of your request"
            rows={6}
          />

          <small>
            Examples: scholarship application, employment
            requirement, transfer to another school.
          </small>
        </div>

        <aside className="rwx-summary" aria-label="Request summary">
          <span className="rwx-eyebrow">REQUEST SUMMARY</span>

          <div className="rwx-summary__list">
            {selectedDocuments.map((document) => (
              <div className="rwx-summary__row" key={document.id}>
                <div>
                  <strong>
                    {document.document_type === "Others"
                      ? document.custom_document_name ||
                        "Others"
                      : document.document_type}
                  </strong>

                  <small>
                    {document.quantity}{" "}
                    {document.quantity === 1 ? "copy" : "copies"}
                    {document.unit_price !== null &&
                      document.quantity > 1 &&
                      ` × ${formatPeso(document.unit_price)}`}
                  </small>
                </div>

                {document.unit_price === null ? (
                  <span>No price yet</span>
                ) : (
                  showRowSubtotals && (
                    <span>{formatPeso(document.subtotal)}</span>
                  )
                )}
              </div>
            ))}
          </div>

          <div className="rwx-total">
            <div>
              <span>Total amount</span>
              <strong className="rwx-total__amount">
                {formatPeso(totalAmount)}
              </strong>
            </div>
          </div>

          <p className="rwx-summary__note">
            Payment is recorded for reference only. Payment is made
            at the counter.
            {hasUnpriced &&
              " Documents without a price will be assessed by the Registrar."}
          </p>
        </aside>
      </div>
    </section>
  );
}
