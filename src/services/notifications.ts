import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase";
import { millis, normalizeStatus, type TransactionKind } from "../utils/format";

/* =========================================================
   MODEL

   notifications/{id}
     audience   "student:<studentId>" | "role:registrar" | "role:general_office" | "role:admin"
     type       STATUS | SUBMITTED | CANCELLED | RESCHEDULED | REMINDER | GROUP_REQUEST | GROUP_RESPONSE | STOCK | INFO
     title      short heading ("Request Processing")
     message    one-line body
     kind       "DOCUMENT" | "ITEM" | null  (what the notification is about)
     relatedId  request id / reservation id (optional)
     readBy     string[]  – account keys that have read it (staff share a role audience,
                            so read-state is tracked per person, not per notification)
     createdAt  server timestamp
========================================================= */

export type NotificationType =
  | "STATUS"
  | "SUBMITTED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "REMINDER"
  | "GROUP_REQUEST"
  | "GROUP_RESPONSE"
  | "STOCK"
  | "INFO";

export type StaffRole = "registrar" | "general_office" | "admin";

export interface AppNotification {
  id: string;
  audience: string;
  type: NotificationType;
  title: string;
  message: string;
  kind: TransactionKind | null;
  relatedId: string | null;
  readBy: string[];
  createdAt?: unknown;
}

export type NewNotification = {
  audience: string;
  type: NotificationType;
  title: string;
  message: string;
  kind?: TransactionKind | null;
  relatedId?: string | null;
};

export const studentAudience = (studentId: string) =>
  `student:${studentId}`;

/** Announcements for every student (e.g. "item back in stock"). */
export const ALL_STUDENTS_AUDIENCE = "broadcast:students";

export const roleAudience = (role: StaffRole) =>
  `role:${role}`;

/**
 * Create one or more notifications.
 * A notification failure must never break the action that caused it,
 * so errors are logged and swallowed.
 */
export async function notify(
  input: NewNotification | NewNotification[]
): Promise<void> {
  const list = Array.isArray(input) ? input : [input];

  await Promise.all(
    list.map(async (item) => {
      try {
        await addDoc(collection(db, "notifications"), {
          audience: item.audience,
          type: item.type,
          title: item.title,
          message: item.message,
          kind: item.kind ?? null,
          relatedId: item.relatedId ?? null,
          readBy: [],
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("Could not create notification:", error);
      }
    })
  );
}

/** Idempotent notification (used for reminders): the same id is only ever written once. */
export async function notifyOnce(
  id: string,
  item: NewNotification
): Promise<void> {
  try {
    const ref = doc(db, "notifications", id);
    const existing = await getDoc(ref);

    if (existing.exists()) return;

    await setDoc(ref, {
      audience: item.audience,
      type: item.type,
      title: item.title,
      message: item.message,
      kind: item.kind ?? null,
      relatedId: item.relatedId ?? null,
      readBy: [],
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Could not create reminder:", error);
  }
}

/* ---------- Read / subscribe ---------- */

export function subscribeToNotifications(
  audience: string | string[],
  callback: (items: AppNotification[]) => void,
  onError?: (error: Error) => void
): () => void {
  const audiences = Array.isArray(audience)
    ? audience
    : [audience];

  const q =
    audiences.length === 1
      ? query(
          collection(db, "notifications"),
          where("audience", "==", audiences[0])
        )
      : query(
          collection(db, "notifications"),
          where("audience", "in", audiences)
        );

  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => {
        const data = d.data();

        return {
          id: d.id,
          audience: data.audience,
          type: data.type ?? "INFO",
          title: data.title ?? "Notification",
          message: data.message ?? "",
          kind: data.kind ?? null,
          relatedId: data.relatedId ?? null,
          readBy: Array.isArray(data.readBy)
            ? data.readBy
            : [],
          createdAt: data.createdAt,
        } as AppNotification;
      });

      rows.sort(
        (a, b) =>
          millis(b.createdAt) -
          millis(a.createdAt)
      );

      callback(rows);
    },
    (error) => onError?.(error)
  );
}

export async function markNotificationRead(
  id: string,
  userKey: string
): Promise<void> {
  await updateDoc(
    doc(db, "notifications", id),
    {
      readBy: arrayUnion(userKey),
    }
  );
}

export async function markAllNotificationsRead(
  items: AppNotification[],
  userKey: string
): Promise<void> {
  const unread = items.filter(
    (n) => !n.readBy.includes(userKey)
  );

  for (let i = 0; i < unread.length; i += 400) {
    const batch = writeBatch(db);

    unread
      .slice(i, i + 400)
      .forEach((n) =>
        batch.update(
          doc(db, "notifications", n.id),
          {
            readBy: arrayUnion(userKey),
          }
        )
      );

    await batch.commit();
  }
}

/* =========================================================
   COPY – what each status change says to the student
========================================================= */

export function statusNotificationCopy(
  kind: TransactionKind,
  status: string,
  label: string
): {
  title: string;
  message: string;
  type: NotificationType;
} | null {
  const s = normalizeStatus(status);

  const noun =
    kind === "DOCUMENT"
      ? "request"
      : "reservation";

  const Noun =
    kind === "DOCUMENT"
      ? "Request"
      : "Reservation";

  switch (s) {
    case "APPROVED":
      return {
        type: "STATUS",
        title: `${Noun} Approved`,
        message: `Your ${label} ${noun} has been approved.`,
      };

    case "DECLINED":
      return {
        type: "STATUS",
        title: `${Noun} Declined`,
        message: `Your ${label} ${noun} was declined. Check your messages or contact the office for details.`,
      };

    case "PROCESSING":
      return {
        type: "STATUS",
        title: `${Noun} Processing`,
        message: `Your ${label} ${noun} is now being processed.`,
      };

    case "READY_FOR_PICKUP":
      return {
        type: "STATUS",
        title:
          kind === "DOCUMENT"
            ? "Document Request Ready"
            : "Reservation Ready",
        message: `Your ${label} ${noun} is ready for pickup.`,
      };

    case "COMPLETED":
      return {
        type: "STATUS",
        title: "Transaction Completed",
        message:
          kind === "DOCUMENT"
            ? "Your document transaction has been completed successfully."
            : "Your item reservation has been completed successfully.",
      };

    case "CANCELLED":
      return {
        type: "CANCELLED",
        title: `${Noun} Cancelled`,
        message: `Your ${label} ${noun} was cancelled by the office.`,
      };

    default:
      return null;
  }
}

/** Which staff role owns a transaction kind. */
export const officeRoleFor = (
  kind: TransactionKind
): StaffRole =>
  kind === "DOCUMENT"
    ? "registrar"
    : "general_office";