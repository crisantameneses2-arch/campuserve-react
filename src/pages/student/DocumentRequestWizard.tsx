import { useMemo, useState } from "react";

import StepProgress from "../../components/document-request/StepProgress";
import StepMethod from "../../components/document-request/StepMethod";
import StepDocuments, {
  type SelectedDocument,
} from "../../components/document-request/StepDocuments";
import StepDetails from "../../components/document-request/StepDetails";
import StepSchedule from "../../components/document-request/StepSchedule";

import {
  createDocumentDetails,
  createDocumentRequest,
  createGroupMembers,
} from "../../services/documentRequests";

import { SCHEDULE } from "../../constants/schedule";
import { DOCUMENTS } from "../../constants/documents";

type DocumentRequestWizardProps = {
  studentId: string;
};

export default function DocumentRequestWizard({
  studentId,
}: DocumentRequestWizardProps) {
  // --------------------------------------------------
  // WIZARD STATE
  // --------------------------------------------------

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [requestMethod, setRequestMethod] =
    useState<"OWN" | "WITH_OTHERS">("OWN");

  const [groupMembers, setGroupMembers] = useState<
    {
      student_id: string;
      invitation_status:
        | "PENDING"
        | "ACCEPTED"
        | "DECLINED";
    }[]
  >([]);

  // Step 2
  const [selectedDocuments, setSelectedDocuments] =
    useState<SelectedDocument[]>([]);

  // Step 3
  const [purpose, setPurpose] = useState("");

  // Step 4
  const [requestedDate, setRequestedDate] =
    useState("");

  const [requestedTime, setRequestedTime] =
    useState("");

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successRequestId, setSuccessRequestId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // CALCULATED VALUES
  // --------------------------------------------------

  const numberOfCopies = useMemo(() => {
    return selectedDocuments.reduce(
      (total, document) =>
        total + document.quantity,
      0
    );
  }, [selectedDocuments]);

  const totalAmount = useMemo(() => {
    return selectedDocuments.reduce(
      (total, document) =>
        total + (document.subtotal ?? 0),
      0
    );
  }, [selectedDocuments]);

  // --------------------------------------------------
  // DOCUMENT CATALOG
  // --------------------------------------------------

  function getCatalogDocument(documentId: string) {
    return DOCUMENTS.find(
      (document) => document.id === documentId
    );
  }

  // --------------------------------------------------
  // STEP 1 - REQUEST METHOD
  // --------------------------------------------------

  function addGroupMember(memberStudentId: string) {
    const cleanedStudentId =
      memberStudentId.trim();

    if (!cleanedStudentId) {
      return;
    }

    // Prevent the logged-in student
    // from adding themselves.
    if (
      cleanedStudentId === studentId
    ) {
      return;
    }

    // Prevent duplicate members.
    if (
      groupMembers.some(
        (member) =>
          member.student_id ===
          cleanedStudentId
      )
    ) {
      return;
    }

    setGroupMembers((current) => [
      ...current,
      {
        student_id:
          cleanedStudentId,
        invitation_status:
          "PENDING",
      },
    ]);
  }

  function removeGroupMember(
    memberStudentId: string
  ) {
    setGroupMembers((current) =>
      current.filter(
        (member) =>
          member.student_id !==
          memberStudentId
      )
    );
  }

  // --------------------------------------------------
  // STEP 2 - DOCUMENT SELECTION
  // --------------------------------------------------

  function toggleDocument(
    documentId: string
  ) {
    setSelectedDocuments((current) => {
      const existing = current.find(
        (item) =>
          item.id === documentId
      );

      // If already selected, remove it.
      if (existing) {
        return current.filter(
          (item) =>
            item.id !== documentId
        );
      }

      // Find the document in the
      // central catalog.
      const catalogDocument =
        getCatalogDocument(
          documentId
        );

      if (!catalogDocument) {
        return current;
      }

      // Add new document.
      return [
        ...current,
        {
          id: catalogDocument.id,

          document_type:
            catalogDocument.id ===
            "others"
              ? "Others"
              : catalogDocument.name,

          custom_document_name:
            catalogDocument.id ===
            "others"
              ? ""
              : null,

          quantity: 1,

          unit_price:
            catalogDocument.price,

          subtotal:
            catalogDocument.price,
        },
      ];
    });
  }

  function changeQuantity(
    documentId: string,
    quantity: number
  ) {
    // Keep quantity between 1 and 5.
    const safeQuantity = Math.min(
      5,
      Math.max(1, quantity)
    );

    setSelectedDocuments((current) =>
      current.map((document) => {
        if (
          document.id !== documentId
        ) {
          return document;
        }

        const subtotal =
          document.unit_price === null
            ? null
            : document.unit_price *
              safeQuantity;

        return {
          ...document,
          quantity: safeQuantity,
          subtotal,
        };
      })
    );
  }

  function changeCustomName(
    documentId: string,
    customName: string
  ) {
    setSelectedDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? {
              ...document,
              custom_document_name:
                customName,
            }
          : document
      )
    );
  }

  // --------------------------------------------------
  // STEP 4 - SCHEDULE VALIDATION
  // --------------------------------------------------

  function validateSchedule(): string | null {
    if (!requestedDate) {
      return "Please select a claiming date.";
    }

    if (!requestedTime) {
      return "Please select a claiming time.";
    }

    const [hourText, minuteText] =
      requestedTime.split(":");

    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute)
    ) {
      return "Please enter a valid claiming time.";
    }

    const totalMinutes =
      hour * 60 + minute;

    const startMinutes =
      SCHEDULE.START_HOUR * 60;

    const endMinutes =
      SCHEDULE.END_HOUR * 60;

    const lunchStart =
      SCHEDULE.LUNCH_START_HOUR * 60;

    const lunchEnd =
      SCHEDULE.LUNCH_END_HOUR * 60;

    // Outside 8:00 AM - 5:00 PM.
    if (
      totalMinutes < startMinutes ||
      totalMinutes > endMinutes
    ) {
      return (
        "Claiming time must be between " +
        "8:00 AM and 5:00 PM."
      );
    }

    // Lunch break: 12:00 PM - 1:00 PM.
    if (
      totalMinutes >= lunchStart &&
      totalMinutes < lunchEnd
    ) {
      return (
        "12:00 PM to 1:00 PM is unavailable."
      );
    }

    return null;
  }

  // --------------------------------------------------
  // VALIDATION
  // --------------------------------------------------

  function validateMethod(): string | null {
    if (
      requestMethod ===
        "WITH_OTHERS" &&
      groupMembers.length === 0
    ) {
      return (
        "Please add at least one other student."
      );
    }

    return null;
  }

  function validateDocuments(): string | null {
    // At least one document.
    if (
      selectedDocuments.length === 0
    ) {
      return (
        "Please select at least one document."
      );
    }

    // Check every selected document.
    for (const document of selectedDocuments) {
      // Quantity must be 1-5.
      if (
        document.quantity < 1 ||
        document.quantity > 5
      ) {
        return (
          "Each document quantity must " +
          "be between 1 and 5."
        );
      }

      // Others requires a custom name.
      if (
        document.document_type ===
          "Others" &&
        !document.custom_document_name?.trim()
      ) {
        return (
          "Please enter the custom document " +
          "name for Others."
        );
      }
    }

    return null;
  }

  function validateDetails(): string | null {
    if (!purpose.trim()) {
      return (
        "Please enter the purpose of the request."
      );
    }

    return null;
  }

  function validateCurrentStep(): string | null {
    if (currentStep === 1) {
      return validateMethod();
    }

    if (currentStep === 2) {
      return validateDocuments();
    }

    if (currentStep === 3) {
      return validateDetails();
    }

    if (currentStep === 4) {
      return validateSchedule();
    }

    return null;
  }

  function validateEverything(): string | null {
    const methodError =
      validateMethod();

    if (methodError) {
      return methodError;
    }

    const documentError =
      validateDocuments();

    if (documentError) {
      return documentError;
    }

    const detailsError =
      validateDetails();

    if (detailsError) {
      return detailsError;
    }

    const scheduleError =
      validateSchedule();

    if (scheduleError) {
      return scheduleError;
    }

    return null;
  }

  // --------------------------------------------------
  // WIZARD NAVIGATION
  // --------------------------------------------------

  function handleNext() {
    setError("");

    const validationError =
      validateCurrentStep();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (currentStep < 4) {
      setCurrentStep(
        (step) => step + 1
      );
    }
  }

  function handleBack() {
    setError("");

    if (currentStep > 1) {
      setCurrentStep(
        (step) => step - 1
      );
    }
  }

  function handleStepClick(
    step: number
  ) {
    setError("");

    // Only allow going backward
    // or staying on the current step.
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  }

  // --------------------------------------------------
  // SUBMIT REQUEST
  // --------------------------------------------------

  async function handleSubmit() {
    setError("");

    const validationError =
      validateEverything();

    if (validationError) {
      setError(validationError);
      return;
    }

    // Make sure there is a real
    // logged-in student ID.
    if (!studentId.trim()) {
      setError(
        "Your student account could not be identified. Please log in again."
      );
      return;
    }

    // Prevent duplicate submissions.
    if (loading) {
      return;
    }

    try {
      setLoading(true);

      // ----------------------------------------------
      // 1. Create the parent request
      // ----------------------------------------------

      const requestId =
        await createDocumentRequest({
          // IMPORTANT:
          // Use the actual logged-in student.
          student_id:
            studentId,

          request_method:
            requestMethod,

          purpose:
            purpose.trim(),

          requested_date:
            requestedDate,

          requested_time:
            requestedTime,

          number_of_copies:
            numberOfCopies,

          total_amount:
            totalAmount,
        });

      // ----------------------------------------------
      // 2. Create document detail records
      // ----------------------------------------------

      await createDocumentDetails(
        requestId,
        selectedDocuments.map(
          (document) => ({
            document_type:
              document.document_type,

            custom_document_name:
              document.document_type ===
              "Others"
                ? document
                    .custom_document_name
                    ?.trim() || null
                : null,

            quantity:
              document.quantity,

            unit_price:
              document.unit_price,

            subtotal:
              document.subtotal,
          })
        )
      );

      // ----------------------------------------------
      // 3. Create group member records
      // ----------------------------------------------

      if (
        requestMethod ===
        "WITH_OTHERS"
      ) {
        await createGroupMembers(
          requestId,
          groupMembers
        );
      }

      // ----------------------------------------------
      // 4. Show success
      // ----------------------------------------------

      setSuccessRequestId(
        requestId
      );
    } catch (submitError) {
      console.error(
        "Document request submission error:",
        submitError
      );

      setError(
        "Something went wrong while " +
        "submitting the request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // RESET FORM
  // --------------------------------------------------

  function resetForm() {
    setCurrentStep(1);

    setRequestMethod("OWN");

    setGroupMembers([]);

    setSelectedDocuments([]);

    setPurpose("");

    setRequestedDate("");

    setRequestedTime("");

    setLoading(false);

    setError("");

    setSuccessRequestId(null);
  }

  // --------------------------------------------------
  // SUCCESS SCREEN
  // --------------------------------------------------

  if (successRequestId) {
    return (
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "24px",
        }}
      >
        <h1>
          Successfully Sent!
        </h1>

        <p>
          Your document request has
          been submitted successfully.
        </p>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "16px",
            marginTop: "16px",
          }}
        >
          <p>
            <strong>
              Request ID:
            </strong>{" "}
            {successRequestId}
          </p>

          <p>
            <strong>
              Student ID:
            </strong>{" "}
            {studentId}
          </p>

          <p>
            <strong>
              Status:
            </strong>{" "}
            Pending
          </p>

          <p>
            <strong>
              Date:
            </strong>{" "}
            {requestedDate}
          </p>

          <p>
            <strong>
              Time:
            </strong>{" "}
            {requestedTime}
          </p>
        </div>

        <button
          type="button"
          onClick={resetForm}
          style={{
            marginTop: "20px",
          }}
        >
          Create Another Request
        </button>
      </div>
    );
  }

  // --------------------------------------------------
  // MAIN WIZARD UI
  // --------------------------------------------------

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>
        Online Document Request
      </h1>

      <StepProgress
        currentStep={currentStep}
        onStepClick={handleStepClick}
      />

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            border: "1px solid #cc0000",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* STEP 1 - METHOD                            */}
      {/* ------------------------------------------- */}

      {currentStep === 1 && (
        <StepMethod
          requestMethod={
            requestMethod
          }
          onRequestMethodChange={
            setRequestMethod
          }
          groupMembers={
            groupMembers
          }
          onAddMember={
            addGroupMember
          }
          onRemoveMember={
            removeGroupMember
          }
          // IMPORTANT:
          // This is now the actual
          // logged-in student.
          currentStudentId={
            studentId
          }
        />
      )}

      {/* ------------------------------------------- */}
      {/* STEP 2 - DOCUMENTS                         */}
      {/* ------------------------------------------- */}

      {currentStep === 2 && (
        <StepDocuments
          selectedDocuments={
            selectedDocuments
          }
          onToggleDocument={
            toggleDocument
          }
          onQuantityChange={
            changeQuantity
          }
          onCustomNameChange={
            changeCustomName
          }
        />
      )}

      {/* ------------------------------------------- */}
      {/* STEP 3 - DETAILS                           */}
      {/* ------------------------------------------- */}

      {currentStep === 3 && (
        <StepDetails
          purpose={purpose}
          onPurposeChange={
            setPurpose
          }
          selectedDocuments={
            selectedDocuments
          }
          numberOfCopies={
            numberOfCopies
          }
          totalAmount={
            totalAmount
          }
        />
      )}

      {/* ------------------------------------------- */}
      {/* STEP 4 - SCHEDULE                          */}
      {/* ------------------------------------------- */}

      {currentStep === 4 && (
        <StepSchedule
          requestedDate={
            requestedDate
          }
          requestedTime={
            requestedTime
          }
          onDateChange={
            setRequestedDate
          }
          onTimeChange={
            setRequestedTime
          }
        />
      )}

      {/* ------------------------------------------- */}
      {/* NAVIGATION BUTTONS                         */}
      {/* ------------------------------------------- */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "12px",
          marginTop: "24px",
        }}
      >
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          disabled={
            currentStep === 1 ||
            loading
          }
        >
          Back
        </button>

        {/* Next */}
        {currentStep < 4 && (
          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
          >
            Next
          </button>
        )}

        {/* Submit */}
        {currentStep === 4 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "Submitting..."
              : "Submit Request"}
          </button>
        )}
      </div>
    </div>
  );
}