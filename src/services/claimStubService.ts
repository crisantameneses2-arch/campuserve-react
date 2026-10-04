import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase";

export type ClaimType = "document" | "item";

export async function verifyClaimCode(
  claimCode: string,
  studentId: string,
  type: ClaimType
) {
  const q = query(
    collection(db, "claimStubs"),
    where("claimCode", "==", claimCode),
    where("studentId", "==", studentId),
    where("type", "==", type)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return {
      matched: false,
      claimStub: null,
    };
  }

  const claimDoc = snapshot.docs[0];

  return {
    matched: true,
    claimStub: {
      id: claimDoc.id,
      ...claimDoc.data(),
    },
  };
}

export async function createClaimRequest(
  claimStub: any,
  studentId: string
) {
  const request = await addDoc(
    collection(db, "claimRequests"),
    {
      claimCode: claimStub.claimCode,
      type: claimStub.type,
      studentId,
      referenceId: claimStub.referenceId || null,
      claimStubId: claimStub.id,
      status: "PENDING",
      createdAt: serverTimestamp(),
    }
  );

  return request.id;
}