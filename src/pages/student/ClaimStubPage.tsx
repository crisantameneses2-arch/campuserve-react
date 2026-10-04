import { useState } from "react";

import {
  createClaimRequest,
  verifyClaimCode,
} from "../../services/claiming";

type ClaimStubPageProps = {
  studentId: string;
  //studentName?: string;
  onBack: () => void;
};

type ClaimType =
  | "DOCUMENT"
  | "ITEM";

export default function ClaimStubPage({
  studentId,
  //studentName,
  onBack,
}: ClaimStubPageProps) {

  const [claimType, setClaimType] =
    useState<ClaimType | null>(null);

  const [claimCode, setClaimCode] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [success, setSuccess] =
    useState(false);


  // ==========================================
  // VERIFY CLAIM
  // ==========================================

  const handleVerify = async () => {

    if (!claimType) {
      setMessage(
        "Please select Document or Item."
      );
      return;
    }

    if (!claimCode.trim()) {
      setMessage(
        "Please enter your claim code."
      );
      return;
    }

    try {

      setLoading(true);
      setMessage("");
      setSuccess(false);

      // --------------------------------------
      // Find claim stub
      // --------------------------------------

      const result =
        await verifyClaimCode(
          claimCode,
          studentId,
          claimType
        );


      // --------------------------------------
      // Code does not match
      // --------------------------------------

      if (!result.matched) {

        setMessage(
          "The claim code does not match any valid claim for this account."
        );

        return;
      }


      // --------------------------------------
      // Create Registrar request
      // --------------------------------------

      await createClaimRequest(
        result.claimStub
      );


      // --------------------------------------
      // Success
      // --------------------------------------

      setSuccess(true);

      setMessage(
        "Claim code matched successfully. The Registrar has been notified."
      );

    } catch (error) {

      console.error(
        "Claim verification failed:",
        error
      );

      setMessage(
        "Something went wrong while verifying your claim."
      );

    } finally {

      setLoading(false);

    }
  };


  // ==========================================
  // TYPE SELECTION
  // ==========================================

  if (!claimType) {

    return (
      <div style={styles.page}>

        <div style={styles.card}>

          <button
            type="button"
            onClick={onBack}
            style={styles.backButton}
          >
            ← Back
          </button>

          <h1>
            What Would You Like to Claim?
          </h1>

          <p style={styles.description}>
            Select the type of claim you are
            going to process.
          </p>


          <button
            type="button"
            style={styles.choiceButton}
            onClick={() =>
              setClaimType("DOCUMENT")
            }
          >
            <strong>
              Document
            </strong>

            <span>
              Claim a requested school document
            </span>
          </button>


          <button
            type="button"
            style={styles.choiceButton}
            onClick={() =>
              setClaimType("ITEM")
            }
          >
            <strong>
              Item
            </strong>

            <span>
              Claim a reserved school item
            </span>
          </button>

        </div>

      </div>
    );
  }


  // ==========================================
  // CODE ENTRY
  // ==========================================

  return (
    <div style={styles.page}>

      <div style={styles.card}>

        <button
          type="button"
          onClick={() => {
            setClaimType(null);
            setClaimCode("");
            setMessage("");
            setSuccess(false);
          }}
          style={styles.backButton}
        >
          ← Back
        </button>


        <h1>
          {claimType === "DOCUMENT"
            ? "Claim Your Document"
            : "Claim Your Reserved Item"}
        </h1>


        <p style={styles.description}>
          Enter the provided code from your
          claim stub first.
        </p>


        <label style={styles.label}>
          Claim Code
        </label>

        <input
          type="text"
          value={claimCode}
          onChange={(event) =>
            setClaimCode(
              event.target.value.toUpperCase()
            )
          }
          placeholder="Enter claim code"
          style={styles.input}
          disabled={loading || success}
        />


        <button
          type="button"
          onClick={handleVerify}
          style={styles.enterButton}
          disabled={loading || success}
        >
          {loading
            ? "Checking..."
            : "Enter"}
        </button>


        {message && (
          <div
            style={{
              ...styles.message,
              ...(success
                ? styles.success
                : styles.error),
            }}
          >
            {message}
          </div>
        )}


        {success && (
          <div style={styles.pendingBox}>

            <strong>
              Claim submitted
            </strong>

            <p>
              Please proceed to the Registrar
              and wait for your claim to be
              released.
            </p>

          </div>
        )}

      </div>

    </div>
  );
}


const styles = {

  page: {
    minHeight: "100vh",
    padding: "24px",
    backgroundColor: "#f5f7fa",
    boxSizing: "border-box" as const,
  },

  card: {
    maxWidth: "520px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "28px",
    boxShadow:
      "0 4px 14px rgba(0,0,0,0.08)",
  },

  backButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    marginBottom: "24px",
    fontSize: "14px",
  },

  description: {
    color: "#666666",
    lineHeight: 1.6,
    marginBottom: "24px",
  },

  choiceButton: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start" as const,
    gap: "6px",
    padding: "18px",
    marginBottom: "14px",
    border: "1px solid #dddddd",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    textAlign: "left" as const,
  },

  label: {
    display: "block",
    fontWeight: 600,
    marginBottom: "8px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "14px",
    border: "1px solid #cccccc",
    borderRadius: "8px",
    fontSize: "16px",
    letterSpacing: "2px",
  },

  enterButton: {
    width: "100%",
    marginTop: "16px",
    padding: "14px",
    border: "none",
    borderRadius: "8px",
    backgroundColor: "#222222",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
  },

  message: {
    marginTop: "18px",
    padding: "14px",
    borderRadius: "8px",
    lineHeight: 1.5,
  },

  success: {
    backgroundColor: "#e9f7ef",
    color: "#176b3a",
  },

  error: {
    backgroundColor: "#fdecec",
    color: "#a52828",
  },

  pendingBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "#f5f5f5",
  },
};