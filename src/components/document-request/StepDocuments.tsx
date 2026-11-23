import { DOCUMENTS } from "../../constants/documents";
import { formatPeso } from "./formatPeso";

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
    <section className="rwx-screen">
      <div className="rwx-screen-heading">
        <div>
          <span className="rwx-eyebrow">
            STEP 02 · DOCUMENT SELECTION
          </span>

          <h2>What documents do you need?</h2>

          <p>
            Select one or more documents. Each document can have 1
            to 5 copies.
          </p>
        </div>

        {selectedDocuments.length > 0 && (
          <span className="rwx-chip">
            {selectedDocuments.length} SELECTED
          </span>
        )}
      </div>

      <div className="rwx-doc-grid">
        {DOCUMENTS.map((document) => {
          const selected = selectedDocuments.find(
            (item) => item.id === document.id
          );

          const inputId = `rwx-doc-${document.id}`;

          return (
            <div
              key={document.id}
              className={`rwx-doc ${selected ? "is-selected" : ""}`}
            >
              <label className="rwx-doc__main" htmlFor={inputId}>
                <input
                  id={inputId}
                  className="rwx-visually-hidden"
                  type="checkbox"
                  checked={Boolean(selected)}
                  onChange={() =>
                    onToggleDocument(document.id)
                  }
                />

                <span className="rwx-doc__symbol" aria-hidden="true">
                  <DocumentIcon id={document.id} />
                </span>

                <span className="rwx-doc__copy">
                  <strong>{document.name}</strong>

                  <small>
                    {document.price !== null
                      ? `${formatPeso(document.price)} per copy`
                      : "Specify a document not listed here"}
                  </small>
                </span>

                <span className="rwx-doc__check" aria-hidden="true">
                  ✓
                </span>
              </label>

              {selected && (
                <div className="rwx-doc__extra">
                  {document.id === "others" && (
                    <div className="rwx-field rwx-field--compact">
                      <label htmlFor={`${inputId}-name`}>
                        Document name
                      </label>

                      <input
                        id={`${inputId}-name`}
                        className="rwx-input"
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
                    </div>
                  )}

                  <div className="rwx-qty-row">
                    <span className="rwx-qty-label">Copies</span>

                    <div
                      className="rwx-qty"
                      role="group"
                      aria-label={`Copies of ${document.name}`}
                    >
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
                        disabled={selected.quantity <= 1}
                        aria-label="Fewer copies"
                      >
                        −
                      </button>

                      <span aria-live="polite">
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
                        disabled={selected.quantity >= 5}
                        aria-label="More copies"
                      >
                        +
                      </button>
                    </div>

                    <span className="rwx-qty-subtotal">
                      {selected.subtotal !== null
                        ? formatPeso(selected.subtotal)
                        : "Price set by registrar"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DocumentIcon({ id }: { id: string }) {
  const common = {
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case "diploma":
      return (
        <svg {...common}>
          <rect x="5" y="8" width="22" height="15" rx="2" />
          <path d="M10 13h12M10 17h7" />
          <circle cx="22" cy="23" r="3.2" />
          <path d="m20.5 25.8-.8 3.2 2.3-1.2 2.3 1.2-.8-3.2" />
        </svg>
      );

    case "transfer":
      return (
        <svg {...common}>
          <path d="M8 4h11l6 6v18H8z" />
          <path d="M19 4v6h6" />
          <path d="M12 19h9m-3-3 3 3-3 3" />
        </svg>
      );

    case "cav":
    case "authentication":
      return (
        <svg {...common}>
          <path d="M16 4 25 8v7c0 6-3.8 10-9 13-5.2-3-9-7-9-13V8z" />
          <path d="m11 16 3.2 3.2L21 12" />
        </svg>
      );

    case "certified_true_copy":
      return (
        <svg {...common}>
          <rect x="10" y="9" width="15" height="19" rx="2" />
          <path d="M7 23V6a2 2 0 0 1 2-2h11" />
          <path d="m14 19 2.3 2.3L21 16.5" />
        </svg>
      );

    case "report_rating":
      return (
        <svg {...common}>
          <path d="M6 6h20v20H6z" />
          <path d="M11 21v-5m5 5V11m5 10v-8" />
        </svg>
      );

    case "others":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 10v12M10 16h12" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path d="M8 4h16v24H8z" />
          <path d="M12 10h8M12 15h8M12 20h8M12 24h5" />
        </svg>
      );
  }
}
