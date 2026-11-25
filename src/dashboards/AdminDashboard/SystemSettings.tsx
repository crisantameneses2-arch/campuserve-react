import { useCallback, useEffect, useState } from "react";

import "./SystemSettings.css";

import type { LogActor } from "../../services/activityLog";

import {
  fetchSettings,
  LIMITS,
  saveSettings,
  settingsEqual,
  validateSettings,
  type SettingsErrors,
  type SystemSettings as Settings,
} from "../../services/settings";

type SystemSettingsProps = {
  actor: LogActor;
};

type TabKey =
  | "general"
  | "documents"
  | "reservations"
  | "notifications"
  | "schedule"
  | "maintenance";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "documents", label: "Document Requests" },
  { key: "reservations", label: "Item Reservations" },
  { key: "notifications", label: "Notifications" },
  { key: "schedule", label: "Claiming Schedule" },
  { key: "maintenance", label: "Maintenance" },
];

/** Which tab each setting lives on (to jump to the first error). */
const TAB_FOR_KEY: Record<keyof Settings, TabKey> = {
  systemName: "general",
  institution: "general",
  campus: "general",
  supportEmail: "general",
  contactNumber: "general",
  allowDocumentRequests: "documents",
  maxCopiesPerRequest: "documents",
  allowItemReservations: "reservations",
  maxItemsPerReservation: "reservations",
  notificationsEnabled: "notifications",
  notifyStudents: "notifications",
  notifyStaff: "notifications",
  officeStartTime: "schedule",
  officeEndTime: "schedule",
  maxReschedules: "schedule",
  rescheduleWindowDays: "schedule",
  maintenanceMode: "maintenance",
  maintenanceMessage: "maintenance",
};

type TextKey =
  | "systemName"
  | "institution"
  | "campus"
  | "supportEmail"
  | "contactNumber";

type NumberKey = keyof typeof LIMITS;

type ToggleKey =
  | "allowDocumentRequests"
  | "allowItemReservations"
  | "notificationsEnabled"
  | "notifyStudents"
  | "notifyStaff"
  | "maintenanceMode";

type Banner = { type: "success" | "error"; text: string } | null;

function SystemSettings({ actor }: SystemSettingsProps) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tryingToSave, setTryingToSave] = useState(false);

  const [tab, setTab] = useState<TabKey>("general");
  const [banner, setBanner] = useState<Banner>(null);

  /* ---------- load ---------- */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const settings = await fetchSettings();

      setSaved(settings);
      setDraft(settings);
    } catch (error) {
      console.error("Error loading settings:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- derived ---------- */

  const dirty = !!saved && !!draft && !settingsEqual(saved, draft);

  const errors: SettingsErrors =
    draft && tryingToSave ? validateSettings(draft) : {};

  const tabHasError = (key: TabKey) =>
    (Object.keys(errors) as (keyof Settings)[]).some(
      (name) => TAB_FOR_KEY[name] === key
    );

  const update = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setDraft((current) =>
      current ? { ...current, [key]: value } : current
    );
    setBanner(null);
  };

  /* ---------- actions ---------- */

  const handleSave = async () => {
    if (!saved || !draft || !dirty) return;

    setTryingToSave(true);

    const problems = validateSettings(draft);
    const firstProblem = Object.keys(problems)[0] as
      | keyof Settings
      | undefined;

    if (firstProblem) {
      setTab(TAB_FOR_KEY[firstProblem]);

      setBanner({
        type: "error",
        text: "Please fix the highlighted fields.",
      });

      return;
    }

    setSaving(true);
    setBanner(null);

    try {
      const result = await saveSettings(draft, saved, actor);

      setSaved(result);
      setDraft(result);
      setTryingToSave(false);

      setBanner({
        type: "success",
        text: "Settings saved.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);

      setBanner({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(saved);
    setTryingToSave(false);
    setBanner(null);
  };

  /* ---------- render ---------- */

  if (loading) {
    return (
      <div className="settings-page">
        <p className="settings-state">Loading settings…</p>
      </div>
    );
  }

  if (loadError || !draft) {
    return (
      <div className="settings-page">
        <div className="settings-banner settings-banner-error">
          <span>{loadError || "Could not load settings."}</span>
        </div>

        <button
          type="button"
          className="settings-save-top"
          onClick={load}
        >
          Try again
        </button>
      </div>
    );
  }

  const textField = (
    key: TextKey,
    label: string,
    options: { type?: string; hint?: string } = {}
  ) => (
    <div className="setting-field">
      <label htmlFor={`setting-${key}`}>{label}</label>

      <input
        id={`setting-${key}`}
        type={options.type || "text"}
        value={draft[key]}
        aria-invalid={!!errors[key]}
        onChange={(event) => update(key, event.target.value)}
      />

      {options.hint && !errors[key] && (
        <small className="setting-hint">{options.hint}</small>
      )}

      {errors[key] && (
        <small className="setting-error">{errors[key]}</small>
      )}
    </div>
  );

  const numberField = (
    key: NumberKey,
    label: string,
    hint: string
  ) => {
    const value = draft[key];

    return (
      <div className="setting-field setting-field-number">
        <label htmlFor={`setting-${key}`}>{label}</label>

        <input
          id={`setting-${key}`}
          type="number"
          inputMode="numeric"
          min={LIMITS[key].min}
          max={LIMITS[key].max}
          step={1}
          value={Number.isFinite(value) ? value : ""}
          aria-invalid={!!errors[key]}
          onChange={(event) =>
            update(
              key,
              event.target.value === ""
                ? Number.NaN
                : Number(event.target.value)
            )
          }
        />

        {errors[key] ? (
          <small className="setting-error">{errors[key]}</small>
        ) : (
          <small className="setting-hint">{hint}</small>
        )}
      </div>
    );
  };

  const toggle = (
    key: ToggleKey,
    title: string,
    description: string,
    disabled = false
  ) => (
    <div
      className={`setting-toggle ${
        disabled ? "setting-toggle-disabled" : ""
      }`}
    >
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <label className="switch">
        <input
          type="checkbox"
          aria-label={title}
          checked={draft[key]}
          disabled={disabled}
          onChange={(event) => update(key, event.target.checked)}
        />

        <span />
      </label>
    </div>
  );

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1>System Settings</h1>
          <p>
            Configure CampuServe system preferences and policies.
          </p>
        </div>

        <div className="settings-header-actions">
          {dirty && (
            <button
              type="button"
              className="settings-discard"
              onClick={handleDiscard}
              disabled={saving}
            >
              Discard
            </button>
          )}

          <button
            type="button"
            className="settings-save-top"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving
              ? "Saving…"
              : dirty
              ? "Save Changes"
              : "No changes"}
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`settings-banner settings-banner-${banner.type}`}
          role={banner.type === "error" ? "alert" : "status"}
        >
          <span>{banner.text}</span>

          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setBanner(null)}
          >
            ×
          </button>
        </div>
      )}

      {saved?.maintenanceMode && (
        <div className="settings-banner settings-banner-warning">
          <span>
            Maintenance mode is ON. Students cannot submit new
            document requests or item reservations.
          </span>
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-navigation">
          {TABS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={tab === item.key ? "active" : ""}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {tabHasError(item.key) && (
                <span
                  className="settings-tab-error"
                  aria-label="has errors"
                >
                  !
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="settings-content">
          {tab === "general" && (
            <div className="settings-card">
              <h2>General Settings</h2>

              <p className="settings-description">
                Basic information about the CampuServe system. The
                contact details are shown to students when they run
                into a limit or the system is paused.
              </p>

              <div className="settings-form">
                {textField("systemName", "System Name")}
                {textField("institution", "Institution")}
                {textField("campus", "Campus")}
                {textField("supportEmail", "Support Email", {
                  type: "email",
                })}
                {textField("contactNumber", "Contact Number", {
                  type: "tel",
                  hint: "Optional.",
                })}
              </div>
            </div>
          )}

          {tab === "documents" && (
            <div className="settings-card">
              <h2>Document Requests</h2>

              <p className="settings-description">
                Control how students submit document requests.
              </p>

              {toggle(
                "allowDocumentRequests",
                "Allow Document Requests",
                "When off, students can't submit new document requests. Requests already submitted continue as normal."
              )}

              <div className="settings-form">
                {numberField(
                  "maxCopiesPerRequest",
                  "Maximum Copies per Request",
                  "Total copies across all documents in one request."
                )}
              </div>
            </div>
          )}

          {tab === "reservations" && (
            <div className="settings-card">
              <h2>Item Reservations</h2>

              <p className="settings-description">
                Control how students reserve items online.
              </p>

              {toggle(
                "allowItemReservations",
                "Allow Item Reservations",
                "When off, students can't make new item reservations. Existing reservations are not affected."
              )}

              <div className="settings-form">
                {numberField(
                  "maxItemsPerReservation",
                  "Maximum Items per Reservation",
                  "Total quantity of all items in one reservation."
                )}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="settings-card">
              <h2>Notifications</h2>

              <p className="settings-description">
                Manage who the system sends notifications to.
              </p>

              {toggle(
                "notificationsEnabled",
                "Enable Notifications",
                "Master switch. When off, no new notifications are created for anyone. Existing notifications stay visible."
              )}

              {toggle(
                "notifyStudents",
                "Notify Students",
                "Status updates, reminders and group invitations sent to students.",
                !draft.notificationsEnabled
              )}

              {toggle(
                "notifyStaff",
                "Notify Staff",
                "New request and stock alerts sent to the Registrar, General Office and Admin.",
                !draft.notificationsEnabled
              )}
            </div>
          )}

          {tab === "schedule" && (
            <div className="settings-card">
              <h2>Claiming Schedule</h2>

              <p className="settings-description">
                Rules for claiming and rescheduling. Claiming
                sessions themselves are created as AM or PM sessions
                in the Registrar dashboard.
              </p>

              <div className="settings-form">
                {numberField(
                  "maxReschedules",
                  "Maximum Reschedules",
                  "How many times a student can move one transaction to a new slot. Use 0 to turn rescheduling off."
                )}

                {numberField(
                  "rescheduleWindowDays",
                  "Reschedule Window (days)",
                  "A new slot must fall within this many days from today."
                )}
              </div>

              <h3 className="settings-subheading">Office Hours</h3>

              <p className="settings-description">
                For reference only. They are not used to block
                anything.
              </p>

              <div className="schedule-row">
                <div>
                  <label htmlFor="setting-start">Start Time</label>

                  <input
                    id="setting-start"
                    type="time"
                    value={draft.officeStartTime}
                    aria-invalid={!!errors.officeStartTime}
                    onChange={(event) =>
                      update("officeStartTime", event.target.value)
                    }
                  />

                  {errors.officeStartTime && (
                    <small className="setting-error">
                      {errors.officeStartTime}
                    </small>
                  )}
                </div>

                <div>
                  <label htmlFor="setting-end">End Time</label>

                  <input
                    id="setting-end"
                    type="time"
                    value={draft.officeEndTime}
                    aria-invalid={!!errors.officeEndTime}
                    onChange={(event) =>
                      update("officeEndTime", event.target.value)
                    }
                  />

                  {errors.officeEndTime && (
                    <small className="setting-error">
                      {errors.officeEndTime}
                    </small>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "maintenance" && (
            <div className="settings-card">
              <h2>Maintenance</h2>

              <p className="settings-description">
                Pause new activity while you fix or update the
                system. Students can still log in and view their
                records.
              </p>

              {toggle(
                "maintenanceMode",
                "Maintenance Mode",
                "When on, students can't submit new document requests or item reservations."
              )}

              <div className="settings-form">
                <div className="setting-field">
                  <label htmlFor="setting-maintenanceMessage">
                    Message to Students
                  </label>

                  <textarea
                    id="setting-maintenanceMessage"
                    rows={3}
                    maxLength={200}
                    value={draft.maintenanceMessage}
                    aria-invalid={!!errors.maintenanceMessage}
                    placeholder="Leave blank to use the standard maintenance message."
                    onChange={(event) =>
                      update(
                        "maintenanceMessage",
                        event.target.value
                      )
                    }
                  />

                  {errors.maintenanceMessage ? (
                    <small className="setting-error">
                      {errors.maintenanceMessage}
                    </small>
                  ) : (
                    <small className="setting-hint">
                      {draft.maintenanceMessage.length}/200
                    </small>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;
