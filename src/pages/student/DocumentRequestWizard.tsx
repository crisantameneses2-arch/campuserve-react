import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  deleteDoc,
  doc,
} from "firebase/firestore";

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
  createDraftGroupDocumentRequest,
  createGroupMember,
  finalizeDraftGroupDocumentRequest,
  subscribeToDocumentRequest,
  subscribeToGroupRequestMembers,
} from "../../services/documentRequests";

import { SCHEDULE } from "../../constants/schedule";
import { DOCUMENTS } from "../../constants/documents";

import {
  auth,
  db,
} from "../../../firebase";

/* =========================================================
   TYPES
========================================================= */

type DocumentRequestWizardProps = {
  studentId: string;
};

type GroupMemberStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED";

type GroupMember = {
  member_id?: string;
  student_id: string;
  invitation_status: GroupMemberStatus;
  invitation_sent?: boolean;
  invited_at?: unknown;
  responded_at?: unknown;
};

type RequestStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | string;

/* =========================================================
   COMPONENT
========================================================= */

export default function DocumentRequestWizard({
  studentId,
}: DocumentRequestWizardProps) {
  /* =======================================================
     WIZARD STATE
  ======================================================= */

  const [currentStep, setCurrentStep] =
    useState(1);

  /* =======================================================
     STEP 1 - REQUEST METHOD
  ======================================================= */

  const [requestMethod, setRequestMethod] =
    useState<"OWN" | "WITH_OTHERS">(
      "OWN"
    );

  const [groupMembers, setGroupMembers] =
    useState<GroupMember[]>([]);

  /*
   * Actual Firestore document request ID.
   *
   * OWN:
   *   Created when finally submitted.
   *
   * WITH_OTHERS:
   *   Created as DRAFT when the first
   *   invitation is created.
   */
  const [groupRequestId, setGroupRequestId] =
    useState<string | null>(null);

  const [groupRequestStatus, setGroupRequestStatus] =
    useState<RequestStatus>("DRAFT");

  const [creatingGroupRequest, setCreatingGroupRequest] =
    useState(false);

  const [sendingInvitation, setSendingInvitation] =
    useState(false);

  /*
   * Confirmation box shown after all
   * invitations have received a response.
   */
  const [showGroupConfirmation, setShowGroupConfirmation] =
    useState(false);

  /* =======================================================
     STEP 2 - DOCUMENTS
  ======================================================= */

  const [selectedDocuments, setSelectedDocuments] =
    useState<SelectedDocument[]>([]);

  /* =======================================================
     STEP 3 - DETAILS
  ======================================================= */

  const [purpose, setPurpose] =
    useState("");

  /* =======================================================
     STEP 4 - SCHEDULE
  ======================================================= */

  const [requestedDate, setRequestedDate] =
    useState("");

  const [requestedTime, setRequestedTime] =
    useState("");

  /* =======================================================
     SUBMISSION STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successRequestId, setSuccessRequestId] =
    useState<string | null>(null);

  /* =======================================================
     CALCULATED VALUES
  ======================================================= */

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
        total +
        (document.subtotal ?? 0),
      0
    );
  }, [selectedDocuments]);

  /* =======================================================
     DOCUMENT CATALOG
  ======================================================= */

  function getCatalogDocument(
    documentId: string
  ) {
    return DOCUMENTS.find(
      (document) =>
        document.id === documentId
    );
  }

  /* =======================================================
     GROUP REQUEST - CREATE DRAFT
  ======================================================= */

  async function ensureGroupDraft(): Promise<string> {
    if (groupRequestId) {
      return groupRequestId;
    }

    if (creatingGroupRequest) {
      throw new Error(
        "A group request is already being created."
      );
    }

    if (!studentId.trim()) {
      throw new Error(
        "Your student account could not be identified."
      );
    }

    try {
      setCreatingGroupRequest(true);

      const requestId =
        await createDraftGroupDocumentRequest(
          studentId
        );

      setGroupRequestId(requestId);
      setGroupRequestStatus("DRAFT");

      return requestId;
    } finally {
      setCreatingGroupRequest(false);
    }
  }

  /* =======================================================
     GROUP REQUEST - SUBSCRIBE TO REQUEST
  ======================================================= */

  useEffect(() => {
    if (
      requestMethod !== "WITH_OTHERS" ||
      !groupRequestId
    ) {
      return;
    }

    const unsubscribe =
      subscribeToDocumentRequest(
        groupRequestId,
        (requestData) => {
          if (!requestData) {
            return;
          }

          const status =
            String(
              requestData.status ??
                "DRAFT"
            );

          setGroupRequestStatus(
            status
          );
        }
      );

    return unsubscribe;
  }, [
    requestMethod,
    groupRequestId,
  ]);

  /* =======================================================
     GROUP REQUEST - SUBSCRIBE TO MEMBERS
  ======================================================= */

  useEffect(() => {
    if (
      requestMethod !== "WITH_OTHERS" ||
      !groupRequestId
    ) {
      return;
    }

    const unsubscribe =
      subscribeToGroupRequestMembers(
        groupRequestId,
        (members) => {
          const normalizedMembers =
            members.map((member) => ({
              member_id:
                typeof member.member_id ===
                "string"
                  ? member.member_id
                  : undefined,

              student_id:
                String(
                  member.student_id ??
                    ""
                ),

              invitation_status:
                (
                  member.invitation_status ??
                  "PENDING"
                ) as GroupMemberStatus,

              invitation_sent:
                Boolean(
                  member.invitation_sent
                ),

              invited_at:
                member.invited_at,

              responded_at:
                member.responded_at,
            }));

          setGroupMembers(
            normalizedMembers
          );
        }
      );

    return unsubscribe;
  }, [
    requestMethod,
    groupRequestId,
  ]);

  /* =======================================================
     GROUP REQUEST - STATUS HELPERS
  ======================================================= */

  const isGroupDraft =
    requestMethod === "WITH_OTHERS" &&
    groupRequestStatus === "DRAFT";

  const hasPendingMembers =
    groupMembers.some(
      (member) =>
        member.invitation_status ===
        "PENDING"
    );

  const hasAcceptedMembers =
    groupMembers.some(
      (member) =>
        member.invitation_status ===
        "ACCEPTED"
    );

  const allMembersAnswered =
    groupMembers.length > 0 &&
    !hasPendingMembers;

  /* =======================================================
     STEP 1 - ADD GROUP MEMBER
  ======================================================= */

  async function addGroupMember(
    memberStudentId: string
  ) {
    const cleanedStudentId =
      memberStudentId.trim();

    setError("");

    if (!cleanedStudentId) {
      return;
    }

    if (
      requestMethod !==
      "WITH_OTHERS"
    ) {
      setError(
        "Please select With Others first."
      );
      return;
    }

    /*
     * Members may only be changed
     * while the parent request is DRAFT.
     */
    if (!isGroupDraft) {
      setError(
        "This group request has already been submitted. Members can no longer be changed."
      );
      return;
    }

    /*
     * Prevent the host from adding
     * themselves.
     */
    if (
      cleanedStudentId.toLowerCase() ===
      studentId.trim().toLowerCase()
    ) {
      setError(
        "You cannot add yourself to the group request."
      );
      return;
    }

    /*
     * Prevent duplicate members.
     */
    if (
      groupMembers.some(
        (member) =>
          member.student_id
            .toLowerCase() ===
          cleanedStudentId.toLowerCase()
      )
    ) {
      setError(
        "This student is already in the group request."
      );
      return;
    }

    /*
     * Keep this outside the try block.
     *
     * If the invitation fails after the
     * Firestore member has been created,
     * we can delete that member.
     */
    let createdMemberId: string | null =
      null;

    try {
      setSendingInvitation(true);

      /*
       * 1. Make sure the real DRAFT
       *    document request exists.
       */
      const requestId =
        await ensureGroupDraft();

      /*
       * 2. Create the group member.
       *
       * The member begins as PENDING.
       */
      createdMemberId =
        await createGroupMember(
          requestId,
          cleanedStudentId
        );

      /*
       * 3. Get currently authenticated
       *    Firebase user.
       */
      const currentUser =
        auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Your login session could not be found. Please log in again."
        );
      }

      /*
       * 4. Get Firebase ID token.
       */
      const idToken =
        await currentUser.getIdToken();

      /*
       * 5. Send invitation through
       *    the Vercel API.
       *
       * The API handles:
       * - host verification
       * - invited student's email lookup
       * - secure token generation
       * - Resend email
       */
      const response =
        await fetch(
          "/api/send-group-invitation",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body: JSON.stringify({
              requestId,
              memberId:
                createdMemberId,
            }),
          }
        );

      const result =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          typeof result.message ===
          "string"
            ? result.message
            : "The invitation could not be sent."
        );
      }

      /*
       * Firestore onSnapshot will update
       * the member list automatically.
       */
    } catch (addError) {
      console.error(
        "Failed to add group member:",
        addError
      );

      /*
       * IMPORTANT:
       *
       * If we already created the member
       * but the email failed, remove the
       * orphaned member while the request
       * is still DRAFT.
       */
      if (createdMemberId) {
        try {
          await deleteDoc(
            doc(
              db,
              "group_request_members",
              createdMemberId
            )
          );
        } catch (cleanupError) {
          console.error(
            "Failed to clean up group member after invitation failure:",
            cleanupError
          );
        }
      }

      setError(
        addError instanceof Error
          ? addError.message
          : "The invitation could not be sent."
      );
    } finally {
      setSendingInvitation(false);
    }
  }

  /* =======================================================
     STEP 1 - REMOVE GROUP MEMBER
  ======================================================= */

  async function removeGroupMember(
    memberStudentId: string
  ) {
    setError("");

    /*
     * IMPORTANT:
     *
     * Members may only be removed while
     * the parent request is DRAFT.
     */
    if (!isGroupDraft) {
      setError(
        "This group request has already been submitted. Members can no longer be removed."
      );
      return;
    }

    const member =
      groupMembers.find(
        (item) =>
          item.student_id ===
          memberStudentId
      );

    if (!member) {
      return;
    }

    if (!member.member_id) {
      setError(
        "This group member record could not be identified."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Remove ${member.student_id} from this group request?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          "group_request_members",
          member.member_id
        )
      );

      /*
       * The Firestore subscription will
       * normally update this automatically.
       *
       * We also update local state immediately
       * so the UI responds without waiting.
       */
      setGroupMembers(
        (current) =>
          current.filter(
            (item) =>
              item.member_id !==
              member.member_id
          )
      );
    } catch (removeError) {
      console.error(
        "Failed to remove group member:",
        removeError
      );

      setError(
        "The group member could not be removed. Please try again."
      );
    }
  }

  /* =======================================================
     STEP 2 - DOCUMENT SELECTION
  ======================================================= */

  function toggleDocument(
    documentId: string
  ) {
    setSelectedDocuments(
      (current) => {
        const existing =
          current.find(
            (item) =>
              item.id ===
              documentId
          );

        /*
         * If already selected,
         * remove it.
         */
        if (existing) {
          return current.filter(
            (item) =>
              item.id !==
              documentId
          );
        }

        /*
         * Find the document in
         * the central catalog.
         */
        const catalogDocument =
          getCatalogDocument(
            documentId
          );

        if (!catalogDocument) {
          return current;
        }

        /*
         * Add the selected document.
         */
        return [
          ...current,

          {
            id:
              catalogDocument.id,

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
      }
    );
  }

  function changeQuantity(
    documentId: string,
    quantity: number
  ) {
    const safeQuantity =
      Math.min(
        5,
        Math.max(1, quantity)
      );

    setSelectedDocuments(
      (current) =>
        current.map(
          (document) => {
            if (
              document.id !==
              documentId
            ) {
              return document;
            }

            const subtotal =
              document.unit_price ===
              null
                ? null
                : document.unit_price *
                  safeQuantity;

            return {
              ...document,
              quantity:
                safeQuantity,
              subtotal,
            };
          }
        )
    );
  }

  function changeCustomName(
    documentId: string,
    customName: string
  ) {
    setSelectedDocuments(
      (current) =>
        current.map(
          (document) =>
            document.id ===
            documentId
              ? {
                  ...document,
                  custom_document_name:
                    customName,
                }
              : document
        )
    );
  }

  /* =======================================================
     STEP 4 - SCHEDULE VALIDATION
  ======================================================= */

  function validateSchedule(): string | null {
    if (!requestedDate) {
      return "Please select a claiming date.";
    }

    if (!requestedTime) {
      return "Please select a claiming time.";
    }

    const [
      hourText,
      minuteText,
    ] =
      requestedTime.split(":");

    const hour =
      Number(hourText);

    const minute =
      Number(minuteText);

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
      SCHEDULE.LUNCH_START_HOUR *
      60;

    const lunchEnd =
      SCHEDULE.LUNCH_END_HOUR *
      60;

    if (
      totalMinutes <
        startMinutes ||
      totalMinutes >
        endMinutes
    ) {
      return (
        "Claiming time must be between " +
        "8:00 AM and 5:00 PM."
      );
    }

    if (
      totalMinutes >=
        lunchStart &&
      totalMinutes <
        lunchEnd
    ) {
      return (
        "12:00 PM to 1:00 PM is unavailable."
      );
    }

    return null;
  }

  /* =======================================================
     VALIDATION - METHOD
  ======================================================= */

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

    /*
     * Every invitation must receive
     * a Gmail response before continuing.
     */
    if (
      requestMethod ===
        "WITH_OTHERS" &&
      hasPendingMembers
    ) {
      return (
        "Please wait for all invited students to accept or decline the invitation."
      );
    }

    /*
     * At least one invited student
     * must accept.
     */
    if (
      requestMethod ===
        "WITH_OTHERS" &&
      !hasAcceptedMembers
    ) {
      return (
        "At least one invited student must accept the group request."
      );
    }

    return null;
  }

  /* =======================================================
     VALIDATION - DOCUMENTS
  ======================================================= */

  function validateDocuments(): string | null {
    if (
      selectedDocuments.length ===
      0
    ) {
      return (
        "Please select at least one document."
      );
    }

    for (const document of selectedDocuments) {
      if (
        document.quantity < 1 ||
        document.quantity > 5
      ) {
        return (
          "Each document quantity must be between 1 and 5."
        );
      }

      if (
        document.document_type ===
          "Others" &&
        !document.custom_document_name?.trim()
      ) {
        return (
          "Please enter the custom document name for Others."
        );
      }
    }

    return null;
  }

  /* =======================================================
     VALIDATION - DETAILS
  ======================================================= */

  function validateDetails(): string | null {
    if (!purpose.trim()) {
      return (
        "Please enter the purpose of the request."
      );
    }

    return null;
  }

  /* =======================================================
     VALIDATION - CURRENT STEP
  ======================================================= */

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

  /* =======================================================
     VALIDATION - EVERYTHING
  ======================================================= */

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

  /* =======================================================
     GROUP CONFIRMATION
  ======================================================= */

  function continueFromGroupConfirmation() {
    setError("");

    const methodError =
      validateMethod();

    if (methodError) {
      setError(methodError);
      return;
    }

    setShowGroupConfirmation(
      false
    );

    setCurrentStep(2);
  }

  /* =======================================================
     WIZARD NAVIGATION
  ======================================================= */

  function handleNext() {
    setError("");

    /*
     * Group Step 1 has a special
     * confirmation screen.
     */
    if (
      currentStep === 1 &&
      requestMethod ===
        "WITH_OTHERS"
    ) {
      if (
        groupMembers.length === 0
      ) {
        setError(
          "Please add at least one other student."
        );
        return;
      }

      if (hasPendingMembers) {
        setError(
          "Please wait for all invited students to respond through Gmail."
        );
        return;
      }

      if (!hasAcceptedMembers) {
        setError(
          "At least one invited student must accept the group request."
        );
        return;
      }

      setShowGroupConfirmation(
        true
      );

      return;
    }

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

    /*
     * If confirmation is open,
     * close it first.
     */
    if (showGroupConfirmation) {
      setShowGroupConfirmation(
        false
      );
      return;
    }

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

    if (showGroupConfirmation) {
      return;
    }

    /*
     * Only allow going backward
     * or staying on the current step.
     */
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  }

  /* =======================================================
     FINAL SUBMISSION
  ======================================================= */

  async function handleSubmit() {
    setError("");

    const validationError =
      validateEverything();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!studentId.trim()) {
      setError(
        "Your student account could not be identified. Please log in again."
      );
      return;
    }

    if (loading) {
      return;
    }

    try {
      setLoading(true);

      /* =================================================
         GROUP REQUEST
      ================================================= */

      if (
        requestMethod ===
        "WITH_OTHERS"
      ) {
        /*
         * The group request already exists
         * because it was created as DRAFT
         * when the first invitation was sent.
         */
        if (!groupRequestId) {
          throw new Error(
            "The group request could not be found."
          );
        }

        /*
         * Make sure the request is
         * still DRAFT.
         */
        if (
          groupRequestStatus !==
          "DRAFT"
        ) {
          throw new Error(
            "This group request has already been submitted."
          );
        }

        /*
         * Finalize the existing DRAFT.
         *
         * DRAFT
         *   ↓
         * PENDING
         *
         * Group members are NOT recreated.
         */
        await finalizeDraftGroupDocumentRequest(
          groupRequestId,
          {
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
          }
        );

        /*
         * The request is now submitted
         * to the Registrar side.
         *
         * From this point onward,
         * members cannot be added/removed.
         */
        setGroupRequestStatus(
          "PENDING"
        );

        setSuccessRequestId(
          groupRequestId
        );

        return;
      }

      /* =================================================
         OWN REQUEST
      ================================================= */

      const requestId =
        await createDocumentRequest(
          {
            student_id:
              studentId,

            request_method:
              "OWN",

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
          }
        );

      /*
       * Create document detail records.
       */
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
                    ?.trim() ||
                  null
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

      setSuccessRequestId(
        requestId
      );
    } catch (submitError) {
      console.error(
        "Document request submission error:",
        submitError
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while submitting the request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     RESET FORM
  ======================================================= */

  function resetForm() {
    setCurrentStep(1);

    setRequestMethod("OWN");

    setGroupMembers([]);

    setGroupRequestId(null);

    setGroupRequestStatus(
      "DRAFT"
    );

    setCreatingGroupRequest(
      false
    );

    setSendingInvitation(
      false
    );

    setShowGroupConfirmation(
      false
    );

    setSelectedDocuments([]);

    setPurpose("");

    setRequestedDate("");

    setRequestedTime("");

    setLoading(false);

    setError("");

    setSuccessRequestId(
      null
    );
  }

  /* =======================================================
     SUCCESS SCREEN
  ======================================================= */

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
            border:
              "1px solid #ddd",
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

          {requestMethod ===
            "WITH_OTHERS" && (
            <div
              style={{
                marginTop:
                  "20px",
                padding:
                  "16px",
                border:
                  "1px solid #e5e7eb",
                borderRadius:
                  "8px",
              }}
            >
              <strong>
                Group Members
              </strong>

              <div
                style={{
                  marginTop:
                    "12px",
                }}
              >
                {groupMembers.map(
                  (member) => (
                    <div
                      key={
                        member.member_id ??
                        member.student_id
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        padding:
                          "8px 0",
                      }}
                    >
                      <span>
                        {
                          member.student_id
                        }
                      </span>

                      <span>
                        {
                          member.invitation_status
                        }
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={
            resetForm
          }
          style={{
            marginTop:
              "20px",
          }}
        >
          Create Another Request
        </button>
      </div>
    );
  }

  /* =======================================================
     MAIN WIZARD UI
  ======================================================= */

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
        currentStep={
          currentStep
        }
        onStepClick={
          handleStepClick
        }
      />

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom:
              "16px",
            border:
              "1px solid #cc0000",
            borderRadius:
              "8px",
            color:
              "#cc0000",
          }}
        >
          {error}
        </div>
      )}

      {/* =================================================
          STEP 1 - METHOD
      ================================================= */}

      {currentStep === 1 && (
        <>
          <StepMethod
  requestMethod={requestMethod}
  onRequestMethodChange={(method) => {
    setRequestMethod(method);
    setError("");
  }}
  groupMembers={groupMembers}
  onAddMember={addGroupMember}
  onRemoveMember={removeGroupMember}
  currentStudentId={studentId}
  canEditMembers={isGroupDraft}
/>

          {/* =================================================
              GROUP REQUEST STATUS
          ================================================= */}

          {requestMethod ===
            "WITH_OTHERS" &&
            groupMembers.length >
              0 && (
              <div
                style={{
                  marginTop:
                    "24px",
                  padding:
                    "16px",
                  border:
                    "1px solid #ddd",
                  borderRadius:
                    "10px",
                }}
              >
                <h3>
                  Group Request
                </h3>

                <p>
                  Request status:{" "}
                  <strong>
                    {groupRequestStatus}
                  </strong>
                </p>

                {sendingInvitation && (
                  <p>
                    Sending invitation...
                  </p>
                )}

                {creatingGroupRequest && (
                  <p>
                    Creating group request...
                  </p>
                )}

                {hasPendingMembers && (
                  <p>
                    Waiting for invited
                    students to respond
                    through Gmail.
                  </p>
                )}

                {allMembersAnswered &&
                  hasAcceptedMembers &&
                  !showGroupConfirmation && (
                    <p>
                      All invitations have
                      been answered. Click{" "}
                      <strong>
                        Next
                      </strong>{" "}
                      to review the group
                      before continuing.
                    </p>
                  )}
              </div>
            )}

          {/* =================================================
              GROUP CONFIRMATION
          ================================================= */}

          {showGroupConfirmation && (
            <div
              style={{
                marginTop:
                  "24px",
                padding:
                  "20px",
                border:
                  "2px solid #2563eb",
                borderRadius:
                  "10px",
                background:
                  "#f8fbff",
              }}
            >
              <h2>
                Confirm Group Request
              </h2>

              <p>
                Please review the students
                included in this group
                request before continuing.
              </p>

              <div
                style={{
                  marginTop:
                    "16px",
                }}
              >
                {groupMembers.map(
                  (member) => (
                    <div
                      key={
                        member.member_id ??
                        member.student_id
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        padding:
                          "12px",
                        marginBottom:
                          "8px",
                        border:
                          "1px solid #ddd",
                        borderRadius:
                          "8px",
                        background:
                          "white",
                      }}
                    >
                      <strong>
                        {
                          member.student_id
                        }
                      </strong>

                      <span>
                        {member.invitation_status ===
                        "ACCEPTED"
                          ? "Accepted"
                          : member.invitation_status ===
                            "DECLINED"
                          ? "Declined"
                          : "Pending"}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div
                style={{
                  marginTop:
                    "16px",
                  padding:
                    "12px",
                  border:
                    "1px solid #ddd",
                  borderRadius:
                    "8px",
                }}
              >
                <strong>
                  Accepted:
                </strong>{" "}
                {
                  groupMembers.filter(
                    (member) =>
                      member.invitation_status ===
                      "ACCEPTED"
                  ).length
                }

                {"  "}

                <strong>
                  Declined:
                </strong>{" "}
                {
                  groupMembers.filter(
                    (member) =>
                      member.invitation_status ===
                      "DECLINED"
                  ).length
                }
              </div>

              <div
                style={{
                  display:
                    "flex",
                  gap: "12px",
                  marginTop:
                    "20px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowGroupConfirmation(
                      false
                    )
                  }
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={
                    continueFromGroupConfirmation
                  }
                >
                  Confirm & Continue
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* =================================================
          STEP 2 - DOCUMENTS
      ================================================= */}

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

      {/* =================================================
          STEP 3 - DETAILS
      ================================================= */}

      {currentStep === 3 && (
        <StepDetails
          purpose={
            purpose
          }
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

      {/* =================================================
          STEP 4 - SCHEDULE
      ================================================= */}

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

      {/* =================================================
          NAVIGATION
      ================================================= */}

      {!showGroupConfirmation && (
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            gap: "12px",
            marginTop:
              "24px",
          }}
        >
          {/* BACK */}

          <button
            type="button"
            onClick={
              handleBack
            }
            disabled={
              currentStep ===
                1 ||
              loading ||
              sendingInvitation ||
              creatingGroupRequest
            }
          >
            Back
          </button>

          {/* NEXT */}

          {currentStep < 4 && (
            <button
              type="button"
              onClick={
                handleNext
              }
              disabled={
                loading ||
                sendingInvitation ||
                creatingGroupRequest
              }
            >
              Next
            </button>
          )}

          {/* SUBMIT */}

          {currentStep === 4 && (
            <button
              type="button"
              onClick={
                handleSubmit
              }
              disabled={
                loading
              }
            >
              {loading
                ? "Submitting..."
                : "Submit Request"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}