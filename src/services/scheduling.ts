import { collection, doc, getDocs, runTransaction } from "firebase/firestore";

import { db } from "../../firebase";
import { MAX_RESCHEDULES, RESCHEDULE_WINDOW_DAYS } from "../constants/policies";
import { normalizeStatus } from "../utils/format";

/* =========================================================
   Shared claiming-slot logic for rescheduling.

   Both document requests and item reservations reschedule against the
   `claimingSchedules` collection (claimDate, timeSlot, slotCapacity, availableSlot).
   A reschedule takes one slot from the new schedule and gives one back
   to the schedule the transaction was previously holding (if it held one).
========================================================= */

export interface ClaimSlot {
  id: string;
  claimDate: string;
  timeSlot: string;
  availableSlot: number;
}

const compact = (value: string) => value.replace(/\s+/g, "").toUpperCase();

/** "10:00 AM - 12:00 PM" | "8:00AM - 10:00AM" | "14:00"  ->  minutes since midnight of the START time */
export function startMinutes(timeSlot: string): number {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(timeSlot);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3]?.toUpperCase();
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export const sameSlot = (
  aDate?: string,
  aTime?: string,
  bDate?: string,
  bTime?: string
) => Boolean(aDate && bDate && aDate === bDate && compact(aTime ?? "") === compact(bTime ?? ""));

/**
 * Slots a student can move to: today .. today + RESCHEDULE_WINDOW_DAYS,
 * with free capacity, not already in the past, and not the current slot.
 * Sorted soonest first, so index 0 is the "next available slot".
 */
export async function getAvailableSlots(current?: {
  date?: string;
  time?: string;
}): Promise<ClaimSlot[]> {
  const snapshot = await getDocs(collection(db, "claimingSchedules"));

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const last = new Date(today);
  last.setDate(last.getDate() + RESCHEDULE_WINDOW_DAYS);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        claimDate: String(data.claimDate ?? ""),
        timeSlot: String(data.timeSlot ?? ""),
        availableSlot: Number(data.availableSlot ?? data.availableSlots ?? 0),
      } as ClaimSlot;
    })
    .filter((slot) => {
      if (!slot.claimDate || !slot.timeSlot || slot.availableSlot <= 0) return false;
      const date = new Date(`${slot.claimDate}T00:00:00`);
      if (Number.isNaN(date.getTime()) || date < today || date > last) return false;
      if (date.getTime() === today.getTime() && startMinutes(slot.timeSlot) <= minutesNow) {
        return false;
      }
      return !sameSlot(slot.claimDate, slot.timeSlot, current?.date, current?.time);
    })
    .sort(
      (a, b) =>
        a.claimDate.localeCompare(b.claimDate) ||
        startMinutes(a.timeSlot) - startMinutes(b.timeSlot)
    );
}

/** Where each kind of transaction keeps its schedule + reschedule bookkeeping. */
export interface RescheduleFields {
  collection: string;
  statusField: string;
  dateField: string;
  timeField: string;
  scheduleIdField: string;
  countField: string;
  historyField: string;
  originalDateField: string;
  originalTimeField: string;
  prevStatusField: string;
  updatedAtField: string;
  rescheduledAtField: string;
}

export const DOCUMENT_FIELDS: RescheduleFields = {
  collection: "document_requests",
  statusField: "status",
  dateField: "requested_date",
  timeField: "requested_time",
  scheduleIdField: "schedule_id",
  countField: "reschedule_count",
  historyField: "schedule_history",
  originalDateField: "original_requested_date",
  originalTimeField: "original_requested_time",
  prevStatusField: "status_before_reschedule",
  updatedAtField: "updated_at",
  rescheduledAtField: "rescheduled_at",
};

export const ITEM_FIELDS: RescheduleFields = {
  collection: "itemReservations",
  statusField: "status",
  dateField: "pickupDate",
  timeField: "pickupTime",
  scheduleIdField: "scheduleId",
  countField: "rescheduleCount",
  historyField: "scheduleHistory",
  originalDateField: "originalPickupDate",
  originalTimeField: "originalPickupTime",
  prevStatusField: "statusBeforeReschedule",
  updatedAtField: "updatedAt",
  rescheduledAtField: "rescheduledAt",
};

export interface ScheduleHistoryEntry {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  at: string; // ISO
}

/**
 * Moves a transaction to a new slot atomically:
 *  - re-checks status + reschedule limit on the server copy
 *  - takes a slot from the new schedule (fails if it was just taken)
 *  - returns the slot the transaction was holding, if any
 *  - keeps the original schedule and logs every move
 *  - sets the separate "RESCHEDULED" status
 */
export async function rescheduleWithSlot(args: {
  fields: RescheduleFields;
  docId: string;
  allowedStatuses: string[];
  newSlot: ClaimSlot;
}): Promise<{ date: string; time: string; count: number; previousStatus: string }> {
  const { fields: f, docId, allowedStatuses, newSlot } = args;

  return runTransaction(db, async (tx) => {
    const ref = doc(db, f.collection, docId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This transaction no longer exists.");
    const data = snap.data();

    const status = normalizeStatus(data[f.statusField]);
    if (!allowedStatuses.includes(status)) {
      throw new Error("This transaction can no longer be rescheduled.");
    }

    const count = Number(data[f.countField] ?? 0);
    if (count >= MAX_RESCHEDULES) {
      throw new Error(
        `You have already used all ${MAX_RESCHEDULES} rescheduling attempts for this transaction.`
      );
    }

    const currentDate = String(data[f.dateField] ?? "");
    const currentTime = String(data[f.timeField] ?? "");
    if (sameSlot(newSlot.claimDate, newSlot.timeSlot, currentDate, currentTime)) {
      throw new Error("Please choose a different schedule from your current one.");
    }

    const newRef = doc(db, "claimingSchedules", newSlot.id);
    const newSnap = await tx.get(newRef);
    if (!newSnap.exists()) throw new Error("That schedule no longer exists.");
    const newData = newSnap.data();
    const free = Number(newData.availableSlot ?? newData.availableSlots ?? 0);
    if (free <= 0) {
      throw new Error("That slot was just taken. Please pick another one.");
    }

    const heldId = data[f.scheduleIdField] ? String(data[f.scheduleIdField]) : "";
    const oldRef = heldId && heldId !== newSlot.id ? doc(db, "claimingSchedules", heldId) : null;
    const oldSnap = oldRef ? await tx.get(oldRef) : null;

    // ---- all reads done, now write ----
    const slotField = "availableSlot" in newData || !("availableSlots" in newData) ? "availableSlot" : "availableSlots";
    tx.update(newRef, { [slotField]: free - 1 });

    if (oldRef && oldSnap?.exists()) {
      const oldData = oldSnap.data();
      const oldField = "availableSlots" in oldData && !("availableSlot" in oldData) ? "availableSlots" : "availableSlot";
      const oldFree = Number(oldData[oldField] ?? 0);
      const capacity = Number(oldData.slotCapacity ?? Number.POSITIVE_INFINITY);
      tx.update(oldRef, { [oldField]: Math.min(capacity, oldFree + 1) });
    }

    const entry: ScheduleHistoryEntry = {
      fromDate: currentDate,
      fromTime: currentTime,
      toDate: newSlot.claimDate,
      toTime: newSlot.timeSlot,
      at: new Date().toISOString(),
    };
    const history = Array.isArray(data[f.historyField]) ? data[f.historyField] : [];
    const nowStamp = new Date();

    tx.update(ref, {
      [f.statusField]: "RESCHEDULED",
      // keep the first-ever schedule so original vs. updated is always visible
      [f.originalDateField]: data[f.originalDateField] ?? currentDate,
      [f.originalTimeField]: data[f.originalTimeField] ?? currentTime,
      [f.dateField]: newSlot.claimDate,
      [f.timeField]: newSlot.timeSlot,
      [f.scheduleIdField]: newSlot.id,
      [f.countField]: count + 1,
      [f.historyField]: [...history, entry],
      [f.prevStatusField]: status === "RESCHEDULED" ? data[f.prevStatusField] ?? "APPROVED" : status,
      [f.rescheduledAtField]: nowStamp,
      [f.updatedAtField]: nowStamp,
    });

    return {
      date: newSlot.claimDate,
      time: newSlot.timeSlot,
      count: count + 1,
      previousStatus: status,
    };
  });
}