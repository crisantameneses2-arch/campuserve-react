import {
  collection,
  doc,
  getDoc,
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

/** Offices students can message. The Administrator does not take messages. */
export type Office = "registrar" | "general_office";

export const OFFICE_LABEL: Record<Office, string> = {
  registrar: "Registrar Office",
  general_office: "General Office",
};

export const OFFICES: Office[] = ["registrar", "general_office"];

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

/** A photo attached to a message. The picture itself is stored in
 *  "message_images/{id}", so loading a conversation stays light. */
export interface MessageImageRef {
  id: string;
  width: number;
  height: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: "student" | "staff";
  senderName: string;
  text: string;
  image: MessageImageRef | null;
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
  /** Optional photo, already shrunk to a JPEG data URL (see prepareChatImage). */
  image?: { dataUrl: string; width: number; height: number } | null;
  related?: RelatedRef | null;
};

/* Firestore allows about 1 MB per document; keep photos well under that. */
export const MAX_IMAGE_DATA_URL_LENGTH = 900_000;

export async function sendMessage(
  input: SendMessageInput
): Promise<string> {
  const text = input.text.trim();
  const image = input.image ?? null;

  if (!text && !image) {
    throw new Error(
      "Please type a message or add a photo first."
    );
  }

  if (
    image &&
    (!image.dataUrl.startsWith("data:image/") ||
      image.dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH)
  ) {
    throw new Error(
      "This photo is too large to send. Please try a smaller one."
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

  let imageFields = {};

  if (image) {
    const imageRef = doc(collection(db, "message_images"));

    batch.set(imageRef, {
      conversationId,
      studentId: input.studentId,
      office: input.office,
      messageId: messageRef.id,
      dataUrl: image.dataUrl,
      width: image.width,
      height: image.height,
      createdAt: serverTimestamp(),
    });

    imageFields = {
      imageId: imageRef.id,
      imageWidth: image.width,
      imageHeight: image.height,
    };
  }

  batch.set(messageRef, {
    messageId: messageRef.id,
    conversationId,
    studentId: input.studentId,
    office: input.office,
    senderRole: input.senderRole,
    senderName: input.senderName,
    text,
    ...imageFields,
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
      lastMessage: text ? text.slice(0, 160) : "📷 Photo",
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
          image: data.imageId
            ? {
                id: String(data.imageId),
                width: Number(data.imageWidth ?? 0),
                height: Number(data.imageHeight ?? 0),
              }
            : null,
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

/* ---------------- photos ---------------- */

const imageCache = new Map<string, Promise<string | null>>();

/** Loads a message photo (data URL) once and remembers it. */
export function loadMessageImage(id: string): Promise<string | null> {
  const cached = imageCache.get(id);
  if (cached) return cached;

  const pending: Promise<string | null> = getDoc(doc(db, "message_images", id))
    .then((snap) => {
      const value: unknown = snap.exists() ? snap.data().dataUrl : null;
      return typeof value === "string" ? value : null;
    })
    .catch((error: unknown) => {
      imageCache.delete(id);
      throw error;
    });

  imageCache.set(id, pending);
  return pending;
}

/**
 * Shrinks a picked photo so it fits in Firestore: longest side up to
 * 1280px, JPEG, lowering quality/size until it is small enough.
 */
export async function prepareChatImage(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a photo (JPG, PNG, WEBP…).");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("That photo is over 20 MB. Please choose a smaller one.");
  }

  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This photo could not be opened."));
      element.src = url;
    });

    let longest = 1280;
    let quality = 0.82;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const scale = Math.min(1, longest / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("This photo could not be prepared.");

      // White background so transparent PNGs don't turn black as JPEG.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
        return { dataUrl, width, height };
      }

      if (quality > 0.6) quality -= 0.1;
      else longest = Math.round(longest * 0.8);
    }

    throw new Error("This photo is too large to send. Please try a smaller one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
