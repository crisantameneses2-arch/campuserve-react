import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";

/* =========================================================
   TYPES
========================================================= */

interface CreateDocumentRequestInput {
  student_id: string;
  request_method: "OWN" | "WITH_OTHERS";
  purpose: string;
  requested_date: string;
  requested_time: string;
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

/*
 * Available claiming schedule
 */
export interface AvailableClaimingSchedule {
  id: string;
  claimDate: string;
  timeSlot: string;
  availableSlot: number;
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
    requested_date: string;
    requested_time: string;
    number_of_copies: number;
    total_amount: number;
  }
): Promise<void> {
  const requestRef = doc(
    db,
    "document_requests",
    request_id
  );

  await updateDoc(
    requestRef,
    {
      purpose:
        input.purpose,

      requested_date:
        input.requested_date,

      requested_time:
        input.requested_time,

      number_of_copies:
        input.number_of_copies,

      total_amount:
        input.total_amount,

      /*
       * The group request is now officially
       * submitted.
       */
      status: "PENDING",

      finalized_at:
        serverTimestamp(),
    }
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

    requested_date:
      input.requested_date,

    requested_time:
      input.requested_time,

    created_at:
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
  const requestsQuery =
    query(
      collection(
        db,
        "document_requests"
      ),
      where(
        "student_id",
        "==",
        student_id
      )
    );

  return onSnapshot(
    requestsQuery,
    (snapshot) => {
      const requests =
        snapshot.docs.map(
          (item) => ({
            ...item.data(),
          })
        );

      callback(requests);
    }
  );
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

/* =========================================================
   CANCEL DOCUMENT REQUEST
========================================================= */

/*
 * A student can cancel a request
 * only while it is PENDING.
 */
export async function cancelDocumentRequest(
  request_id: string
): Promise<void> {
  const requestRef =
    doc(
      db,
      "document_requests",
      request_id
    );

  await updateDoc(
    requestRef,
    {
      status: "CANCELLED",

      cancelled_at:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   GET AVAILABLE CLAIMING SCHEDULES
========================================================= */

/*
 * Gets claiming schedules that still
 * have available slots.
 *
 * Collection:
 * claimingSchedules
 */
export async function getAvailableClaimingSchedules(): Promise<
  AvailableClaimingSchedule[]
> {
  const schedulesSnapshot =
    await getDocs(
      collection(
        db,
        "claimingSchedules"
      )
    );

  /*
   * Today
   */
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  /*
   * Maximum rescheduling date:
   * 14 days from today.
   */
  const maximumDate =
    new Date(today);

  maximumDate.setDate(
    maximumDate.getDate() + 14
  );

  const schedules =
    schedulesSnapshot.docs
      .map((scheduleDoc) => {
        const data =
          scheduleDoc.data();

        return {
          id:
            scheduleDoc.id,

          claimDate:
            data.claimDate ?? "",

          timeSlot:
            data.timeSlot ?? "",

          availableSlot:
            Number(
              data.availableSlot ?? 0
            ),
        };
      })
      .filter((schedule) => {
        if (
          !schedule.claimDate ||
          !schedule.timeSlot
        ) {
          return false;
        }

        if (
          schedule.availableSlot <= 0
        ) {
          return false;
        }

        /*
         * Convert:
         *
         * 2026-10-05
         *
         * into a JavaScript Date.
         */
        const scheduleDate =
          new Date(
            `${schedule.claimDate}T00:00:00`
          );

        /*
         * Only show schedules from
         * today through the next 14 days.
         */
        return (
          scheduleDate >= today &&
          scheduleDate <= maximumDate
        );
      })
      .sort((a, b) => {
        return (
          new Date(
            `${a.claimDate}T00:00:00`
          ).getTime() -
          new Date(
            `${b.claimDate}T00:00:00`
          ).getTime()
        );
      });

  return schedules;
}

/* =========================================================
   RESCHEDULE DOCUMENT REQUEST
========================================================= */

/*
 * Rescheduling behavior:
 *
 * PENDING
 *   ↓
 * Reschedule
 *   ↓
 * PENDING
 *
 * APPROVED
 *   ↓
 * Reschedule
 *   ↓
 * RESCHEDULED
 *
 * Other statuses are rejected.
 */
export async function rescheduleDocumentRequest(
  request_id: string,
  originalDate: string,
  originalTime: string,
  newDate: string,
  newTime: string,
  currentStatus: string
): Promise<void> {
  /*
   * Only PENDING and APPROVED requests
   * may be rescheduled.
   */
  if (
    currentStatus !== "PENDING" &&
    currentStatus !== "APPROVED"
  ) {
    throw new Error(
      "This request can no longer be rescheduled."
    );
  }

  const requestRef =
    doc(
      db,
      "document_requests",
      request_id
    );

  /*
   * Determine the new status.
   *
   * PENDING stays PENDING.
   *
   * APPROVED becomes RESCHEDULED.
   */
  const newStatus =
    currentStatus === "APPROVED"
      ? "RESCHEDULED"
      : "PENDING";

  await updateDoc(
    requestRef,
    {
      /*
       * Preserve the current workflow status.
       */
      status:
        newStatus,

      /*
       * Preserve the original schedule.
       */
      original_requested_date:
        originalDate,

      original_requested_time:
        originalTime,

      /*
       * Save the newly selected schedule.
       */
      rescheduled_date:
        newDate,

      rescheduled_time:
        newTime,

      /*
       * Update the main schedule fields.
       *
       * These represent the student's
       * current claiming schedule.
       */
      requested_date:
        newDate,

      requested_time:
        newTime,

      /*
       * First rescheduling attempt.
       */
      reschedule_count:
        1,

      /*
       * Timestamp of the reschedule.
       */
      rescheduled_at:
        serverTimestamp(),
    }
  );
}