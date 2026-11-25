
import { useEffect, useState } from "react";
import "./AccountSettings.css";
import { useDarkMode } from "../../theme/darkMode";
import {
  saveNotificationPreferences,
  subscribeToNotificationPreferences,
} from "../../services/notificationPreferences";

export default function AccountSettings({ studentId = "" }: { studentId?: string }) {
  // Saved per student; the email sender checks it before every email.
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailSaveError, setEmailSaveError] = useState("");

  useEffect(() => {
    if (!studentId) return;

    return subscribeToNotificationPreferences(studentId, (preferences) =>
      setEmailNotifications(preferences.email)
    );
  }, [studentId]);

  function changeEmailNotifications(enabled: boolean) {
    setEmailNotifications(enabled);
    setEmailSaveError("");

    if (!studentId) return;

    saveNotificationPreferences(studentId, { email: enabled }).catch((error) => {
      console.warn("Could not save email preference:", error);
      setEmailNotifications(!enabled);
      setEmailSaveError("Could not save this setting. Please try again.");
    });
  }
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [darkMode, setDarkMode] = useDarkMode();

  return (
    <div className="account-settings-page">
      <section className="account-settings-section">
        <div className="account-settings-section-heading">
          <div className="account-settings-section-icon">🌙</div>
          <div>
            <h3>Appearance</h3>
            <p>Choose how CampuServe looks on this device.</p>
          </div>
        </div>

        <div className="account-settings-option">
          <div>
            <strong>Dark Mode</strong>
            <p>Use dark colours, easier on the eyes at night.</p>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              aria-label="Dark mode"
            />
            <span className="settings-slider" />
          </label>
        </div>
      </section>

      <section className="account-settings-section">
        <div className="account-settings-section-heading">
          <div className="account-settings-section-icon">🔔</div>
          <div>
            <h3>Notification Preferences</h3>
            <p>Choose which notifications you want to receive.</p>
          </div>
        </div>

        <div className="account-settings-option">
          <div>
            <strong>Email Notifications</strong>
            <p>
              Get your CampuServe notifications in your institutional email.
            </p>
            {emailSaveError && (
              <p role="alert" style={{ color: "#c0392b" }}>
                {emailSaveError}
              </p>
            )}
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => changeEmailNotifications(e.target.checked)}
              aria-label="Email notifications"
            />
            <span className="settings-slider" />
          </label>
        </div>

        <div className="account-settings-option">
          <div>
            <strong>System Notifications</strong>
            <p>Receive notifications inside your CampuServe account.</p>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={systemNotifications}
              onChange={(e) => setSystemNotifications(e.target.checked)}
            />
            <span className="settings-slider" />
          </label>
        </div>
      </section>

      <section className="account-settings-section">
        <div className="account-settings-section-heading">
          <div className="account-settings-section-icon">🔒</div>
          <div>
            <h3>Security</h3>
            <p>Manage your account password.</p>
          </div>
        </div>

        <div className="account-settings-option">
          <div>
            <strong>Password</strong>
            <p>For your security, update your password through the password reset process.</p>
          </div>
          <button
            type="button"
            className="account-settings-action"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide instructions" : "View instructions"}
          </button>
        </div>

        {showPassword && (
          <div className="account-settings-password-info">
            To change your password, log out and select <strong>Forgot Password</strong>
            on the CampuServe login page. Follow the instructions sent to your
            registered email address.
          </div>
        )}
      </section>

      <div className="account-settings-note">
        <strong>Note:</strong> These notification preferences are currently
        interface-only. They will not change actual notification delivery
        until connected to your account settings in Firebase.
      </div>
    </div>
  );
}
