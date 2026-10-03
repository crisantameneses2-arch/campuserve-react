import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";

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

interface GroupMemberInput {
  student_id: string;
  invitation_status: "PENDING" | "ACCEPTED" | "DECLINED";
}

export function generateRequestId(): string {
  const random = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `DR-${random}`;
}

export async function createDocumentRequest(
  input: CreateDocumentRequestInput
): Promise<string> {
  const request_id = generateRequestId();

  const requestData = {
    request_id,
    student_id: input.student_id,
    request_method: input.request_method,
    purpose: input.purpose,
    number_of_copies: input.number_of_copies,
    total_amount: input.total_amount,
    requested_date: input.requested_date,
    requested_time: input.requested_time,

    created_at: serverTimestamp(),

    // Student creates these initial values.
    status: "PENDING",
    claim_code: null,
  };

  await setDoc(
    doc(db, "document_requests", request_id),
    requestData
  );

  return request_id;
}

export async function createDocumentDetails(
  request_id: string,
  details: DocumentDetailInput[]
): Promise<void> {
  for (const detail of details) {
    const detail_id = crypto.randomUUID();

    await setDoc(
      doc(db, "document_request_details", detail_id),
      {
        detail_id,
        request_id,
        document_type: detail.document_type,
        custom_document_name: detail.custom_document_name,
        quantity: detail.quantity,
        unit_price: detail.unit_price,
        subtotal: detail.subtotal,
      }
    );
  }
}

export async function createGroupMembers(
  request_id: string,
  members: GroupMemberInput[]
): Promise<void> {
  for (const member of members) {
    const member_id = crypto.randomUUID();

    await setDoc(
      doc(db, "group_request_members", member_id),
      {
        member_id,
        request_id,
        student_id: member.student_id,
        invitation_status: member.invitation_status,
      }
    );
  }
}

export function subscribeToDocumentRequest(
  request_id: string,
  callback: (
    data: Record<string, unknown> | null
  ) => void
): () => void {
  const requestRef = doc(
    db,
    "document_requests",
    request_id
  );

  return onSnapshot(requestRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(null);
    }
  });
}

export function subscribeToStudentDocumentRequests(
  student_id: string,
  callback: (data: Record<string, unknown>[]) => void
): () => void {
  const requestsQuery = query(
    collection(db, "document_requests"),
    where("student_id", "==", student_id)
  );

  return onSnapshot(requestsQuery, (snapshot) => {
    const requests = snapshot.docs.map((item) => ({
      ...item.data(),
    }));

    callback(requests);
  });
}

export function subscribeToDocumentRequestDetails(
  request_id: string,
  callback: (data: Record<string, unknown>[]) => void
): () => void {
  const detailsQuery = query(
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
        snapshot.docs.map((item) => ({
          ...item.data(),
        }));

      callback(details);
    }
  );
}