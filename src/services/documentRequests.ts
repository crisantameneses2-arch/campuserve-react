
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";

import {
  assertCopiesAllowed,
  assertFeatureEnabled,
} from "./settings";
import { logActivity } from "./activityLog";

/* =========================================================
   TYPES
========================================================= */

interface CreateDocumentRequestInput {
  student_id: string;
  request_method: "OWN" | "WITH_OTHERS";
  purpose: string;
  number_of_copies: number;
  total_amount: number;
}

interface DocumentDetailInput {
  document_type: string;
  custom_document_name: string | null;
  quantity: number;
  unit_price: number | null;
  subtotal: number | null;
}

export interface GroupMemberInput {
  student_id: string;
  invitation_status:
    | "PENDING"
    | "ACCEPTED"
    | "DECLINED";
}

/* =========================================================
   REQUEST ID
========================================================= */

/*
 * Generates a unique document request ID.
 *
 * Example:
 * DR-A8K29F
 */
export function generateRequestId(): string {
  const random = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `DR-${random}`;
}

/* =========================================================
   CREATE DRAFT GROUP DOCUMENT REQUEST
========================================================= */

/*
 * A group request needs a request_id BEFORE the host
 * finishes the document request.
 *
 * This is because the invitation is sent immediately
 * after the host adds a student.
 *
 * Workflow:
 *
 * Host enters Student ID
 *       ↓
 * Student found
 *       ↓
 * Create DRAFT request
 *       ↓
 * Create group member
 *       ↓
 * Send Gmail invitation
 *       ↓
 * Student responds
 *       ↓
 * Host continues request
 *
 * The request remains DRAFT while the host waits
 * for the invited student's response.
 */
export async function createDraftGroupDocumentRequest(
  student_id: string
): Promise<string> {
    await assertFeatureEnabled("documentRequests");
  const request_id = generateRequestId();

  const requestData = {
    request_id,

    /*
     * The student who created the group request.
     */
    student_id,

    /*
     * This is specifically a group request.
     */
    request_method: "WITH_OTHERS",

    /*
     * These fields will be completed later
     * when the host finishes the request wizard.
     */
    purpose: "",

    number_of_copies: 0,

    total_amount: 0,

    /*
     * Schedule will be assigned later
     * by the Registrar or General Office.
     */
    requested_date: "",

    requested_time: "",

    /*
     * Creation timestamp.
     */
    created_at: serverTimestamp(),

    /*
     * IMPORTANT:
     * The request is not yet an actual submitted
     * document request.
     */
    status: "DRAFT",

    /*
     * Generated later by the office/admin side.
     */
    claim_code: null,
  };

  await setDoc(
    doc(
      db,
      "document_requests",
      request_id
    ),
    requestData
  );

  return request_id;
}

/* =========================================================
   FINALIZE DRAFT GROUP DOCUMENT REQUEST
========================================================= */

/*
 * Once all invited students have responded and the
 * host confirms the group request, the DRAFT request
 * becomes a normal PENDING request.
 *
 * This avoids creating a second request_id.
 */
export async function finalizeDraftGroupDocumentRequest(
  request_id: string,
  input: {
    purpose: string;
    number_of_copies: number;
    total_amount: number;
    details: DocumentDetailInput[];
  },
) {
  await assertFeatureEnabled("documentRequests");
  await assertCopiesAllowed(input.number_of_copies);
  if (!input.details || input.details.length === 0) {
    throw new Error("Select at least one document before submitting.");
  }

  if (!input.purpose.trim()) {
    throw new Error("Please provide the purpose of the request.");
  }

  const calculatedCopies = input.details.reduce(
    (total, detail) => total + Number(detail.quantity || 0),
    0,
  );

  const calculatedAmount = input.details.reduce(
    (total, detail) => total + Number(detail.subtotal || 0),
    0,
  );

  if (
    input.details.some(
      (detail) =>
        !Number.isInteger(Number(detail.quantity)) ||
        Number(detail.quantity) < 1
    )
  ) {
    throw new Error("Each document must have at least one copy.");
  }

  if (calculatedCopies !== input.number_of_copies) {
    throw new Error("The total number of copies does not match the selected documents.");
  }

  if (
    Math.round(calculatedAmount * 100) !==
    Math.round(input.total_amount * 100)
  ) {
    throw new Error("The total amount does not match the selected documents.");
  }

  const requestRef = doc(db, "document_requests", request_id);

  const membersQuery = query(
    collection(db, "group_request_members"),
    where("request_id", "==", request_id),
  );

  // Get the group member document references.
  const membersSnapshot = await getDocs(membersQuery);

  const memberRefs = membersSnapshot.docs.map(
    (member) => member.ref,
  );

  // Prepare document detail records.
  const detailRecords = input.details.map((detail) => {
    const detailRef = doc(
      collection(db, "document_request_details"),
    );

    return {
      ref: detailRef,
      data: {
        detail_id: detailRef.id,
        request_id,
        document_type: detail.document_type,
        custom_document_name: detail.custom_document_name,
        quantity: detail.quantity,
        unit_price: detail.unit_price,
        subtotal: detail.subtotal,
      },
    };
  });
    let submittedBy = "";
  await runTransaction(db, async (transaction) => {
    // All reads must happen before writes.
    const requestSnapshot = await transaction.get(requestRef);

    if (!requestSnapshot.exists()) {
      throw new Error("The group request could not be found.");
    submittedBy = String(requestSnapshot.data()?.student_id || "");
  }

    if (requestSnapshot.data().status !== "DRAFT") {
      throw new Error("This group request has already been submitted.");
    }

    // Read each member document individually.
    const memberDocuments = await Promise.all(
      memberRefs.map((memberRef) => transaction.get(memberRef)),
    );

    const acceptedMembers = memberDocuments.filter(
      (member) =>
        member.exists() &&
        String(member.data()?.invitation_status || "").toUpperCase() === "ACCEPTED",
    );

    const pendingMembers = memberDocuments.filter(
      (member) =>
        member.exists() &&
        String(member.data()?.invitation_status || "").toUpperCase() === "PENDING",
    );

    if (acceptedMembers.length === 0) {
      throw new Error("At least one group member must accept the invitation.");
    }

    if (pendingMembers.length > 0) {
      throw new Error("Wait until all group invitations have been answered.");
    }

    // Save all selected document details.
    for (const detail of detailRecords) {
      transaction.set(detail.ref, detail.data);
    }

    // Submit the consolidated group request.
    transaction.update(requestRef, {
      purpose: input.purpose.trim(),
      number_of_copies: input.number_of_copies,
      total_amount: input.total_amount,
      status: "PENDING",
      finalized_at: serverTimestamp(),
      submitted_at: serverTimestamp(),
            updated_at: serverTimestamp(),
    });
  });

  await logActivity(
    { id: submittedBy, name: submittedBy, role: "student" },
    "REQUEST_SUBMITTED",
    `Submitted group document request ${request_id}.`,
    {
      request_method: "WITH_OTHERS",
      number_of_copies: input.number_of_copies,
      total_amount: input.total_amount,
    },
    request_id
  );
}
/* =========================================================
   CREATE DOCUMENT REQUEST
========================================================= */

/*
 * Used for normal / OWN requests.
 *
 * Group requests should use:
 *
 * createDraftGroupDocumentRequest()
 *
 * followed later by:
 *
 * finalizeDraftGroupDocumentRequest()
 */
export async function createDocumentRequest(
  input: CreateDocumentRequestInput
): Promise<string> {
    await assertFeatureEnabled("documentRequests");
  await assertCopiesAllowed(input.number_of_copies);
  const request_id = generateRequestId();

  const requestData = {
    request_id,

    student_id:
      input.student_id,

    request_method:
      input.request_method,

    purpose:
      input.purpose,

    number_of_copies:
      input.number_of_copies,

    total_amount:
      input.total_amount,

    /*
     * Schedule will be assigned later
     * by the Registrar or General Office.
     */
    requested_date: "",

    requested_time: "",

    created_at:
      serverTimestamp(),

    submitted_at:
      serverTimestamp(),

    /*
     * Normal submitted requests start as PENDING.
     */
    status: "PENDING",

    /*
     * Claim code is generated later
     * by the office/admin side.
     */
    claim_code: null,
  };

  await setDoc(
    doc(
      db,
      "document_requests",
      request_id
    ),
    requestData
  );
  await logActivity(
    { id: input.student_id, name: input.student_id, role: "student" },
    "REQUEST_SUBMITTED",
    `Submitted document request ${request_id}.`,
    {
      request_method: input.request_method,
      number_of_copies: input.number_of_copies,
      total_amount: input.total_amount,
    },
    request_id
  );
  return request_id;
}

/* =========================================================
   CREATE DOCUMENT DETAILS
========================================================= */

export async function createDocumentDetails(
  request_id: string,
  details: DocumentDetailInput[]
): Promise<void> {
  for (const detail of details) {
    const detail_id =
      crypto.randomUUID();

    await setDoc(
      doc(
        db,
        "document_request_details",
        detail_id
      ),
      {
        detail_id,

        request_id,

        document_type:
          detail.document_type,

        custom_document_name:
          detail.custom_document_name,

        quantity:
          detail.quantity,

        unit_price:
          detail.unit_price,

        subtotal:
          detail.subtotal,
      }
    );
  }
}

/* =========================================================
   CREATE GROUP MEMBER
========================================================= */

/*
 * Creates ONE group member.
 *
 * This is useful when the host enters a Student ID.
 *
 * The invitation_status initially starts as PENDING.
 *
 * The actual Gmail invitation will be handled by
 * the secure backend / Resend integration.
 */
export async function createGroupMember(
  request_id: string,
  student_id: string
): Promise<string> {
  const member_id = crypto.randomUUID();

  const invitation_token = crypto.randomUUID();

  await setDoc(
    doc(db, "group_request_members", member_id),
    {
      member_id,
      request_id,
      student_id,

      invitation_status: "PENDING",

      invitation_token,

      invitation_sent: false,

      invited_at: serverTimestamp(),
      responded_at: null,
      last_resend_at: null,
    }
  );

  return member_id;
}

/* =========================================================
   CREATE GROUP MEMBERS
========================================================= */

/*
 * Kept for compatibility with the existing
 * DocumentRequestWizard.
 *
 * New group-request flow should preferably use
 * createGroupMember() because invitations are
 * now created one student at a time.
 */
export async function createGroupMembers(
  request_id: string,
  members: GroupMemberInput[]
): Promise<void> {
  for (const member of members) {
    await createGroupMember(
      request_id,
      member.student_id
    );
  }
}

/* =========================================================
   SUBSCRIBE TO GROUP REQUEST MEMBERS
========================================================= */

/*
 * Watches all participants belonging to a group request.
 *
 * This is what will allow the HOST UI to automatically
 * update:
 *
 * PENDING
 *    ↓
 * ACCEPTED
 *
 * or:
 *
 * PENDING
 *    ↓
 * DECLINED
 *
 * without refreshing the page.
 */
export function subscribeToGroupRequestMembers(
  request_id: string,
  callback: (
    data: Record<string, unknown>[]
  ) => void
): () => void {
  const membersQuery =
    query(
      collection(
        db,
        "group_request_members"
      ),
      where(
        "request_id",
        "==",
        request_id
      )
    );

  return onSnapshot(
    membersQuery,
    (snapshot) => {
      const members =
        snapshot.docs.map(
          (item) => ({
            ...item.data(),
          })
        );

      callback(members);
    }
  );
}

/* =========================================================
   UPDATE GROUP MEMBER INVITATION STATUS
========================================================= */

/*
 * This function will be used by the secure
 * Gmail Accept / Decline endpoint later.
 *
 * Example:
 *
 * PENDING → ACCEPTED
 *
 * or:
 *
 * PENDING → DECLINED
 */
export async function updateGroupMemberInvitationStatus(
  member_id: string,
  invitation_status:
    | "PENDING"
    | "ACCEPTED"
    | "DECLINED"
): Promise<void> {
  const memberRef = doc(
    db,
    "group_request_members",
    member_id
  );

  await updateDoc(
    memberRef,
    {
      invitation_status,

      responded_at:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   GET ONE DOCUMENT REQUEST
========================================================= */

export function subscribeToDocumentRequest(
  request_id: string,
  callback: (
    data: Record<string, unknown> | null
  ) => void
): () => void {
  const requestRef =
    doc(
      db,
      "document_requests",
      request_id
    );

  return onSnapshot(
    requestRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(
          snapshot.data()
        );
      } else {
        callback(null);
      }
    }
  );
}

/* =========================================================
   GET STUDENT'S DOCUMENT REQUESTS
========================================================= */


export function subscribeToStudentDocumentRequests(
  student_id: string,
  callback: (
    data: Record<string, unknown>[]
  ) => void
): () => void {
  // Requests created by the student.
  const ownRequests = new Map<
    string,
    Record<string, unknown>
  >();

  // Requests shared with the student.
  const sharedRequests = new Map<
    string,
    Record<string, unknown>
  >();

  // Active listeners for shared parent requests.
  const requestListeners = new Map<
    string,
    () => void
  >();

  let isActive = true;

  const emitRequests = () => {
    if (!isActive) return;

    // Own requests take priority if a request appears
    // in both collections.
    const combined = new Map(sharedRequests);

    ownRequests.forEach((request, requestId) => {
      combined.set(requestId, {
        ...request,
        is_group_member: false,
      });
    });

    callback(Array.from(combined.values()));
  };

  // Listen to requests created by this student.
  const ownRequestsQuery = query(
    collection(db, "document_requests"),
    where("student_id", "==", student_id)
  );

  const unsubscribeOwn = onSnapshot(
    ownRequestsQuery,
    (snapshot) => {
      ownRequests.clear();

      snapshot.docs.forEach((item) => {
        ownRequests.set(item.id, {
          ...item.data(),
          is_group_member: false,
        });
      });

      emitRequests();
    }
  );

  // Listen to group memberships belonging to this student.
  const membershipsQuery = query(
    collection(db, "group_request_members"),
    where("student_id", "==", student_id)
  );

  const unsubscribeMemberships = onSnapshot(
    membershipsQuery,
    (snapshot) => {
      if (!isActive) return;

      const acceptedRequestIds = new Set<string>();

      snapshot.docs.forEach((member) => {
        const data = member.data();

        if (
          String(data.invitation_status || "")
            .toUpperCase() === "ACCEPTED" &&
          typeof data.request_id === "string"
        ) {
          acceptedRequestIds.add(data.request_id);
        }
      });

      // Remove listeners for memberships that are no
      // longer accepted or no longer exist.
      for (const [requestId, unsubscribe] of requestListeners) {
        if (!acceptedRequestIds.has(requestId)) {
          unsubscribe();
          requestListeners.delete(requestId);
          sharedRequests.delete(requestId);
        }
      }

      // Subscribe to each newly accepted shared request.
      acceptedRequestIds.forEach((requestId) => {
        if (requestListeners.has(requestId)) return;

        const requestRef = doc(
          db,
          "document_requests",
          requestId
        );

        const unsubscribe = onSnapshot(
          requestRef,
          (requestSnapshot) => {
            if (!isActive) return;

            if (!requestSnapshot.exists()) {
              sharedRequests.delete(requestId);
              emitRequests();
              return;
            }

            const requestData = requestSnapshot.data();

            // A shared request should not appear until
            // the original requester submits it.
            if (
              String(requestData.status || "")
                .toUpperCase() === "DRAFT"
            ) {
              sharedRequests.delete(requestId);
            } else {
              sharedRequests.set(requestId, {
                ...requestData,
                is_group_member: true,
              });
            }

            emitRequests();
          }
        );

        requestListeners.set(requestId, unsubscribe);
      });

      emitRequests();
    }
  );

  // Clean up all listeners when the component unmounts
  // or the student ID changes.
  return () => {
    isActive = false;

    unsubscribeOwn();
    unsubscribeMemberships();

    requestListeners.forEach((unsubscribe) => {
      unsubscribe();
    });

    requestListeners.clear();
    ownRequests.clear();
    sharedRequests.clear();
  };
}

/* =========================================================
   GET DOCUMENT REQUEST DETAILS
========================================================= */

export function subscribeToDocumentRequestDetails(
  request_id: string,
  callback: (
    data: Record<string, unknown>[]
  ) => void
): () => void {
  const detailsQuery =
    query(
      collection(
        db,
        "document_request_details"
      ),
      where(
        "request_id",
        "==",
        request_id
      )
    );

  return onSnapshot(
    detailsQuery,
    (snapshot) => {
      const details =
        snapshot.docs.map(
          (item) => ({
            ...item.data(),
          })
        );

      callback(details);
    }
  );
}

export function subscribeToStudentDraftGroupRequests(
  student_id: string,
  callback: (
    data: Record<string, unknown>[]
  ) => void
): () => void {
  const draftsQuery = query(
    collection(db, "document_requests"),
    where("student_id", "==", student_id),
    where("request_method", "==", "WITH_OTHERS"),
    where("status", "==", "DRAFT")
  );

  return onSnapshot(draftsQuery, (snapshot) => {
    const drafts = snapshot.docs.map((item) => ({
      ...item.data(),
    }));

    callback(drafts);
  });
}

/* =========================================================
   CANCEL DOCUMENT REQUEST (student)
========================================================= */

/*
 * Statuses a student may still cancel from — as long as
 * the request has NOT been paid yet. Once the Cashier
 * confirms payment (payment_status = "PAID") the request
 * can no longer be cancelled by the student.
 *
 * Scheduling is handled by the Registrar, so students
 * cannot reschedule from their side.
 */
const STUDENT_CANCELLABLE_STATUSES = [
  "PENDING",
  "APPROVED",
  "RESCHEDULED",
];

function normalizeValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * True when a student is still allowed to cancel this
 * request: it is in an early status and not yet paid.
 */
export function canStudentCancelDocumentRequest(request: {
  status?: unknown;
  payment_status?: unknown;
}): boolean {
  return (
    STUDENT_CANCELLABLE_STATUSES.includes(
      normalizeValue(request.status),
    ) && normalizeValue(request.payment_status) !== "PAID"
  );
}

/*
 * Cancels a student's own document request.
 *
 * Everything is checked inside a transaction against the
 * latest saved data (not what the page last showed):
 *   - the request must belong to this student (the host,
 *     for group requests)
 *   - it must still be in an early status
 *   - it must NOT be paid yet
 */
export async function cancelDocumentRequest(
  request_id: string,
  student_id: string,
  reason?: string,
): Promise<void> {
  if (!request_id || !student_id) {
    throw new Error("Missing request or student information.");
  }

  const requestRef = doc(db, "document_requests", request_id);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists()) {
      throw new Error("This request could not be found.");
    }

    const request = snapshot.data();

    if (String(request.student_id || "") !== student_id) {
      throw new Error("You can only cancel your own requests.");
    }

    const status = normalizeValue(request.status);

    if (status === "CANCELLED") {
      throw new Error("This request is already cancelled.");
    }

    if (normalizeValue(request.payment_status) === "PAID") {
      throw new Error(
        "This request has already been paid, so it can no longer be cancelled.",
      );
    }

    if (!STUDENT_CANCELLABLE_STATUSES.includes(status)) {
      throw new Error("This request can no longer be cancelled.");
    }

    transaction.update(requestRef, {
      status: "CANCELLED",
      previous_status: status,
      cancelled_by: "STUDENT",
      cancelled_by_id: student_id,
      cancellation_reason: reason?.trim() || "Cancelled by the student.",
      cancelled_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  });
}
