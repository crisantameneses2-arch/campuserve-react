import type { SelectedDocument } from "./StepDocuments";

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
  numberOfCopies,
  totalAmount,
}: StepDetailsProps) {
  return (
    <div>
      <h2>Request Details</h2>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Purpose
          <br />

          <textarea
            value={purpose}
            onChange={(event) =>
              onPurposeChange(event.target.value)
            }
            placeholder="Enter the purpose of your request"
            rows={4}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <h3>Selected Documents</h3>

      {selectedDocuments.map((document) => (
        <div
          key={document.id}
          style={{
            padding: "12px 0",
            borderBottom: "1px solid #ddd",
          }}
        >
          <strong>
            {document.document_type === "Others"
              ? document.custom_document_name ||
                "Others"
              : document.document_type}
          </strong>

          <div>
            {document.quantity}{" "}
            {document.quantity === 1
              ? "copy"
              : "copies"}

            {document.unit_price !== null && (
              <>
                {" "}× ₱{document.unit_price}
                {" "}— ₱{document.subtotal}
              </>
            )}

            {document.unit_price === null && (
              <> — No price assigned</>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: "20px" }}>
        <strong>Total Copies: </strong>
        {numberOfCopies}
      </div>

      <div style={{ marginTop: "8px" }}>
        <strong>Total Amount: </strong>
        ₱{totalAmount}
      </div>

      <small>
        Payment is recorded for reference only. Payment is
        made at the counter.
      </small>
    </div>
  );
}