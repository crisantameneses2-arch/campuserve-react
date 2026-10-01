import { DOCUMENTS } from "../../constants/documents";

export interface SelectedDocument {
  id: string;
  document_type: string;
  custom_document_name: string | null;
  quantity: number;
  unit_price: number | null;
  subtotal: number | null;
}

interface StepDocumentsProps {
  selectedDocuments: SelectedDocument[];
  onToggleDocument: (documentId: string) => void;
  onQuantityChange: (
    documentId: string,
    quantity: number
  ) => void;
  onCustomNameChange: (
    documentId: string,
    customName: string
  ) => void;
}

export default function StepDocuments({
  selectedDocuments,
  onToggleDocument,
  onQuantityChange,
  onCustomNameChange,
}: StepDocumentsProps) {
  return (
    <div>
      <h2>Type of Document</h2>

      <p>
        Select one or more documents. Each document can have
        1 to 5 copies.
      </p>

      <div>
        {DOCUMENTS.map((document) => {
          const selected = selectedDocuments.find(
            (item) => item.id === document.id
          );

          return (
            <div
              key={document.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(selected)}
                  onChange={() =>
                    onToggleDocument(document.id)
                  }
                />

                {" "}

                <strong>{document.name}</strong>

                {document.price !== null && (
                  <span>
                    {" "}— ₱{document.price}
                  </span>
                )}

                {document.price === null && (
                  <span> — Custom document</span>
                )}
              </label>

              {selected && (
                <div style={{ marginTop: "12px" }}>
                  <label>
                    Quantity:
                    {" "}

                    <button
                      type="button"
                      onClick={() =>
                        onQuantityChange(
                          document.id,
                          Math.max(
                            1,
                            selected.quantity - 1
                          )
                        )
                      }
                    >
                      -
                    </button>

                    <span
                      style={{
                        margin: "0 12px",
                      }}
                    >
                      {selected.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        onQuantityChange(
                          document.id,
                          Math.min(
                            5,
                            selected.quantity + 1
                          )
                        )
                      }
                    >
                      +
                    </button>
                  </label>

                  {document.id === "others" && (
                    <div style={{ marginTop: "12px" }}>
                      <label>
                        Custom document name:
                        <br />

                        <input
                          type="text"
                          value={
                            selected.custom_document_name ??
                            ""
                          }
                          onChange={(event) =>
                            onCustomNameChange(
                              document.id,
                              event.target.value
                            )
                          }
                          placeholder="Example: Certificate of Enrollment"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}