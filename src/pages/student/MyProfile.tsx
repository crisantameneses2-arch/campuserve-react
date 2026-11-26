import { useState } from "react";
import { logout } from "../../services/logout";
import "./MyProfile.css";

/*
 * My Profile (student)
 * A read-only summary of the student's account: who they are, their
 * academic details, contact details, a quick count of their activity,
 * and shortcuts. Details are managed by the Registrar, so changes are
 * requested through Messages.
 */

type MyProfileProps = {
  account: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    student_id?: string;
    campus?: string;
    college?: string;
    program?: string;
    yearLevel?: string;
    section?: string;
    semester?: string;
    contactNumber?: string;
    status?: string;
  };
  stats?: {
    documents: number;
    items: number;
    readyToClaim: number;
  };
  onNavigate?: (page: "transactions" | "messages" | "settings" | "claimStub") => void;
};

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => /[a-z]/i.test(part));

  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toTitle(value: string) {
  // "COLLEGE OF COMPUTING SCIENCES" → "College of Computing Sciences"
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\b(Of|And|In|The)\b/g, (word) => word.toLowerCase());
}

function Row({ label, value }: { label: string; value?: string }) {
  const shown = value?.trim();

  return (
    <div className="mpx-row">
      <dt>{label}</dt>
      <dd className={shown ? "" : "is-empty"}>{shown || "Not set"}</dd>
    </div>
  );
}

export default function MyProfile({ account, stats, onNavigate }: MyProfileProps) {
  const name = account.name?.trim() || "Student";
  const [loggingOut, setLoggingOut] = useState(false);
  const isActive = !account.status || account.status === "active";

  return (
    <div className="mpx">
      {/* ---------- Header ---------- */}
      <section className="mpx-hero">
        <div className="mpx-hero__art" aria-hidden="true" />

        <div className="mpx-avatar" aria-hidden="true">
          {getInitials(name)}
        </div>

        <div className="mpx-hero__copy">
          <span className="mpx-eyebrow">STUDENT PROFILE</span>
          <h2>{name}</h2>
          <p>{account.email || "No email on file"}</p>

          <div className="mpx-chips">
            {account.student_id && (
              <span className="mpx-chip mpx-chip--id">ID {account.student_id}</span>
            )}
            <span className={`mpx-chip ${isActive ? "mpx-chip--ok" : ""}`}>
              <i aria-hidden="true" />
              {isActive ? "Active student" : toTitle(String(account.status))}
            </span>
            {account.campus && <span className="mpx-chip">{account.campus}</span>}
          </div>
        </div>
      </section>

      {/* ---------- Activity ---------- */}
      {stats && (
        <section className="mpx-stats" aria-label="Your activity">
          <button
            type="button"
            className="mpx-stat"
            onClick={() => onNavigate?.("transactions")}
          >
            <strong>{stats.documents}</strong>
            <span>Document requests</span>
          </button>

          <button
            type="button"
            className="mpx-stat"
            onClick={() => onNavigate?.("transactions")}
          >
            <strong>{stats.items}</strong>
            <span>Item reservations</span>
          </button>

          <button
            type="button"
            className={`mpx-stat ${stats.readyToClaim > 0 ? "is-hot" : ""}`}
            onClick={() => onNavigate?.("claimStub")}
          >
            <strong>{stats.readyToClaim}</strong>
            <span>Ready to claim</span>
          </button>
        </section>
      )}

      <div className="mpx-grid">
        {/* ---------- Academic ---------- */}
        <section className="mpx-card">
          <header>
            <h3>Academic information</h3>
          </header>

          <dl>
            <Row label="Student ID" value={account.student_id} />
            <Row label="College" value={account.college && toTitle(account.college)} />
            <Row label="Program" value={account.program} />
            <Row label="Year level" value={account.yearLevel} />
            <Row label="Section" value={account.section} />
            <Row label="Semester" value={account.semester} />
          </dl>
        </section>

        {/* ---------- Contact + account ---------- */}
        <div className="mpx-side">
          <section className="mpx-card">
            <header>
              <h3>Contact details</h3>
            </header>

            <dl>
              <Row label="Full name" value={account.name} />
              <Row label="Email" value={account.email} />
              <Row label="Mobile" value={account.contactNumber} />
              <Row label="Campus" value={account.campus} />
            </dl>

            <p className="mpx-note">
              Something wrong? Your records are kept by the Registrar.{" "}
              <button
                type="button"
                className="mpx-link"
                onClick={() => onNavigate?.("messages")}
              >
                Message the Registrar
              </button>
            </p>
          </section>

          <section className="mpx-card mpx-actions">
            <button
              type="button"
              className="mpx-action"
              onClick={() => onNavigate?.("settings")}
            >
              <span>Account settings</span>
              <small>Appearance and notifications</small>
            </button>

            <button
              type="button"
              className="mpx-logout"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await logout();
                } finally {
                  setLoggingOut(false);
                }
              }}
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
