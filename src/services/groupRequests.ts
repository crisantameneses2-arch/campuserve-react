import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";
import { millis, normalizeStatus } from "../utils/format";
import { notify, studentAudience } from "./notifications";
import { lookupStudent } from "./messages";

export interface GroupStudent {
  studentId: string;
  name: string;
  email: string;
}

export async function lookupGroupStudent(
  studentId: string
): Promise<GroupStudent | null> {
  const id = studentId.trim();

  if (!id) {
    return null;
  }

  const snap = await getDocs(
    query(
      collection(db, "accounts"),
      where("student_id", "==", id)
    )
  );

  if (snap.empty) {
    return null;
  }

  const data = snap.docs[0].data();

  return {
    studentId: id,
    name: String(data.name ?? id),
    email: String(data.email ?? ""),
  };
}


/* Group document requests: a student adds classmates to a request,
   and each classmate accepts or declines from their Messages > Group Request inbox. */

export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface GroupInvite {
  memberDocId: string;
  requestId: string;
  studentId: string;
  status: InvitationStatus;
  requesterId: string;
  requesterName: string;
  purpose: string;
  documentsLabel: string;
  requestStatus: string;
  requestedDate: string;
  requestedTime: string;
  totalAmount: number;
  createdAt?: unknown;
}

const nameCache = new Map<string, string>();

async function nameFor(studentId: string): Promise<string> {
  if (!studentId) return "A student";
  if (nameCache.has(studentId)) return nameCache.get(studentId)!;

  try {
    const found = await lookupStudent(studentId);
    const name = found?.name || studentId;
    nameCache.set(studentId, name);
    return name;
  } catch {
    return studentId;
  }
}

export async function documentsLabelFor(
  requestId: string
): Promise<string> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "document_request_details"),
        where("request_id", "==", requestId)
      )
    );

    const names = snap.docs.map((d) => {
      const x = d.data();

      return String(
        x.custom_document_name ||
          x.document_type ||
          "document"
      );
    });

    if (names.length === 0) return "document";

    if (names.length === 1) return names[0];

    return `${names[0]} +${names.length - 1} more`;
  } catch {
    return "document";
  }
}

/** Live list of group requests this student was added to. */
export function subscribeToGroupInvites(
  studentId: string,
  callback: (invites: GroupInvite[]) => void
): () => void {
  const q = query(
    collection(db, "group_request_members"),
    where("student_id", "==", studentId)
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      const invites = await Promise.all(
        snapshot.docs.map(
          async (
            memberDoc
          ): Promise<GroupInvite | null> => {
            const member = memberDoc.data();

            const requestId = String(
              member.request_id ?? ""
            );

            if (!requestId) return null;

            try {
              const requestSnap = await getDoc(
                doc(
                  db,
                  "document_requests",
                  requestId
                )
              );

              if (!requestSnap.exists()) return null;

              const request =
                requestSnap.data();

              const [
                requesterName,
                documentsLabel,
              ] = await Promise.all([
                nameFor(
                  String(
                    request.student_id ?? ""
                  )
                ),
                documentsLabelFor(
                  requestId
                ),
              ]);

              return {
                memberDocId: memberDoc.id,
                requestId,
                studentId,
                status:
                  (member.invitation_status ??
                    "PENDING") as InvitationStatus,
                requesterId: String(
                  request.student_id ?? ""
                ),
                requesterName,
                purpose: String(
                  request.purpose ?? ""
                ),
                documentsLabel,
                requestStatus:
                  normalizeStatus(
                    request.status
                  ),
                requestedDate: String(
                  request.requested_date ?? ""
                ),
                requestedTime: String(
                  request.requested_time ?? ""
                ),
                totalAmount: Number(
                  request.total_amount ?? 0
                ),
                createdAt:
                  request.created_at,
              };
            } catch (error) {
              console.warn(
                "Could not load group request",
                requestId,
                error
              );

              return null;
            }
          }
        )
      );

      callback(
        invites
          .filter(
            (
              i
            ): i is GroupInvite =>
              i !== null
          )
          .sort(
            (a, b) =>
              millis(b.createdAt) -
              millis(a.createdAt)
          )
      );
    },
    (error) =>
      console.warn(
        "Group invite subscription failed:",
        error
      )
  );
}

export async function respondToGroupInvite(
  invite: GroupInvite,
  response:
    | "ACCEPTED"
    | "DECLINED",
  responderName: string
): Promise<void> {
  await updateDoc(
    doc(
      db,
      "group_request_members",
      invite.memberDocId
    ),
    {
      invitation_status: response,
      responded_at:
        new Date().toISOString(),
    }
  );

  await notify({
    audience: studentAudience(
      invite.requesterId
    ),
    type: "GROUP_RESPONSE",
    title:
      response === "ACCEPTED"
        ? "Group Request Accepted"
        : "Group Request Declined",
    message: `${responderName || invite.studentId} ${
      response === "ACCEPTED"
        ? "accepted"
        : "declined"
    } your ${
      invite.documentsLabel
    } group request.`,
    kind: "DOCUMENT",
    relatedId: invite.requestId,
  });
}

/** Everyone a staff member can message about one request: the requester + group members. */
export async function getRequestParticipants(
  requestId: string,
  requesterId: string
): Promise<
  {
    studentId: string;
    name: string;
    role:
      | "Requester"
      | "Group member";
    status?: InvitationStatus;
  }[]
> {
  const participants: {
    studentId: string;
    name: string;
    role:
      | "Requester"
      | "Group member";
    status?: InvitationStatus;
  }[] = [
    {
      studentId: requesterId,
      name: await nameFor(requesterId),
      role: "Requester",
    },
  ];

  const members = await getDocs(
    query(
      collection(
        db,
        "group_request_members"
      ),
      where(
        "request_id",
        "==",
        requestId
      )
    )
  );

  for (const m of members.docs) {
    const data = m.data();

    participants.push({
      studentId: String(
        data.student_id
      ),
      name: await nameFor(
        String(data.student_id)
      ),
      role: "Group member",
      status:
        data.invitation_status as InvitationStatus,
    });
  }

  return participants;
}

/** Student IDs that should hear about a request: requester + members who accepted. */
export async function getRequestAudienceIds(
  requestId: string,
  requesterId: string
): Promise<string[]> {
  const ids = new Set<string>([
    requesterId,
  ]);

  try {
    const members = await getDocs(
      query(
        collection(
          db,
          "group_request_members"
        ),
        where(
          "request_id",
          "==",
          requestId
        )
      )
    );

    members.docs.forEach((m) => {
      if (
        m.data()
          .invitation_status ===
        "ACCEPTED"
      ) {
        ids.add(
          String(
            m.data().student_id
          )
        );
      }
    });
  } catch (error) {
    console.warn(
      "Could not load group members:",
      error
    );
  }

  return [...ids];
}

/** Live list of the classmates added to one request (requester's view). */
export function subscribeToGroupMembers(
  requestId: string,
  callback: (
    members: {
      studentId: string;
      name: string;
      status: InvitationStatus;
    }[]
  ) => void
): () => void {
  const q = query(
    collection(
      db,
      "group_request_members"
    ),
    where(
      "request_id",
      "==",
      requestId
    )
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      const members =
        await Promise.all(
          snapshot.docs.map(
            async (m) => {
              const data =
                m.data();

              return {
                studentId: String(
                  data.student_id
                ),
                name: await nameFor(
                  String(
                    data.student_id
                  )
                ),
                status:
                  (data.invitation_status ??
                    "PENDING") as InvitationStatus,
              };
            }
          )
        );

      callback(members);
    },
    (error) =>
      console.warn(
        "Group member subscription failed:",
        error
      )
  );
}