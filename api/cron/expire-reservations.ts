import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

/*
 * Daily job (see "crons" in vercel.json): cancels item reservations that
 * were approved by the General Office but not claimed within 7 days.
 *
 * For each expired reservation it does what the General Office's Cancel
 * button does for an approved reservation:
 *   - gives the set-aside stock back (inventory.reservedQuantity -= qty)
 *   - marks the reservation Cancelled, with a reason and cancelledAt
 * then notifies the student (in the app, plus email when they allow it).
 *
 * The 7 days count from approvedAt, which the Approve button saves.
 * Reservations approved before that existed have no approvedAt: their
 * clock starts the first time this job sees them.
 *
 * Only Vercel's scheduler may run it (Authorization: Bearer CRON_SECRET).
 * Add ?dryRun=1 to list what would be cancelled without changing anything.
 */

const CLAIM_DAYS = 7;
const CLAIM_MS = CLAIM_DAYS * 24 * 60 * 60 * 1000;

function getDb() {
  if (getApps().length > 0) return getFirestore();

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) throw new Error("Missing FIREBASE_PRIVATE_KEY");

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  return getFirestore(app);
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  const timestamp = value as { toMillis?: () => number };
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

type ReservationItem = {
  inventoryId?: string;
  itemName?: string;
  size?: string;
  quantity?: number;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const secret = process.env.CRON_SECRET;

  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dryRun = req.query.dryRun === "1";

  try {
    const db = getDb();
    const now = Date.now();

    const approved = await db
      .collection("itemReservations")
      .where("status", "==", "approved")
      .get();

    const clockStarted: string[] = [];
    const cancelled: string[] = [];
    const waiting: { id: string; daysLeft: number }[] = [];

    for (const snapshot of approved.docs) {
      const data = snapshot.data();
      const approvedAt = toMillis(data.approvedAt);
      const reservationId = String(data.reservationId || snapshot.id);

      // Approved before approvedAt was recorded: start the clock now.
      if (!approvedAt) {
        clockStarted.push(reservationId);
        if (!dryRun) {
          await snapshot.ref.update({ approvedAt: FieldValue.serverTimestamp() });
        }
        continue;
      }

      if (now - approvedAt < CLAIM_MS) {
        waiting.push({
          id: reservationId,
          daysLeft: Math.ceil((CLAIM_MS - (now - approvedAt)) / 86_400_000),
        });
        continue;
      }

      cancelled.push(reservationId);
      if (dryRun) continue;

      // Give the stock back and cancel, all or nothing.
      const didCancel = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(snapshot.ref);

        if (fresh.data()?.status !== "approved") return false;

        const items: ReservationItem[] = Array.isArray(fresh.data()?.items)
          ? fresh.data()?.items
          : [];

        // Total quantity per inventory document.
        const giveBack = new Map<string, number>();
        for (const item of items) {
          const quantity = Number(item.quantity || 0);
          if (!item.inventoryId || quantity <= 0) continue;
          giveBack.set(item.inventoryId, (giveBack.get(item.inventoryId) || 0) + quantity);
        }

        const inventoryRefs = [...giveBack.keys()].map((id) =>
          db.collection("inventory").doc(id)
        );
        const inventorySnaps = await Promise.all(
          inventoryRefs.map((ref) => transaction.get(ref))
        );

        inventorySnaps.forEach((inventory, index) => {
          if (!inventory.exists) return;
          const quantity = giveBack.get(inventoryRefs[index].id) || 0;
          const reserved = Number(inventory.data()?.reservedQuantity || 0);
          transaction.update(inventoryRefs[index], {
            reservedQuantity: Math.max(0, reserved - quantity),
          });
        });

        transaction.update(snapshot.ref, {
          status: "Cancelled",
          cancellationReason: `Not claimed within ${CLAIM_DAYS} days of approval.`,
          cancelledAt: FieldValue.serverTimestamp(),
          autoCancelled: true,
        });

        return true;
      });

      if (!didCancel) {
        cancelled.pop();
        continue;
      }

      // Tell the student (in the app; the email follows their setting).
      const studentId = String(data.studentId || "");
      if (!studentId) continue;

      const notification = await db.collection("notifications").add({
        audience: `student:${studentId}`,
        type: "CANCELLED",
        title: "Reservation Cancelled",
        message: `Your reservation ${reservationId} was cancelled because it wasn't claimed within ${CLAIM_DAYS} days of approval. The items went back to stock.`,
        kind: "ITEM",
        relatedId: reservationId,
        readBy: [],
        createdAt: Timestamp.now(),
      });

      const baseUrl = (
        process.env.APP_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
      ).replace(/\/$/, "");

      if (baseUrl) {
        await fetch(`${baseUrl}/api/send-notification-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        }).catch((error) => console.warn("Email request failed:", error));
      }
    }

    console.log(
      `${dryRun ? "[dry run] " : ""}expire-reservations: ` +
        `${cancelled.length} cancelled, ${clockStarted.length} clocks started, ` +
        `${waiting.length} still within ${CLAIM_DAYS} days`
    );

    return res.status(200).json({ dryRun, cancelled, clockStarted, waiting });
  } catch (error) {
    console.error("expire-reservations error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed.",
    });
  }
}
