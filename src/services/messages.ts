import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase";
import { millis, type TransactionKind } from "../utils/format";

/* =========================================================
   MODEL

   One conversation per (student, office) so each office keeps a single
   shared inbox, and every message can be linked to the request or
   reservation it is about.

   conversations/{studentId}__{office}
     studentId, studentName, office, lastMessage, lastSenderRole, lastSenderName,
     lastAt, studentUnread (n), staffUnread (n), relatedKind/relatedId/relatedLabel (latest link)

   messages/{auto}
     conversationId, studentId, office, senderRole ("student" | "staff"), senderName,
     text, relatedKind/relatedId/relatedLabel (optional), createdAt
========================================================= */

export type Office = "registrar" | "general_office" | "admin";

export const OFFICE_LABEL: Record<Office, string> = {
  registrar: "Registrar Office",
  general_office: "Supply Office",
  admin: "Administrator",
};

export const OFFICES: Office[] = ["registrar", "general_office", "admin"];

export interface RelatedRef {
  kind: TransactionKind;
  id: string;
  label?: string;
}

export interface Conversation {
  id: string;
  studentId: string;
  studentName: string;
  office: Office;
  lastMessage: string;
  lastSenderRole: "student" | "staff";
  lastSenderName: string;
  lastAt?: unknown;
  studentUnread: number;
  staffUnread: number;
  related: RelatedRef | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: "student" | "staff";
  senderName: string;
  text: string;
  related: RelatedRef | null;
  createdAt?: unknown;
}

export const conversationIdFor = (
  studentId: string,
  office: Office
) =>
  `${studentId.replace(/[/\\]/g, "-")}__${office}`;

function readRelated(
  data: Record<string, unknown>
): RelatedRef | null {
  if (!data.relatedId) return null;

  return {
    kind:
      (data.relatedKind as TransactionKind) ??
      "DOCUMENT",
    id: String(data.relatedId),
    label: data.relatedLabel
      ? String(data.relatedLabel)
      : undefined,
  };
}

function toConversation(
  id: string,
  data: Record<string, unknown>
): Conversation {
  return {
    id,
    studentId: String(data.studentId ?? ""),
    studentName: String(data.studentName ?? ""),
    office:
      (data.office as Office) ??
      "registrar",
    lastMessage: String(
      data.lastMessage ?? ""
    ),
    lastSenderRole:
      (data.lastSenderRole as
        | "student"
        | "staff") ?? "staff",
    lastSenderName: String(
      data.lastSenderName ?? ""
    ),
    lastAt: data.lastAt,
    studentUnread: Number(
      data.studentUnread ?? 0
    ),
    staffUnread: Number(
      data.staffUnread ?? 0
    ),
    related: readRelated(data),
  };
}

export type SendMessageInput = {
  studentId: string;
  studentName?: string;
  office: Office;
  senderRole: "student" | "staff";
  senderName: string;
  text: string;
  related?: RelatedRef | null;
};

export async function sendMessage(
  input: SendMessageInput
): Promise<string> {
  const text = input.text.trim();

  if (!text) {
    throw new Error(
      "Please type a message first."
    );
  }

  const conversationId = conversationIdFor(
    input.studentId,
    input.office
  );

  const messageRef = doc(
    collection(db, "messages")
  );

  const conversationRef = doc(
    db,
    "conversations",
    conversationId
  );

  const link = input.related
    ? {
        relatedKind: input.related.kind,
        relatedId: input.related.id,
        relatedLabel:
          input.related.label ??
          input.related.id,
      }
    : {};

  const batch = writeBatch(db);

  batch.set(messageRef, {
    messageId: messageRef.id,
    conversationId,
    studentId: input.studentId,
    office: input.office,
    senderRole: input.senderRole,
    senderName: input.senderName,
    text,
    ...link,
    createdAt: serverTimestamp(),
  });

  batch.set(
    conversationRef,
    {
      conversationId,
      studentId: input.studentId,
      ...(input.studentName
        ? {
            studentName:
              input.studentName,
          }
        : {}),
      office: input.office,
      lastMessage: text.slice(0, 160),
      lastSenderRole:
        input.senderRole,
      lastSenderName:
        input.senderName,
      lastAt: serverTimestamp(),
      studentUnread: increment(
        input.senderRole === "staff"
          ? 1
          : 0
      ),
      staffUnread: increment(
        input.senderRole === "student"
          ? 1
          : 0
      ),
      ...link,
    },
    { merge: true }
  );

  await batch.commit();

  return conversationId;
}

export function subscribeToStudentConversations(
  studentId: string,
  callback: (
    items: Conversation[]
  ) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, "conversations"),
    where(
      "studentId",
      "==",
      studentId
    )
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        toConversation(
          d.id,
          d.data()
        )
      );

      rows.sort(
        (a, b) =>
          millis(b.lastAt) -
          millis(a.lastAt)
      );

      callback(rows);
    },
    (e) => onError?.(e)
  );
}

export function subscribeToOfficeConversations(
  office: Office,
  callback: (
    items: Conversation[]
  ) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, "conversations"),
    where("office", "==", office)
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        toConversation(
          d.id,
          d.data()
        )
      );

      rows.sort(
        (a, b) =>
          millis(b.lastAt) -
          millis(a.lastAt)
      );

      callback(rows);
    },
    (e) => onError?.(e)
  );
}

export function subscribeToConversationMessages(
  conversationId: string,
  callback: (
    items: ChatMessage[]
  ) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, "messages"),
    where(
      "conversationId",
      "==",
      conversationId
    )
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();

        return {
          id: d.id,
          conversationId,
          senderRole:
            data.senderRole ??
            "staff",
          senderName:
            data.senderName ?? "",
          text: data.text ?? "",
          related:
            readRelated(data),
          createdAt:
            data.createdAt,
        } as ChatMessage;
      });

      rows.sort(
        (a, b) =>
          millis(a.createdAt) -
          millis(b.createdAt)
      );

      callback(rows);
    },
    (e) => onError?.(e)
  );
}

export async function markConversationRead(
  conversationId: string,
  side: "student" | "staff"
): Promise<void> {
  try {
    await updateDoc(
      doc(
        db,
        "conversations",
        conversationId
      ),
      {
        [
          side === "student"
            ? "studentUnread"
            : "staffUnread"
        ]: 0,
      }
    );
  } catch (error) {
    console.warn(
      "Could not mark conversation as read:",
      error
    );
  }
}

/** Resolve a student ID to an account name (null when no such student exists). */
export async function lookupStudent(
  studentId: string
): Promise<{
  studentId: string;
  name: string;
} | null> {
  const id = studentId.trim();

  if (!id) return null;

  const snap = await getDocs(
    query(
      collection(db, "accounts"),
      where(
        "student_id",
        "==",
        id
      )
    )
  );

  if (snap.empty) return null;

  const data =
    snap.docs[0].data();

  return {
    studentId: id,
    name: String(
      data.name ?? id
    ),
  };
}