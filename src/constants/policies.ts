/**
 * Business rules for cancellation and rescheduling.
 * Change a value here and every screen + service follows it.
 */

/** Maximum number of times a single transaction can be rescheduled. */
export const MAX_RESCHEDULES = 2;

/** Item reservations can be cancelled by the student within this many hours of being made. */
export const ITEM_CANCEL_WINDOW_HOURS = 48;

/** A new claiming schedule must fall within this many days from today. */
export const RESCHEDULE_WINDOW_DAYS = 14;