
import { useState } from "react";
import "./AccountSettings.css";

export default function AccountSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="account-settings-page">
      <div className="account-settings-header">
        <span className="account-settings-eyebrow">ACCOUNT</span>
        <h2>Account Settings</h2>
        <p>Manage your account preferences and security.</p>
      </div>

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
            <p>Receive updates and important announcements through email.</p>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
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
