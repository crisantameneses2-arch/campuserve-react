import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../../firebase";

import {
  MAX_RESCHEDULES,
  RESCHEDULE_WINDOW_DAYS,
} from "../constants/policies";

import { logActivity, type LogActor } from "./activityLog";

/* =====================================================
   TYPES & DEFAULTS
===================================================== */

export type SystemSettings = {
  /* General */
  systemName: string;
  institution: string;
  campus: string;
  supportEmail: string;
  contactNumber: string;

  /* Document requests */
  allowDocumentRequests: boolean;
  maxCopiesPerRequest: number;

  /* Item reservations */
  allowItemReservations: boolean;
  maxItemsPerReservation: number;

  /* Notifications */
  notificationsEnabled: boolean;
  notifyStudents: boolean;
  notifyStaff: boolean;

  /* Claiming schedule */
  /** Office hours, "HH:MM" (24-hour). For reference only. */
  officeStartTime: string;
  officeEndTime: string;
  maxReschedules: number;
  rescheduleWindowDays: number;

  /* Maintenance */
  maintenanceMode: boolean;
  maintenanceMessage: string;
};

export const DEFAULT_SETTINGS: SystemSettings = {
  systemName: "CampuServe",
  institution: "Pangasinan State University",
  campus: "Lingayen Campus",
  supportEmail: "support@campuserve.edu.ph",
  contactNumber: "",

  allowDocumentRequests: true,
  maxCopiesPerRequest: 10,

  allowItemReservations: true,
  maxItemsPerReservation: 10,

  notificationsEnabled: true,
  notifyStudents: true,
  notifyStaff: true,

  officeStartTime: "08:00",
  officeEndTime: "17:00",
  maxReschedules: MAX_RESCHEDULES,
  rescheduleWindowDays: RESCHEDULE_WINDOW_DAYS,

  maintenanceMode: false,
  maintenanceMessage: "",
};

/** Allowed range for each number setting (inclusive). */
export const LIMITS = {
  maxCopiesPerRequest: { min: 1, max: 50 },
  maxItemsPerReservation: { min: 1, max: 50 },
  maxReschedules: { min: 0, max: 10 },
  rescheduleWindowDays: { min: 1, max: 60 },
} as const;

export type SettingsErrors = Partial<
  Record<keyof SystemSettings, string>
>;

export type FeatureKey = "documentRequests" | "itemReservations";

const SETTING_KEYS = Object.keys(
  DEFAULT_SETTINGS
) as (keyof SystemSettings)[];

/** Where the settings live: one document, `settings/system`. */
const settingsRef = () => doc(db, "settings", "system");

/* =====================================================
   READ
===================================================== */

const str = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

/** Text that is allowed to be empty. */
const optionalStr = (value: unknown) =>
  typeof value === "string" ? value : "";

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const int = (
  value: unknown,
  fallback: number,
  min: number,
  max: number
) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max
    ? value
    : fallback;

/** Merges stored data over the defaults, ignoring bad values. */
function normalize(data: Record<string, unknown>): SystemSettings {
  const d = DEFAULT_SETTINGS;

  return {
    systemName: str(data.systemName, d.systemName),
    institution: str(data.institution, d.institution),
    campus: str(data.campus, d.campus),
    supportEmail: str(data.supportEmail, d.supportEmail),
    contactNumber: optionalStr(data.contactNumber),

    allowDocumentRequests: bool(
      data.allowDocumentRequests,
      d.allowDocumentRequests
    ),
    maxCopiesPerRequest: int(
      data.maxCopiesPerRequest,
      d.maxCopiesPerRequest,
      LIMITS.maxCopiesPerRequest.min,
      LIMITS.maxCopiesPerRequest.max
    ),

    allowItemReservations: bool(
      data.allowItemReservations,
      d.allowItemReservations
    ),
    maxItemsPerReservation: int(
      data.maxItemsPerReservation,
      d.maxItemsPerReservation,
      LIMITS.maxItemsPerReservation.min,
      LIMITS.maxItemsPerReservation.max
    ),

    notificationsEnabled: bool(
      data.notificationsEnabled,
      d.notificationsEnabled
    ),
    notifyStudents: bool(data.notifyStudents, d.notifyStudents),
    notifyStaff: bool(data.notifyStaff, d.notifyStaff),

    officeStartTime: str(data.officeStartTime, d.officeStartTime),
    officeEndTime: str(data.officeEndTime, d.officeEndTime),
    maxReschedules: int(
      data.maxReschedules,
      d.maxReschedules,
      LIMITS.maxReschedules.min,
      LIMITS.maxReschedules.max
    ),
    rescheduleWindowDays: int(
      data.rescheduleWindowDays,
      d.rescheduleWindowDays,
      LIMITS.rescheduleWindowDays.min,
      LIMITS.rescheduleWindowDays.max
    ),

    maintenanceMode: bool(data.maintenanceMode, d.maintenanceMode),
    maintenanceMessage: optionalStr(data.maintenanceMessage),
  };
}

/** Always reads from Firestore (used by the admin page). */
export async function fetchSettings(): Promise<SystemSettings> {
  const snapshot = await getDoc(settingsRef());

  const value = snapshot.exists()
    ? normalize(snapshot.data())
    : { ...DEFAULT_SETTINGS };

  cache = { value, at: Date.now() };

  return value;
}

/* =====================================================
   CACHED READ FOR THE REST OF THE APP
===================================================== */

const CACHE_MS = 60_000;

let cache: { value: SystemSettings | null; at: number } | null =
  null;

/**
 * Settings for feature checks. Cached briefly so a student's actions
 * don't each cost a read. Returns `null` when the settings can't be
 * read, and callers then allow the action instead of blocking students
 * by mistake.
 */
async function getSettingsCached(): Promise<SystemSettings | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }

  try {
    return await fetchSettings();
  } catch (error) {
    console.warn(
      "Could not read system settings; allowing the action.",
      error
    );

    cache = { value: null, at: Date.now() };

    return null;
  }
}

function contactLine(settings: SystemSettings): string {
  const contacts = [settings.supportEmail, settings.contactNumber]
    .map((item) => item.trim())
    .filter(Boolean);

  return contacts.length > 0
    ? ` For help, contact ${contacts.join(" or ")}.`
    : "";
}

/**
 * Throws a student-friendly error when the administrator has turned
 * this feature off, or the system is in maintenance mode.
 * Call it before creating anything.
 */
export async function assertFeatureEnabled(
  feature: FeatureKey
): Promise<void> {
  const settings = await getSettingsCached();

  if (!settings) return;

  const contact = contactLine(settings);

  if (settings.maintenanceMode) {
    const message =
      settings.maintenanceMessage.trim() ||
      `${settings.systemName} is under maintenance. New requests and reservations are paused. Please try again later.`;

    throw new Error(`${message}${contact}`);
  }

  if (
    feature === "documentRequests" &&
    !settings.allowDocumentRequests
  ) {
    throw new Error(
      `Document requests are currently turned off by the administrator. Please try again later.${contact}`
    );
  }

  if (
    feature === "itemReservations" &&
    !settings.allowItemReservations
  ) {
    throw new Error(
      `Item reservations are currently turned off by the administrator. Please try again later.${contact}`
    );
  }
}

/** Rejects a document request that has more copies than allowed. */
export async function assertCopiesAllowed(
  copies: number
): Promise<void> {
  const settings = await getSettingsCached();

  if (!settings) return;

  if (copies > settings.maxCopiesPerRequest) {
    throw new Error(
      `You can request at most ${settings.maxCopiesPerRequest} copies in total per request (you selected ${copies}). Please reduce the number of copies.`
    );
  }
}

/** Rejects a reservation that has more items than allowed. */
export async function assertReservationSizeAllowed(
  totalQuantity: number
): Promise<void> {
  const settings = await getSettingsCached();

  if (!settings) return;

  if (totalQuantity > settings.maxItemsPerReservation) {
    throw new Error(
      `You can reserve at most ${settings.maxItemsPerReservation} items per reservation (you selected ${totalQuantity}). Please remove some items.`
    );
  }
}

/** Scheduling limits, falling back to the built-in defaults. */
export async function getPolicies(): Promise<{
  maxReschedules: number;
  rescheduleWindowDays: number;
}> {
  const settings = await getSettingsCached();

  return {
    maxReschedules:
      settings?.maxReschedules ?? DEFAULT_SETTINGS.maxReschedules,
    rescheduleWindowDays:
      settings?.rescheduleWindowDays ??
      DEFAULT_SETTINGS.rescheduleWindowDays,
  };
}

/**
 * Whether a notification for this audience may be created.
 * Audiences look like "student:<id>", "broadcast:students" or
 * "role:<staff role>".
 */
export async function isNotificationAllowed(
  audience: string
): Promise<boolean> {
  const settings = await getSettingsCached();

  if (!settings) return true;
  if (!settings.notificationsEnabled) return false;

  if (
    audience.startsWith("student:") ||
    audience === "broadcast:students"
  ) {
    return settings.notifyStudents;
  }

  if (audience.startsWith("role:")) {
    return settings.notifyStaff;
  }

  return true;
}

export async function areNotificationsEnabled(): Promise<boolean> {
  const settings = await getSettingsCached();

  return settings ? settings.notificationsEnabled : true;
}

/* =====================================================
   VALIDATE & SAVE
===================================================== */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

export function validateSettings(
  settings: SystemSettings
): SettingsErrors {
  const errors: SettingsErrors = {};

  if (!settings.systemName.trim()) {
    errors.systemName = "System name is required.";
  } else if (settings.systemName.trim().length > 60) {
    errors.systemName = "Use 60 characters or fewer.";
  }

  if (!settings.institution.trim()) {
    errors.institution = "Institution is required.";
  } else if (settings.institution.trim().length > 100) {
    errors.institution = "Use 100 characters or fewer.";
  }

  if (!settings.campus.trim()) {
    errors.campus = "Campus is required.";
  } else if (settings.campus.trim().length > 100) {
    errors.campus = "Use 100 characters or fewer.";
  }

  if (!EMAIL_PATTERN.test(settings.supportEmail.trim())) {
    errors.supportEmail = "Enter a valid email address.";
  }

  if (
    settings.contactNumber.trim() &&
    !PHONE_PATTERN.test(settings.contactNumber.trim())
  ) {
    errors.contactNumber =
      "Use 7 to 20 digits. You may use + - ( ) and spaces.";
  }

  (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).forEach((key) => {
    const { min, max } = LIMITS[key];
    const value = settings[key];

    if (!Number.isInteger(value) || value < min || value > max) {
      errors[key] = `Enter a whole number from ${min} to ${max}.`;
    }
  });

  if (!TIME_PATTERN.test(settings.officeStartTime)) {
    errors.officeStartTime = "Enter a start time.";
  }

  if (!TIME_PATTERN.test(settings.officeEndTime)) {
    errors.officeEndTime = "Enter an end time.";
  } else if (
    TIME_PATTERN.test(settings.officeStartTime) &&
    settings.officeEndTime <= settings.officeStartTime
  ) {
    errors.officeEndTime = "End time must be after the start time.";
  }

  if (settings.maintenanceMessage.trim().length > 200) {
    errors.maintenanceMessage = "Use 200 characters or fewer.";
  }

  return errors;
}

export function settingsEqual(
  a: SystemSettings,
  b: SystemSettings
): boolean {
  return SETTING_KEYS.every((key) => a[key] === b[key]);
}

export async function saveSettings(
  next: SystemSettings,
  previous: SystemSettings,
  actor: LogActor
): Promise<SystemSettings> {
  const errors = validateSettings(next);

  if (Object.keys(errors).length > 0) {
    throw new Error("Please fix the highlighted fields.");
  }

  const clean: SystemSettings = {
    ...next,
    systemName: next.systemName.trim(),
    institution: next.institution.trim(),
    campus: next.campus.trim(),
    supportEmail: next.supportEmail.trim(),
    contactNumber: next.contactNumber.trim(),
    maintenanceMessage: next.maintenanceMessage.trim(),
  };

  await setDoc(settingsRef(), {
    ...clean,
    updatedAt: serverTimestamp(),
    updatedBy: actor.id || null,
  });

  // Make this browser see the new values immediately.
  cache = { value: clean, at: Date.now() };

  const changed = SETTING_KEYS.filter(
    (key) => clean[key] !== previous[key]
  );

  if (changed.length > 0) {
    await logActivity(
      actor,
      "Changed Settings",
      `Updated system settings: ${changed.join(", ")}.`,
      Object.fromEntries(
        changed.map((key) => [
          key,
          `${String(previous[key])} → ${String(clean[key])}`,
        ])
      )
    );
  }

  return clean;
}