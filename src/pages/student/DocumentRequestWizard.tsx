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
import { formatPeso } from "../../components/document-request/formatPeso";
import "../../components/document-request/DocumentRequestWizard.css";


import {
  createDocumentDetails,
  createDocumentRequest,
  createDraftGroupDocumentRequest,
  createGroupMember,
  finalizeDraftGroupDocumentRequest,
  subscribeToDocumentRequest,
  subscribeToGroupRequestMembers,
} from "../../services/documentRequests";


import { DOCUMENTS } from "../../constants/documents";

import { db } from "../../../firebase";
/* =========================================================
   TYPES
========================================================= */

type DocumentRequestWizardProps = {
  studentId: string;
  draftRequestId?: string | null;
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
  draftRequestId = null,
}: DocumentRequestWizardProps) {
  /* =======================================================
     WIZARD STATE
  ======================================================= */

  const [currentStep, setCurrentStep] =
    useState(1);

  /*
   * The furthest step the student has reached.
   * Lets students go back to an earlier step to review
   * their choices, then jump straight back again.
   */
  const [furthestStep, setFurthestStep] =
    useState(1);

  useEffect(() => {
    setFurthestStep((step) =>
      Math.max(step, currentStep)
    );
  }, [currentStep]);

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
  useEffect(() => {
    if (!draftRequestId) return;

    setRequestMethod("WITH_OTHERS");
    setGroupRequestId(draftRequestId);
    setGroupRequestStatus("DRAFT");
    setCurrentStep(1);
    setError("");
  }, [draftRequestId]);

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

  /*
   * Remembers which group (members + responses) the
   * student already confirmed, so going back to Step 1
   * and pressing Next again does not ask a second time.
   * Any change to the members resets it.
   */
  const groupSignature = groupMembers
    .map(
      (member) =>
        `${member.student_id}:${member.invitation_status}`
    )
    .sort()
    .join("|");

  const [confirmedGroupSignature, setConfirmedGroupSignature] =
    useState<string | null>(null);

  const isGroupConfirmed =
    requestMethod === "WITH_OTHERS" &&
    confirmedGroupSignature !== null &&
    confirmedGroupSignature === groupSignature;

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

    if (requestMethod !== "WITH_OTHERS") {
      setError(
        "Please select With Others first."
      );
      return;
    }

    if (!isGroupDraft) {
      setError(
        "This group request has already been submitted. Members can no longer be changed."
      );
      return;
    }

    if (
      cleanedStudentId.toLowerCase() ===
      studentId.trim().toLowerCase()
    ) {
      setError(
        "You cannot add yourself to the group request."
      );
      return;
    }

    if (
      groupMembers.some(
        (member) =>
          member.student_id.toLowerCase() ===
          cleanedStudentId.toLowerCase()
      )
    ) {
      setError(
        "This student is already in the group request."
      );
      return;
    }

    try {
      setSendingInvitation(true);

      // 1. Ensure the group DRAFT exists.
      const requestId =
        await ensureGroupDraft();

      // 2. Create the Firestore invitation.
      // The invitation will appear in the
      // invited student's CampuServe dashboard.
      await createGroupMember(
        requestId,
        cleanedStudentId
      );

      // Firestore subscriptions will automatically
      // update the host's member list.
    } catch (addError) {
      console.error(
        "Failed to add group member:",
        addError
      );

      setError(
        addError instanceof Error
          ? addError.message
          : "The invitation could not be created. Please try again."
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
    setError("");

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
    setError("");

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
     * an in-app response before continuing.
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

    return null;
  }

  /* =======================================================
     VALIDATION - EVERYTHING
  ======================================================= */

  function validateEverything(): string | null {
    const methodError = validateMethod();

    if (methodError) {
      return methodError;
    }

    const documentError = validateDocuments();

    if (documentError) {
      return documentError;
    }

    const detailsError = validateDetails();

    if (detailsError) {
      return detailsError;
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

    setConfirmedGroupSignature(
      groupSignature
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
          "Please wait for all invited students to respond through CampuServe."
        );
        return;
      }

      if (!hasAcceptedMembers) {
        setError(
          "At least one invited student must accept the group request."
        );
        return;
      }

      // Already confirmed this exact group: go straight on.
      if (isGroupConfirmed) {
        setCurrentStep(2);
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

    if (currentStep < 3) {
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
     * Going backward (or staying) is always allowed.
     */
    if (step <= currentStep) {
      setCurrentStep(step);
      return;
    }

    /*
     * Going forward is allowed only to steps the student
     * already reached, and only if every step in between
     * is still valid.
     */
    if (step > furthestStep) {
      return;
    }

    for (let check = currentStep; check < step; check += 1) {
      if (check === 1) {
        const methodError = validateMethod();

        if (methodError) {
          setCurrentStep(1);
          setError(methodError);
          return;
        }

        if (
          requestMethod === "WITH_OTHERS" &&
          !isGroupConfirmed
        ) {
          setCurrentStep(1);
          setError(
            "Your group changed. Please click Next to review and confirm it again."
          );
          return;
        }
      }

      if (check === 2) {
        const documentError = validateDocuments();

        if (documentError) {
          setCurrentStep(2);
          setError(documentError);
          return;
        }
      }
    }

    setCurrentStep(step);
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

            number_of_copies:
              numberOfCopies,

            total_amount:
              totalAmount,

            details:
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
              ),
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

    setFurthestStep(1);

    setConfirmedGroupSignature(null);

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

    setLoading(false);

    setError("");

    setSuccessRequestId(
      null
    );
  }

  /* =======================================================
     DISPLAY HELPERS
  ======================================================= */

  const acceptedCount = groupMembers.filter(
    (member) => member.invitation_status === "ACCEPTED"
  ).length;

  const declinedCount = groupMembers.filter(
    (member) => member.invitation_status === "DECLINED"
  ).length;

  const footerHint =
    currentStep === 1
      ? requestMethod === "WITH_OTHERS"
        ? `Group request · ${groupMembers.length} invited · ${acceptedCount} accepted`
        : "Solo request"
      : selectedDocuments.length === 0
        ? "No documents selected yet"
        : `${selectedDocuments.length} document${selectedDocuments.length === 1 ? "" : "s"} · ${numberOfCopies} cop${numberOfCopies === 1 ? "y" : "ies"} · ${formatPeso(totalAmount)}`;

  /* =======================================================
     SUCCESS SCREEN
  ======================================================= */

  if (successRequestId) {
    return (
      <div className="rwx">
        <section className="rwx-shell">
          <div className="rwx-success">
            <span className="rwx-success__mark" aria-hidden="true">
              <svg viewBox="0 0 76 76" fill="none">
                <circle cx="38" cy="38" r="35" fill="currentColor" opacity=".12" />
                <circle cx="38" cy="38" r="26" fill="currentColor" />
                <path d="m27 38.5 7.5 7.5L50 30.5" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>

            <span className="rwx-eyebrow">REQUEST SUBMITTED</span>

            <h2>Successfully sent!</h2>

            <p>
              Your document request has been submitted to the
              Registrar. You can follow its progress from your
              dashboard.
            </p>

            <div className="rwx-success__ref">
              <span>REQUEST ID</span>
              <strong>{successRequestId}</strong>
            </div>

            <dl className="rwx-success__details">
              <div>
                <dt>Student ID</dt>
                <dd>{studentId}</dd>
              </div>

              <div>
                <dt>Status</dt>
                <dd>
                  <span className="rwx-status rwx-status--pending">
                    Pending
                  </span>
                </dd>
              </div>

              <div>
                <dt>Request type</dt>
                <dd>
                  {requestMethod === "WITH_OTHERS"
                    ? "Group request"
                    : "Solo request"}
                </dd>
              </div>
            </dl>

            {requestMethod === "WITH_OTHERS" && (
              <div className="rwx-members rwx-members--success">
                <h3>Group members</h3>

                {groupMembers.map((member) => (
                  <div
                    className="rwx-member"
                    key={member.member_id ?? member.student_id}
                  >
                    <div className="rwx-member__copy">
                      <strong>{member.student_id}</strong>
                    </div>

                    <span
                      className={`rwx-status rwx-status--${member.invitation_status.toLowerCase()}`}
                    >
                      {getMemberStatusLabel(member.invitation_status)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="rwx-btn rwx-btn--primary"
              onClick={resetForm}
            >
              Create another request
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* =======================================================
     MAIN WIZARD UI
  ======================================================= */

  return (
    <div className="rwx">
      <div className="rwx-page-head">
        <span className="rwx-eyebrow rwx-eyebrow--muted">
          DOCUMENT SERVICES
        </span>

        <h1>Request a document</h1>

        <p>
          Choose how you want to request, pick your documents, and
          tell us what they're for.
        </p>
      </div>

      <section className="rwx-shell">
        <StepProgress
          currentStep={currentStep}
          furthestStep={furthestStep}
          onStepClick={handleStepClick}
        />

        <div className="rwx-content">
          {/* ERROR */}

          {error && (
            <div className="rwx-notice rwx-notice--error" role="alert">
              {error}
            </div>
          )}

          {/* RECAP — shown when the student went back to review */}

          {currentStep < furthestStep &&
            !showGroupConfirmation && (
              <RequestRecap
                requestMethod={requestMethod}
                acceptedCount={acceptedCount}
                selectedDocuments={selectedDocuments}
                numberOfCopies={numberOfCopies}
                totalAmount={totalAmount}
                purpose={purpose}
                furthestStep={furthestStep}
                onContinue={() => handleStepClick(furthestStep)}
              />
            )}

          {/* STEP 1 - METHOD */}

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

              {/* GROUP REQUEST STATUS */}

              {requestMethod === "WITH_OTHERS" &&
                groupMembers.length > 0 && (
                  <div className="rwx-group-status">
                    <div className="rwx-group-status__head">
                      <h3>Group request</h3>

                      <span className="rwx-chip">
                        {String(groupRequestStatus).replace(/_/g, " ")}
                      </span>
                    </div>

                    {sendingInvitation && (
                      <p className="rwx-busy">Sending invitation...</p>
                    )}

                    {creatingGroupRequest && (
                      <p className="rwx-busy">Creating group request...</p>
                    )}

                    {hasPendingMembers && (
                      <p>
                        Waiting for invited students to respond
                        through CampuServe.
                      </p>
                    )}

                    {allMembersAnswered &&
                      hasAcceptedMembers &&
                      !showGroupConfirmation && (
                        <p>
                          All invitations have been answered. Click{" "}
                          <strong>Next</strong> to review the group
                          before continuing.
                        </p>
                      )}
                  </div>
                )}

              {/* GROUP CONFIRMATION */}

              {showGroupConfirmation && (
                <div className="rwx-confirm">
                  <span className="rwx-eyebrow">ALMOST THERE</span>

                  <h2>Confirm group request</h2>

                  <p>
                    Please review the students included in this
                    group request before continuing.
                  </p>

                  <div className="rwx-members">
                    {groupMembers.map((member) => (
                      <div
                        className="rwx-member"
                        key={member.member_id ?? member.student_id}
                      >
                        <div className="rwx-member__copy">
                          <strong>{member.student_id}</strong>
                        </div>

                        <span
                          className={`rwx-status rwx-status--${member.invitation_status.toLowerCase()}`}
                        >
                          {getMemberStatusLabel(
                            member.invitation_status
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="rwx-confirm__counts">
                    <div>
                      <strong>{acceptedCount}</strong>
                      <small>Accepted</small>
                    </div>

                    <div>
                      <strong>{declinedCount}</strong>
                      <small>Declined</small>
                    </div>
                  </div>

                  <div className="rwx-confirm__actions">
                    <button
                      type="button"
                      className="rwx-btn rwx-btn--secondary"
                      onClick={() => setShowGroupConfirmation(false)}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className="rwx-btn rwx-btn--primary"
                      onClick={continueFromGroupConfirmation}
                    >
                      Confirm &amp; continue{" "}
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 2 - DOCUMENTS */}

          {currentStep === 2 && (
            <StepDocuments
              selectedDocuments={selectedDocuments}
              onToggleDocument={toggleDocument}
              onQuantityChange={changeQuantity}
              onCustomNameChange={changeCustomName}
            />
          )}

          {/* STEP 3 - DETAILS */}

          {currentStep === 3 && (
            <StepDetails
              purpose={purpose}
              onPurposeChange={(value) => {
                setPurpose(value);
                setError("");
              }}
              selectedDocuments={selectedDocuments}
              numberOfCopies={numberOfCopies}
              totalAmount={totalAmount}
            />
          )}
        </div>

        {/* NAVIGATION */}

        {!showGroupConfirmation && (
          <div className="rwx-footer">
            <button
              type="button"
              className="rwx-btn rwx-btn--secondary"
              onClick={handleBack}
              disabled={
                currentStep === 1 ||
                loading ||
                sendingInvitation ||
                creatingGroupRequest
              }
            >
              <span aria-hidden="true">←</span> Back
            </button>

            <span className="rwx-footer__hint">{footerHint}</span>

            {currentStep < 3 && (
              <button
                type="button"
                className="rwx-btn rwx-btn--primary"
                onClick={handleNext}
                disabled={
                  loading ||
                  sendingInvitation ||
                  creatingGroupRequest
                }
              >
                Next <span aria-hidden="true">→</span>
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                className="rwx-btn rwx-btn--primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit request"}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function getMemberStatusLabel(status: GroupMemberStatus) {
  if (status === "ACCEPTED") return "Accepted";
  if (status === "DECLINED") return "Declined";
  return "Pending";
}

/* =========================================================
   RECAP — "Your request so far"
========================================================= */

const STEP_NAMES = ["Method", "Documents", "Details"];

function RequestRecap({
  requestMethod,
  acceptedCount,
  selectedDocuments,
  numberOfCopies,
  totalAmount,
  purpose,
  furthestStep,
  onContinue,
}: {
  requestMethod: "OWN" | "WITH_OTHERS";
  acceptedCount: number;
  selectedDocuments: SelectedDocument[];
  numberOfCopies: number;
  totalAmount: number;
  purpose: string;
  furthestStep: number;
  onContinue: () => void;
}) {
  return (
    <aside className="rwx-recap" aria-label="Your request so far">
      <div className="rwx-recap__head">
        <div>
          <span className="rwx-eyebrow">YOUR REQUEST SO FAR</span>
          <p>
            Reviewing an earlier step. Your choices are saved.
          </p>
        </div>

        <button
          type="button"
          className="rwx-btn rwx-btn--secondary rwx-btn--small"
          onClick={onContinue}
        >
          Back to {STEP_NAMES[furthestStep - 1]}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <dl className="rwx-recap__grid">
        <div>
          <dt>Request type</dt>
          <dd>
            {requestMethod === "WITH_OTHERS"
              ? `Group request · ${acceptedCount} accepted`
              : "Solo request"}
          </dd>
        </div>

        <div>
          <dt>Documents</dt>
          <dd>
            {selectedDocuments.length === 0 ? (
              <span className="rwx-recap__empty">None yet</span>
            ) : (
              <span className="rwx-recap__chips">
                {selectedDocuments.map((document) => (
                  <span className="rwx-recap__chip" key={document.id}>
                    {document.document_type === "Others"
                      ? document.custom_document_name || "Others"
                      : document.document_type}{" "}
                    <b>×{document.quantity}</b>
                  </span>
                ))}
              </span>
            )}
          </dd>
        </div>

        {selectedDocuments.length > 0 && (
          <div>
            <dt>Total</dt>
            <dd>
              {numberOfCopies} cop{numberOfCopies === 1 ? "y" : "ies"} ·{" "}
              {formatPeso(totalAmount)}
            </dd>
          </div>
        )}

        {purpose.trim() && (
          <div>
            <dt>Purpose</dt>
            <dd className="rwx-recap__purpose">{purpose.trim()}</dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
