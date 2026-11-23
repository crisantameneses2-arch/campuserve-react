import { useEffect } from "react";
import OwlMascot from "./OwlMascot";
import "./LoginTheme.css";

/*
 * Left-hand brand panel shared by every login screen
 * (sign in, forgot password, create password).
 *
 * Importing this component also loads LoginTheme.css. Every rule in that
 * file is scoped under `.cs-owl-login`, so it only affects the login
 * screens and never the dashboards.
 */

export default function LoginBrandPanel() {
  useLoginBodyClass();

  return (
    <aside
      className="campuserve-brand-panel"
      aria-label="CampuServe campus companion"
    >
      <div className="login-brand-glow" />

      <div className="campuserve-brand-content">
        <div className="login-brand-lockup">
          <span className="login-brand-emblem" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <path
                d="M20 3 35 12V28L20 37 5 28V12L20 3Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="m12 14 8-4 8 4v10l-8 5-8-5V14Z"
                fill="currentColor"
                opacity=".22"
              />
              <path
                d="M14 16.5 20 13l6 3.5V24l-6 3.5v-7.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </span>

          <span>
            <strong>
              campuserve<span className="login-brand-dot">.</span>
            </strong>
            <small>PSU LINGAYEN CAMPUS</small>
          </span>
        </div>

        <span className="login-brand-overline">
          <span /> ONE PLACE FOR CAMPUS LIFE
        </span>

        <h1>
          Make campus life
          <br />
          <em>a little lighter.</em>
        </h1>

        <p className="brand-tagline">
          Requests, reservations and everything in between—beautifully
          organized for your day.
        </p>

        <div className="login-owl-scene">
          <div className="login-owl-rings" />

          <OwlMascot />

          <div className="login-owl-bubble">
            <span className="login-owl-bubble__spark" />
            <strong>Your campus companion</strong>
            <small>Move your cursor or tap to say hello!</small>
          </div>
        </div>

        <div className="campuserve-university">
          <span className="login-university-marker" />

          <span>
            <strong>Pangasinan State University</strong>
            <small>
              Lingayen Campus · Integrated Document Request and Item
              Reservation System
            </small>
          </span>
        </div>
      </div>
    </aside>
  );
}

/*
 * index.css makes <body> a centered flex container, which would shrink the
 * full-width login layout. While a login screen is mounted we switch the
 * body to normal block flow; the class is removed again on unmount, so the
 * dashboards keep their current behaviour.
 */
export function useLoginBodyClass() {
  useEffect(() => {
    document.body.classList.add("cs-owl-login-body");

    return () => {
      document.body.classList.remove("cs-owl-login-body");
    };
  }, []);
}
