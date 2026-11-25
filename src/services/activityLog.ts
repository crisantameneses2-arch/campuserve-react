import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase";

export type LogActor = {
  id?: string;
  name?: string;
  role?: string;
};

/**
 * Writes one entry to the `activityLogs` collection, using the same
 * shape the Registrar workflow already writes, so everything shows up
 * together on the admin Activity Logs page.
 *
 * Logging never throws: a failed log must not block the real action.
 */
export async function logActivity(
  actor: LogActor,
  action: string,
  description: string,
  details: Record<string, unknown> = {},
  requestId: string | null = null
): Promise<void> {
  try {
    await addDoc(collection(db, "activityLogs"), {
      actor_id: actor.id || null,
      actor_name: actor.name || "Unknown user",
      actor_role: actor.role || "admin",
      action,
      description,
      request_id: requestId,
      timestamp: serverTimestamp(),
      details,
    });
  } catch (error) {
    console.error("Could not write activity log:", error);
  }
}