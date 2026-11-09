import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

export type RegistrarActor = {
  id: string;
  name: string;
};

export type ClaimingPeriod = "AM" | "PM";

const makePaymentStubCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PAY-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const makeClaimStubCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CLM-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const writeActivityLog = (
  transaction: any,
  actor: RegistrarActor,
  action: string,
  description: string,
  requestId?: string,
  details: Record<string, unknown> = {},
) => {
  const activityRef = doc(collection(db, "activityLogs"));

  transaction.set(activityRef, {
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: "registrar",
    action,
    description,
    request_id: requestId || null,
    timestamp: serverTimestamp(),
    details,
  });
};

/**
 * Approves a pending request and creates its payment queue stub.
 * The student must pay the Cashier before processing can begin.
 */
export async function approveDocumentRequest(
  requestDocumentId: string,
  requestId: string,
  actor: RegistrarActor,
) {
  const requestRef = doc(db, "document_requests", requestDocumentId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists()) {
      throw new Error("This request no longer exists.");
    }

    const request = snapshot.data();

    if (request.status !== "PENDING") {
      throw new Error("This request has already been handled. Refresh the request list.");
    }

    if (request.payment_stub_code) {
      throw new Error("A payment stub already exists for this request.");
    }

    const paymentStubCode = makePaymentStubCode();

    transaction.update(requestRef, {
      status: "APPROVED",
      payment_stub_code: paymentStubCode,
      payment_status: "UNPAID",
      approved_at: serverTimestamp(),
      approved_by: actor.id,
      approved_by_name: actor.name,
      updated_at: serverTimestamp(),
    });

    writeActivityLog(
      transaction,
      actor,
      "REQUEST_APPROVED",
      `Approved request ${requestId} and generated a payment stub.`,
      requestId,
      {
        previous_status: "PENDING",
        new_status: "APPROVED",
        payment_status: "UNPAID",
        payment_stub_code: paymentStubCode,
      },
    );

    return paymentStubCode;
  });
}

/**
 * Starts processing only after the Cashier confirms payment.
 */
export async function startPaidDocumentProcessing(
  requestDocumentId: string,
  requestId: string,
  actor: RegistrarActor,
) {
  const requestRef = doc(db, "document_requests", requestDocumentId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists()) {
      throw new Error("This request no longer exists.");
    }

    const request = snapshot.data();

    if (request.status !== "APPROVED") {
      throw new Error("Only approved requests can enter processing.");
    }

    if (request.payment_status !== "PAID") {
      throw new Error("Payment has not yet been confirmed by the Cashier.");
    }

    transaction.update(requestRef, {
      status: "PROCESSING",
      processing_started_at: serverTimestamp(),
      processing_started_by: actor.id,
      processing_started_by_name: actor.name,
      updated_at: serverTimestamp(),
    });

    writeActivityLog(
      transaction,
      actor,
      "PROCESSING_STARTED",
      `Started processing request ${requestId}.`,
      requestId,
      {
        previous_status: "APPROVED",
        new_status: "PROCESSING",
        payment_status: "PAID",
      },
    );
  });
}

/**
 * Marks a request ready for pickup and generates its separate claim stub.
 * This is NOT the payment queue stub.
 */
export async function markDocumentReadyForPickup(
  requestDocumentId: string,
  requestId: string,
  actor: RegistrarActor,
) {
  const requestRef = doc(db, "document_requests", requestDocumentId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists()) {
      throw new Error("This request no longer exists.");
    }

    const request = snapshot.data();

    if (request.status !== "PROCESSING") {
      throw new Error("Only requests currently being processed can be marked ready.");
    }

    const claimCode = request.claim_code || makeClaimStubCode();

    transaction.update(requestRef, {
      status: "READY_FOR_PICKUP",
      claim_code: claimCode,
      ready_for_pickup_at: serverTimestamp(),
      ready_for_pickup_by: actor.id,
      ready_for_pickup_by_name: actor.name,
      updated_at: serverTimestamp(),
    });

    writeActivityLog(
      transaction,
      actor,
      "DOCUMENT_READY_FOR_PICKUP",
      `Marked request ${requestId} ready for pickup.`,
      requestId,
      {
        previous_status: "PROCESSING",
        new_status: "READY_FOR_PICKUP",
        claim_code: claimCode,
      },
    );

    return claimCode;
  });
}

/**
 * Sorts pending requests by actual submission time, oldest first.
 * Older records without submitted_at fall back to created_at.
 */
export function sortRequestsFIFO<T extends {
  submitted_at?: any;
  created_at?: any;
}>(requests: T[]): T[] {
  const getTime = (value: any) => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return [...requests].sort((a, b) => {
    const aTime = getTime(a.submitted_at || a.created_at);
    const bTime = getTime(b.submitted_at || b.created_at);
    return aTime - bTime;
  });
}

/**
 * Sorts paid requests by Cashier confirmation time, oldest first.
 * Requests without a valid payment timestamp remain at the end.
 */
export function sortPaidProcessingQueue<T extends {
  payment_confirmed_at?: any;
}>(requests: T[]): T[] {
  const getTime = (value: any) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  };

  return [...requests].sort(
    (a, b) => getTime(a.payment_confirmed_at) - getTime(b.payment_confirmed_at),
  );
}

/**
 * Creates a claiming schedule using AM or PM instead of exact-hour slots.
 * Existing claiming capacity is retained.
 */
export async function createClaimingSchedule(
  claimDate: string,
  period: ClaimingPeriod,
  capacity: number,
  actor: RegistrarActor,
) {
  if (!claimDate) {
    throw new Error("Choose a claiming date.");
  }

  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Capacity must be a whole number greater than zero.");
  }

  const scheduleRef = doc(collection(db, "claimingSchedules"));

  await runTransaction(db, async (transaction) => {
    transaction.set(scheduleRef, {
      scheduleId: scheduleRef.id,
      claimDate,
      timeSlot: period,
      period,
      slotCapacity: capacity,
      availableSlot: capacity,
      availableSlots: capacity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor.id,
      createdByName: actor.name,
    });

    writeActivityLog(
      transaction,
      actor,
      "CLAIMING_SCHEDULE_CREATED",
      `Created ${period} claiming schedule for ${claimDate}.`,
      undefined,
      {
        claim_date: claimDate,
        period,
        capacity,
        schedule_id: scheduleRef.id,
      },
    );
  });

  return scheduleRef.id;
}

/**
 * Records a Registrar activity without changing a request.
 * Use for important actions that are not already logged transactionally.
 */
export async function logRegistrarActivity(
  actor: RegistrarActor,
  action: string,
  description: string,
  requestId?: string,
  details: Record<string, unknown> = {},
) {
  const activityRef = doc(collection(db, "activityLogs"));

  await runTransaction(db, async (transaction) => {
    transaction.set(activityRef, {
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: "registrar",
      action,
      description,
      request_id: requestId || null,
      timestamp: serverTimestamp(),
      details,
    });
  });
}