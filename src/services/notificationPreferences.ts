import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../firebase";

/* =========================================================
   notification_preferences/{studentId}
     email       boolean – send notifications to the student's
                           institutional email (default: on)
     updated_at  server timestamp

   api/send-notification-email.ts reads this before emailing.
========================================================= */

export type NotificationPreferences = {
  email: boolean;
};

const DEFAULTS: NotificationPreferences = { email: true };

export function subscribeToNotificationPreferences(
  studentId: string,
  callback: (preferences: NotificationPreferences) => void
): () => void {
  return onSnapshot(
    doc(db, "notification_preferences", studentId),
    (snapshot) => {
      const data = snapshot.data();
      callback({ email: data?.email !== false });
    },
    (error) => {
      console.warn("Could not load notification preferences:", error);
      callback(DEFAULTS);
    }
  );
}

export async function saveNotificationPreferences(
  studentId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  await setDoc(
    doc(db, "notification_preferences", studentId),
    { ...preferences, updated_at: serverTimestamp() },
    { merge: true }
  );
}
