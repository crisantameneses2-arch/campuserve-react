import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase";
import {
  ALUMNI_CAMPUS_OPTIONS,
  ALUMNI_COLLEGE_PROGRAMS,
} from "./alumniOptions";

/**
 * Alumni Access on the login page.
 *
 * A button opens a short form with the details the Registrar needs to
 * confirm the person was once a PSU student. The form is saved to the
 * "alumni_access_requests" collection with status PENDING. The Registrar
 * checks it against school records, then an alumni account is created.
 */

type FormState = {
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  birthdate: string;
  formerStudentId: string;
  campus: string;
  college: string;
  program: string;
  enrollmentStatus: "GRADUATED" | "ATTENDED";
  yearGraduated: string;
  email: string;
  contactNumber: string;
  consent: boolean;
};

const EMPTY: FormState = {
  lastName: "",
  firstName: "",
  middleName: "",
  suffix: "",
  birthdate: "",
  formerStudentId: "",
  campus: "Lingayen Campus",
  college: "",
  program: "",
  enrollmentStatus: "GRADUATED",
  yearGraduated: "",
  email: "",
  contactNumber: "",
  consent: false,
};

const THIS_YEAR = new Date().getFullYear();

function validate(form: FormState): string {
  if (!form.lastName.trim() || !form.firstName.trim()) {
    return "Please enter your first and last name.";
  }
  if (!form.birthdate) return "Please enter your birthdate.";
  if (!form.college || !form.program) {
    return "Please choose your college and program.";
  }
  const year = Number(form.yearGraduated);
  if (!year || year < 1950 || year > THIS_YEAR) {
    return form.enrollmentStatus === "GRADUATED"
      ? "Please enter a valid year graduated."
      : "Please enter a valid year you last attended.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Please enter a valid email address.";
  }
  if (!/^(09|\+639)\d{9}$/.test(form.contactNumber.replace(/[\s-]/g, ""))) {
    return "Please enter a valid mobile number (e.g. 09171234567).";
  }
  if (!form.consent) {
    return "Please allow the Registrar to verify your records.";
  }
  return "";
}

export default function AlumniAccessForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const programs = form.college ? ALUMNI_COLLEGE_PROGRAMS[form.college] || [] : [];

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError("");

    try {
      await addDoc(collection(db, "alumni_access_requests"), {
        last_name: form.lastName.trim(),
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        suffix: form.suffix.trim(),
        full_name: [form.firstName, form.middleName, form.lastName, form.suffix]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" "),
        birthdate: form.birthdate,
        former_student_id: form.formerStudentId.trim(),
        campus: form.campus,
        college: form.college,
        program: form.program,
        enrollment_status: form.enrollmentStatus,
        year_graduated: form.enrollmentStatus === "GRADUATED" ? form.yearGraduated : "",
        year_last_attended: form.enrollmentStatus === "ATTENDED" ? form.yearGraduated : "",
        email: form.email.trim().toLowerCase(),
        contact_number: form.contactNumber.replace(/[\s-]/g, ""),
        consent_to_verify: true,
        status: "PENDING",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setSentTo(form.email.trim());
      setForm(EMPTY);
    } catch (submitError) {
      console.error("Alumni access request error:", submitError);
      setError("We couldn't send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`campuserve-alumni-box${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="cs-alumni-toggle"
        aria-expanded={open}
        aria-controls="cs-alumni-form"
        onClick={() => {
          setOpen((value) => !value);
          setError("");
        }}
      >
        <span className="cs-alumni-toggle__text">
          <strong>Alumni Access</strong>
          <small>Former PSU student? Request an alumni account.</small>
        </span>
        <span className="cs-alumni-toggle__chev" aria-hidden="true" />
      </button>

      {open && (
        <div id="cs-alumni-form" className="cs-alumni-body">
          {sentTo ? (
            <div className="cs-alumni-done" role="status">
              <strong>Request sent!</strong>
              <p>
                The Registrar will check your records. We'll contact you at{" "}
                <b>{sentTo}</b> once your alumni account is approved.
              </p>
              <button
                type="button"
                className="cs-alumni-secondary"
                onClick={() => setSentTo("")}
              >
                Send another request
              </button>
            </div>
          ) : (
            <form className="cs-alumni-form" onSubmit={handleSubmit} noValidate>
              <p className="cs-alumni-intro">
                Fill this out so the Registrar can confirm you studied at PSU.
                Use the name you had while enrolled.
              </p>

              <fieldset>
                <legend>Your name while enrolled</legend>
                <div className="cs-alumni-grid">
                  <label>
                    Last name
                    <input
                      value={form.lastName}
                      onChange={(event) => set("lastName", event.target.value)}
                      autoComplete="family-name"
                    />
                  </label>
                  <label>
                    First name
                    <input
                      value={form.firstName}
                      onChange={(event) => set("firstName", event.target.value)}
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    Middle name <span>optional</span>
                    <input
                      value={form.middleName}
                      onChange={(event) => set("middleName", event.target.value)}
                      autoComplete="additional-name"
                    />
                  </label>
                  <label>
                    Suffix <span>optional</span>
                    <input
                      value={form.suffix}
                      onChange={(event) => set("suffix", event.target.value)}
                      placeholder="Jr., III"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>School records</legend>
                <div className="cs-alumni-grid">
                  <label>
                    Birthdate
                    <input
                      type="date"
                      value={form.birthdate}
                      max={`${THIS_YEAR - 10}-12-31`}
                      onChange={(event) => set("birthdate", event.target.value)}
                    />
                  </label>
                  <label>
                    Student ID <span>if you remember it</span>
                    <input
                      value={form.formerStudentId}
                      onChange={(event) => set("formerStudentId", event.target.value)}
                      placeholder="e.g. 18-LN-1234"
                    />
                  </label>
                  <label className="is-wide">
                    Campus
                    <select
                      value={form.campus}
                      onChange={(event) => set("campus", event.target.value)}
                    >
                      {ALUMNI_CAMPUS_OPTIONS.map((campus) => (
                        <option key={campus} value={campus}>
                          {campus}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="is-wide">
                    College
                    <select
                      value={form.college}
                      onChange={(event) => {
                        set("college", event.target.value);
                        set("program", "");
                      }}
                    >
                      <option value="">Choose your college</option>
                      {Object.keys(ALUMNI_COLLEGE_PROGRAMS).map((college) => (
                        <option key={college} value={college}>
                          {college}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="is-wide">
                    Program
                    <select
                      value={form.program}
                      disabled={!form.college}
                      onChange={(event) => set("program", event.target.value)}
                    >
                      <option value="">
                        {form.college ? "Choose your program" : "Choose a college first"}
                      </option>
                      {programs.map((program) => (
                        <option key={program} value={program}>
                          {program}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="cs-alumni-choice" role="radiogroup" aria-label="Enrollment status">
                  {(
                    [
                      ["GRADUATED", "I graduated"],
                      ["ATTENDED", "I attended but didn't graduate"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className={form.enrollmentStatus === value ? "is-on" : ""}>
                      <input
                        type="radio"
                        name="cs-alumni-status"
                        value={value}
                        checked={form.enrollmentStatus === value}
                        onChange={() => set("enrollmentStatus", value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <label className="cs-alumni-year">
                  {form.enrollmentStatus === "GRADUATED" ? "Year graduated" : "Year last attended"}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1950}
                    max={THIS_YEAR}
                    value={form.yearGraduated}
                    onChange={(event) => set("yearGraduated", event.target.value)}
                    placeholder={String(THIS_YEAR - 1)}
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>How we can reach you</legend>
                <div className="cs-alumni-grid">
                  <label className="is-wide">
                    Email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => set("email", event.target.value)}
                      autoComplete="email"
                      placeholder="you@gmail.com"
                    />
                  </label>
                  <label className="is-wide">
                    Mobile number
                    <input
                      type="tel"
                      value={form.contactNumber}
                      onChange={(event) => set("contactNumber", event.target.value)}
                      autoComplete="tel"
                      placeholder="09171234567"
                    />
                  </label>
                </div>
              </fieldset>

              <label className="cs-alumni-consent">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(event) => set("consent", event.target.checked)}
                />
                <span>
                  I allow the PSU Registrar to check these details against school
                  records to verify my alumni status (Data Privacy Act of 2012).
                </span>
              </label>

              {error && (
                <div className="cs-alumni-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="cs-alumni-submit" disabled={busy}>
                {busy ? "Sending…" : "Send to Registrar"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
