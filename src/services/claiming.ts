import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase";

function generateClaimCode(length = 6): string {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < length; i++) {
    code += characters.charAt(
      Math.floor(
        Math.random() * characters.length
      )
    );
  }

  return code;
}

async function generateUniqueClaimCode(): Promise<string> {
  let claimCode = "";
  let exists = true;

  while (exists) {
    claimCode = generateClaimCode();

    const claimQuery = query(
      collection(db, "claimStubs"),
      where("claimCode", "==", claimCode)
    );

    const snapshot = await getDocs(claimQuery);

    exists = !snapshot.empty;
  }

  return claimCode;
}

type CreateClaimStubInput = {
  studentId: string;
  studentName: string;

  claimType: "DOCUMENT" | "ITEM";

  referenceId: string;

  scheduleId: string;

  claimDate: string;
  timeSlot: string;

  office: "REGISTRAR" | "GENERAL_OFFICE";

  totalAmount: number;
};

/**
 * Creates a claim stub in Firestore.
 *
 * For DOCUMENT claims:
 * - Creates a document in claimStubs
 * - Updates document_requests.claim_code
 *
 * Both operations are committed together.
 */
export async function createClaimStub({
  studentId,
  studentName,
  claimType,
  referenceId,
  scheduleId,
  claimDate,
  timeSlot,
  office,
  totalAmount,
}: CreateClaimStubInput) {
  console.log(
    "Creating claim stub..."
  );

  console.log({
    studentId,
    studentName,
    claimType,
    referenceId,
    scheduleId,
    claimDate,
    timeSlot,
    office,
    totalAmount,
  });

  // --------------------------------------------------
  // Generate unique claim code
  // --------------------------------------------------

  const claimCode =
    await generateUniqueClaimCode();

  console.log(
    "Generated claim code:",
    claimCode
  );

  // --------------------------------------------------
  // Create claim stub reference
  // --------------------------------------------------

  const claimStubRef = doc(
    collection(db, "claimStubs")
  );

  const claimStubId =
    claimStubRef.id;

  // --------------------------------------------------
  // Prepare Firestore batch
  // --------------------------------------------------

  const batch = writeBatch(db);

  // --------------------------------------------------
  // Create claimStubs document
  // --------------------------------------------------

  batch.set(claimStubRef, {
    claimStubId,

    claimCode,

    studentId,
    studentName,

    claimType,

    referenceId,

    scheduleId,

    claimDate,
    timeSlot,

    office,

    totalAmount,

    status: "READY_FOR_PICKUP",

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  });

  // --------------------------------------------------
  // DOCUMENT REQUEST
  // --------------------------------------------------
  //
  // referenceId is the document request ID.
  //
  // Example:
  // referenceId = DR-ABC123
  //
  // Update:
  // document_requests/DR-ABC123
  //
  // so the student page can read claim_code.
  // --------------------------------------------------

  if (claimType === "DOCUMENT") {
    const requestRef = doc(
      db,
      "document_requests",
      referenceId
    );

    batch.update(requestRef, {
      claim_code: claimCode,

      status:
        "READY_FOR_PICKUP",

      updated_at:
        serverTimestamp(),
    });
  }

  // --------------------------------------------------
  // Commit everything
  // --------------------------------------------------

  try {
    await batch.commit();

    console.log(
      "Claim stub successfully saved to Firestore."
    );

    console.log(
      "Claim Stub ID:",
      claimStubId
    );

    console.log(
      "Claim Code:",
      claimCode
    );

    return {
      claimStubId,
      claimCode,
    };
  } catch (error) {
    console.error(
      "Failed to save claim stub:",
      error
    );

    throw error;
  }
}