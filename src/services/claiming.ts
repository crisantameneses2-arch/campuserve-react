import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  addDoc,
  onSnapshot,
  updateDoc,
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

// ==================================================
// VERIFY CLAIM CODE
// ==================================================

export async function verifyClaimCode(
  claimCode: string,
  studentId: string,
  claimType: "DOCUMENT" | "ITEM"
) {
  const code = claimCode.trim().toUpperCase();

  if (!code) {
    return {
      matched: false,
      claimStub: null,
    };
  }

  const claimQuery = query(
    collection(db, "claimStubs"),
    where("claimCode", "==", code),
    where("studentId", "==", studentId),
    where("claimType", "==", claimType)
  );

  const snapshot =
    await getDocs(claimQuery);

  if (snapshot.empty) {
    return {
      matched: false,
      claimStub: null,
    };
  }

  const claimDocument =
    snapshot.docs[0];

  const claimStub = {
    id: claimDocument.id,
    ...claimDocument.data(),
  };

  return {
    matched: true,
    claimStub,
  };
}


// ==================================================
// CREATE CLAIM REQUEST
// ==================================================

export async function createClaimRequest(
  claimStub: any
) {
  const existingQuery = query(
    collection(db, "claimRequests"),
    where(
      "claimStubId",
      "==",
      claimStub.id
    ),
    where(
      "status",
      "==",
      "PENDING"
    )
  );

  const existingSnapshot =
    await getDocs(existingQuery);

  // Prevent duplicate claim requests
  if (!existingSnapshot.empty) {
    return existingSnapshot.docs[0].id;
  }

  const request = await addDoc(
    collection(db, "claimRequests"),
    {
      claimStubId: claimStub.id,

      claimCode:
        claimStub.claimCode,

      claimType:
        claimStub.claimType,

      referenceId:
        claimStub.referenceId,

      studentId:
        claimStub.studentId,

      studentName:
        claimStub.studentName || "",

      office:
        claimStub.office,

      status: "PENDING",

      matched: true,

      createdAt:
        serverTimestamp(),
    }
  );

  return request.id;
}


// ==================================================
// LISTEN TO CLAIM REQUESTS
// ==================================================

export function subscribeToClaimRequests(
  callback: (claims: any[]) => void
) {
  const claimsQuery = query(
    collection(db, "claimRequests"),
    where("status", "==", "PENDING")
  );

  return onSnapshot(
    claimsQuery,
    (snapshot) => {
      const claims =
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

      callback(claims);
    }
  );
}


// ==================================================
// MARK CLAIM AS DONE
// ==================================================

export async function markClaimDone(
  claim: any,
  registrarStaffId: string
) {
  // -----------------------------------------------
  // 1. Mark claim request as DONE
  // -----------------------------------------------

  await updateDoc(
    doc(
      db,
      "claimRequests",
      claim.id
    ),
    {
      status: "DONE",

      completedAt:
        serverTimestamp(),

      completedBy:
        registrarStaffId,
    }
  );


  // -----------------------------------------------
  // 2. Mark claim stub as CLAIMED
  // -----------------------------------------------

  await updateDoc(
    doc(
      db,
      "claimStubs",
      claim.claimStubId
    ),
    {
      status: "CLAIMED",

      claimedAt:
        serverTimestamp(),

      claimedBy:
        registrarStaffId,
    }
  );


  // -----------------------------------------------
  // 3. Complete original request
  // -----------------------------------------------

  if (
    claim.claimType ===
    "DOCUMENT"
  ) {
    await updateDoc(
      doc(
        db,
        "document_requests",
        claim.referenceId
      ),
      {
        status: "COMPLETED",

        updated_at:
          serverTimestamp(),
      }
    );
  }


  if (
    claim.claimType ===
    "ITEM"
  ) {
    await updateDoc(
      doc(
        db,
        "itemReservations",
        claim.referenceId
      ),
      {
        status: "COMPLETED",

        updatedAt:
          serverTimestamp(),
      }
    );
  }
}