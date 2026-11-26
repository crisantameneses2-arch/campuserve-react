

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ClaimStub from "./pages/student/ClaimStub";
import DocumentRequestList from "./pages/student/DocumentRequestList";

import "./App.css";
import LoginBrandPanel from "./components/login/LoginBrandPanel";
import EyeIcon from "./components/login/EyeIcon";
import AlumniAccessForm from "./components/login/AlumniAccessForm";

import { useEffect, useState } from "react";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
 /*  onAuthStateChanged, */
  User,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
  googleProvider,
} from "../firebase";

import AdminDashboard from "./dashboards/AdminDashboard/AdminDashboard";
import StudentDashboard from "./dashboards/StudentDashboard/StudentDashboard";
import RegistrarDashboard from "./dashboards/RegistrarDashboard/RegistrarDashboard";
import GeneralOfficeDashboard from "./dashboards/GeneralOfficeDashboard/GeneralOfficeDashboard";
import CashierDashboard from "./dashboards/CashierDashboard/CashierDashboard";


/*
 * TESTING ONLY: shows the "open a dashboard without logging in" buttons
 * on the login page, on the live site too. Set to false (or
 * import.meta.env.DEV for local-only) before the final defense.
 */
const SHOW_TEST_LOGIN = true;

/* TESTING ONLY: roles shown in the login page's dashboard shortcuts. */
const TEST_ROLES: [string, string][] = [
  ["student", "Student"],
  ["alumni", "Alumni"],
  ["registrar", "Registrar"],
  ["cashier", "Cashier"],
  ["general_office", "General Office"],
  ["admin", "Admin"],
];

type Account = {
  email?: string;
  name?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  suffix?: string;
  role?: string;
  status?: string;
  firebaseUid?: string;

  // Common information
  campus?: string;
  contactNumber?: string;

  // Student and alumni information
  student_id?: string;
  college?: string;
  program?: string;
  yearLevel?: string;
  section?: string;
  semester?: string;

  // Alumni-only information
  yearGraduated?: string;

  // Employee information
  employeeId?: string;
  department?: string;
  position?: string;
};

function App() {
  const [account, setAccount] =
    useState<Account | null>(null);

  const [authChecking/* , setAuthChecking */] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Show/hide login password
  const [showPassword, setShowPassword] =
    useState(false);

  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  const [resetEmail, setResetEmail] =
    useState("");

  const [showSetPassword, setShowSetPassword] =
    useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  // Show/hide Create Password
  const [showNewPassword, setShowNewPassword] =
    useState(false);

  // Show/hide Confirm Password
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [pendingGoogleUser, setPendingGoogleUser] =
    useState<User | null>(null);

  const [pendingGoogleAccount, setPendingGoogleAccount] =
    useState<{
      documentId: string;
      accountData: Account;
    } | null>(null);

  // ==================================================
  // FIND CAMPUSERVE ACCOUNT
  // ==================================================

  const findAccountByEmail = async (
    userEmail: string
  ) => {
    const normalizedEmail =
      userEmail.trim().toLowerCase();

    const accountsQuery = query(
      collection(db, "accounts"),
      where(
        "email",
        "==",
        normalizedEmail
      )
    );

    const accountSnapshot =
      await getDocs(accountsQuery);

    if (accountSnapshot.empty) {
      return null;
    }

    const accountDocument =
      accountSnapshot.docs[0];

    const accountData =
      accountDocument.data() as Account;

    return {
      documentId:
        accountDocument.id,
      accountData,
    };
  };
  // ==================================================
  // TESTING ONLY: open a dashboard without logging in
  // Shown while SHOW_TEST_LOGIN is true, including on the deployed site
  // (for phone testing): anyone with the link can open any dashboard. Lists every active account in Firestore, grouped by
  // role; clicking one opens that account's dashboard.
  // Remove before the final defense.
  // ==================================================

  const [testAccounts, setTestAccounts] = useState<Account[]>([]);
  const [testAccountsLoading, setTestAccountsLoading] = useState(
    SHOW_TEST_LOGIN
  );

  useEffect(() => {
    if (!SHOW_TEST_LOGIN) return;

    let active = true;

    getDocs(
      query(collection(db, "accounts"), where("status", "==", "active"))
    )
      .then((snapshot) => {
        if (!active) return;

        setTestAccounts(
          snapshot.docs
            .map((item) => item.data() as Account)
            .sort((x, y) =>
              String(x.name || x.email || "").localeCompare(
                String(y.name || y.email || "")
              )
            )
        );
      })
      .catch((testError) =>
        console.error("Could not load test accounts:", testError)
      )
      .finally(() => {
        if (active) setTestAccountsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleTestLogin = (testAccount: Account) => {
    setError("");
    setMessage("");
    setAccount(testAccount);
  };

  // ==================================================
  // RESTORE LOGGED-IN ACCOUNT WHEN APP LOADS
  // ==================================================
  //uncomment udring final defense>
  /* useEffect(() => {
    let firstAuthCheck = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {

        // Only handle the initial Firebase session check.
        // Login handlers already handle new logins.
        if (!firstAuthCheck) return;

        firstAuthCheck = false;

        try {
          if (!user) {
            setAccount(null);
            return;
          }

          // Google-only accounts must complete password setup
          // before accessing the dashboard.
          const hasPasswordProvider =
            user.providerData.some(
              (provider) =>
                provider.providerId === "password"
            );

          if (!hasPasswordProvider) {
            await signOut(auth);
            setAccount(null);
            return;
          }

          // Find the CampuServe account using Firebase UID.
          const accountQuery = query(
            collection(db, "accounts"),
            where("firebaseUid", "==", user.uid)
          );

          const accountSnapshot =
            await getDocs(accountQuery);

          let restoredAccount: Account | null = null;

          if (!accountSnapshot.empty) {
            restoredAccount =
              accountSnapshot.docs[0].data() as Account;
          } else if (user.email) {
            // Fallback for accounts that do not yet have
            // their Firebase UID saved in Firestore.
            const accountResult =
              await findAccountByEmail(user.email);

            if (accountResult) {
              restoredAccount =
                accountResult.accountData;
            }
          }

          // Check whether the account exists and is active.
          if (
            !restoredAccount ||
            restoredAccount.status !== "active"
          ) {
            await signOut(auth);
            setAccount(null);
            return;
          }

          // Restore the logged-in account in React.
          setAccount({
            ...restoredAccount,
            firebaseUid: user.uid,
          });

        } catch (error) {
          console.error(
            "Session restoration error:",
            error
          );

          setAccount(null);

        } finally {
          setAuthChecking(false);
        }
      }
    );

    return () => unsubscribe();

  }, []); */

  // ==================================================
  // EMAIL + PASSWORD LOGIN
  // ==================================================

  const handleEmailLogin = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!email.trim()) {
        setError(
          "Please enter your email address."
        );

        return;
      }

      if (!password) {
        setError(
          "Please enter your password."
        );

        return;
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      // ----------------------------------------------
      // Check CampuServe account first
      // ----------------------------------------------

      const accountResult =
        await findAccountByEmail(
          normalizedEmail
        );

      if (!accountResult) {
        setError(
          "This email is not registered in CampuServe."
        );

        return;
      }

      const {
        documentId,
        accountData,
      } = accountResult;

      // ----------------------------------------------
      // Check account status
      // ----------------------------------------------

      if (
        accountData.status !==
        "active"
      ) {
        if (
          accountData.role ===
          "alumni"
        ) {
          setError(
            "Your alumni account is still awaiting approval."
          );
        } else {
          setError(
            "Your CampuServe account is not active."
          );
        }

        return;
      }

      // ----------------------------------------------
      // Firebase Email/Password login
      // ----------------------------------------------

      const result =
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const user =
        result.user;

      console.log(
        "Email login user:",
        user
      );

      console.log(
        "Firebase UID:",
        user.uid
      );

      // ----------------------------------------------
      // Save Firebase UID to Firestore account
      // ----------------------------------------------

      await updateDoc(
        doc(
          db,
          "accounts",
          documentId
        ),
        {
          firebaseUid:
            user.uid,
        }
      );

      // ----------------------------------------------
      // Save account in React
      // ----------------------------------------------

      setAccount({
        ...accountData,
        firebaseUid:
          user.uid,
      });

      setEmail("");
      setPassword("");

    } catch (error: any) {
      console.error(
        "Email login error:",
        error
      );

      setError(
        `Login failed: ${error?.code ||
        "unknown-error"
        }`
      );

    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // GOOGLE LOGIN
  // ==================================================

  const handleGoogleLogin = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const result =
        await signInWithPopup(
          auth,
          googleProvider
        );

      const user =
        result.user;

      console.log(
        "Logged in user:",
        user
      );

      console.log(
        "Firebase UID:",
        user.uid
      );

      console.log(
        "Google email:",
        user.email
      );

      if (!user.email) {
        setError(
          "Your Google account does not have an email address."
        );

        await signOut(auth);

        return;
      }

      const normalizedEmail =
        user.email
          .trim()
          .toLowerCase();

      // ----------------------------------------------
      // Find pre-registered CampuServe account
      // ----------------------------------------------

      const accountResult =
        await findAccountByEmail(
          normalizedEmail
        );

      if (!accountResult) {
        setError(
          "This Google account is not registered in CampuServe."
        );

        await signOut(auth);

        return;
      }

      const {
        documentId,
        accountData,
      } = accountResult;

      // ----------------------------------------------
      // Check account status
      // ----------------------------------------------

      if (
        accountData.status !==
        "active"
      ) {
        if (
          accountData.role ===
          "alumni"
        ) {
          setError(
            "Your alumni account is still awaiting approval."
          );
        } else {
          setError(
            "Your CampuServe account is not active."
          );
        }

        await signOut(auth);

        return;
      }

      // ----------------------------------------------
      // Check whether this Firebase account already
      // has an Email/Password provider
      // ----------------------------------------------

      const hasPasswordProvider =
        user.providerData.some(
          (provider) =>
            provider.providerId ===
            "password"
        );

      // ----------------------------------------------
      // If there is NO password yet,
      // ask the user to create one.
      // ----------------------------------------------

      if (!hasPasswordProvider) {
        setPendingGoogleUser(user);

        setPendingGoogleAccount({
          documentId,
          accountData,
        });

        setShowSetPassword(true);

        return;
      }

      // ----------------------------------------------
      // Account already has Google + Password
      // ----------------------------------------------

      await updateDoc(
        doc(
          db,
          "accounts",
          documentId
        ),
        {
          firebaseUid:
            user.uid,
        }
      );

      // ----------------------------------------------
      // Save account in React
      // ----------------------------------------------

      setAccount({
        ...accountData,
        firebaseUid:
          user.uid,
      });

    } catch (error: any) {
      console.error(
        "Google login error:",
        error
      );

      setError(
        `Google login failed: ${error?.code ||
        "unknown-error"
        }`
      );

    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // SET UP CAMPUSERVE PASSWORD
  // ==================================================

  const handleSetPassword = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!pendingGoogleUser) {
        setError(
          "Your Google login session could not be found. Please try again."
        );

        return;
      }

      if (!pendingGoogleAccount) {
        setError(
          "Your CampuServe account information could not be found."
        );

        return;
      }

      if (!newPassword) {
        setError(
          "Please enter a password."
        );

        return;
      }

      if (!confirmPassword) {
        setError(
          "Please confirm your password."
        );

        return;
      }

      if (newPassword.length < 6) {
        setError(
          "Password must be at least 6 characters."
        );

        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        setError(
          "Passwords do not match."
        );

        return;
      }

      // Create Email/Password credential
      const credential =
        EmailAuthProvider.credential(
          pendingGoogleUser.email!,
          newPassword
        );

      // Link password to the existing Google account
      await linkWithCredential(
        pendingGoogleUser,
        credential
      );

      // Save Firebase UID to Firestore
      await updateDoc(
        doc(
          db,
          "accounts",
          pendingGoogleAccount.documentId
        ),
        {
          firebaseUid:
            pendingGoogleUser.uid,
        }
      );

      // Save account in React
      setAccount({
        ...pendingGoogleAccount.accountData,
        firebaseUid:
          pendingGoogleUser.uid,
      });

      // Clear password setup
      setNewPassword("");
      setConfirmPassword("");

      setShowNewPassword(false);
      setShowConfirmPassword(false);

      setPendingGoogleUser(null);
      setPendingGoogleAccount(null);
      setShowSetPassword(false);

    } catch (error: any) {
      console.error(
        "Set password error:",
        error
      );

      setError(
        `Password setup failed: ${error?.code ||
        "unknown-error"
        }`
      );

    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // FORGOT PASSWORD
  // ==================================================

  const handleForgotPassword =
    async () => {
      setError("");
      setMessage("");
      setLoading(true);

      try {
        if (!resetEmail.trim()) {
          setError(
            "Please enter your registered email address."
          );

          return;
        }

        const normalizedEmail =
          resetEmail
            .trim()
            .toLowerCase();

        // ----------------------------------------------
        // Check whether the email exists
        // ----------------------------------------------

        const accountResult =
          await findAccountByEmail(
            normalizedEmail
          );

        if (!accountResult) {
          setError(
            "No CampuServe account was found with this email."
          );

          return;
        }

        const {
          accountData,
        } = accountResult;

        // ----------------------------------------------
        // Check account status
        // ----------------------------------------------

        if (
          accountData.status !==
          "active"
        ) {
          if (
            accountData.role ===
            "alumni"
          ) {
            setError(
              "Your alumni account has not been approved yet."
            );
          } else {
            setError(
              "Your CampuServe account is not active."
            );
          }

          return;
        }

        // ----------------------------------------------
        // Send password reset email
        // ----------------------------------------------

        await sendPasswordResetEmail(
          auth,
          normalizedEmail
        );

        setMessage(
          "Password reset email sent! Please check your Gmail inbox and follow the instructions to create a new password."
        );

        setResetEmail("");

      } catch (error) {
        console.error(
          "Password reset error:",
          error
        );

        setError(
          "Unable to send the password reset email. Please check your email and try again."
        );

      } finally {
        setLoading(false);
      }
    };

  // ==================================================
  // LOGOUT
  // ==================================================

  //const handleLogout = async () => {
  //   await signOut(auth);

  //   setAccount(null);

  // setEmail("");
  //  setPassword("");
  //  setError("");
  //  setMessage("");
  //  };

  // ==================================================
  // LOGIN SCREEN
  // ==================================================

  // ==================================================
  // WAIT FOR FIREBASE SESSION RESTORATION
  // ==================================================

  if (authChecking) {
    return (
      <div className="campuserve-login-page cs-owl-login cs-owl-login--loading">
        <div className="campuserve-login-card">
          <h2>CampuServe</h2>
          <p>Restoring your account session...</p>
        </div>
      </div>
    );
  }

  // ==================================================
  // LOGIN SCREEN
  // ==================================================

  if (!account) {
    // ----------------------------------------------
    // SET UP PASSWORD SCREEN
    // ----------------------------------------------

    if (showSetPassword) {
      return (
        <div className="campuserve-login-page cs-owl-login">

          <LoginBrandPanel />


          <div className="campuserve-login-area">

            <div className="campuserve-login-card">

              <div className="campuserve-login-heading">

                <h2>
                  Create your password
                </h2>

                <p>
                  Your Google account has been
                  verified. Create a CampuServe
                  password so you can also sign
                  in with your email.
                </p>

              </div>


              {pendingGoogleUser?.email && (
                <div className="campuserve-info-box">

                  Verified Google account

                  <div className="campuserve-email-badge">
                    {pendingGoogleUser.email}
                  </div>

                </div>
              )}


              {/* NEW PASSWORD */}

              <div className="campuserve-form-group">

                <label>
                  CampuServe password
                </label>

                <div className="campuserve-input-wrapper">

                  <input
                    className="campuserve-input campuserve-password-input"
                    type={
                      showNewPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Create a password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(
                        event.target.value
                      )
                    }
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="campuserve-password-toggle"
                    onClick={() =>
                      setShowNewPassword(
                        !showNewPassword
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showNewPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showNewPassword
                      ? "🙈"
                      : "👁"}
                  </button>

                </div>

                <div className="campuserve-password-requirement">
                  At least 6 characters
                </div>

              </div>


              {/* CONFIRM PASSWORD */}

              <div className="campuserve-form-group">

                <label>
                  Confirm password
                </label>

                <div className="campuserve-input-wrapper">

                  <input
                    className="campuserve-input campuserve-password-input"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="campuserve-password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword
                      ? "🙈"
                      : "👁"}
                  </button>

                </div>

              </div>


              {/* CREATE PASSWORD */}

              <button
                className="campuserve-primary-button"
                onClick={handleSetPassword}
                disabled={loading}
              >
                {loading
                  ? "Creating password..."
                  : "Create password"}
              </button>


              {/* CANCEL */}

              <button
                className="campuserve-secondary-button"
                onClick={async () => {

                  await signOut(auth);

                  setShowSetPassword(false);
                  setNewPassword("");
                  setConfirmPassword("");

                  setShowNewPassword(false);
                  setShowConfirmPassword(false);

                  setPendingGoogleUser(null);
                  setPendingGoogleAccount(null);

                  setError("");
                  setMessage("");

                }}
                disabled={loading}
              >
                Cancel
              </button>


              {error && (
                <div className="campuserve-error">
                  {error}
                </div>
              )}

            </div>

          </div>

        </div>
      );
    }

    // ----------------------------------------------
    // FORGOT PASSWORD SCREEN
    // ----------------------------------------------

    if (showForgotPassword) {
      return (
        <div className="campuserve-login-page cs-owl-login">

          <LoginBrandPanel />


          <div className="campuserve-login-area">

            <div className="campuserve-login-card">

              <div className="campuserve-login-heading">

                <h2>
                  Reset your password
                </h2>

                <p>
                  Enter your registered email
                  address and we'll send you a
                  password reset link.
                </p>

              </div>


              <div className="campuserve-form-group">

                <label>
                  Email address
                </label>

                <input
                  className="campuserve-input"
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(event) =>
                    setResetEmail(
                      event.target.value
                    )
                  }
                  disabled={loading}
                />

              </div>


              <button
                className="campuserve-primary-button"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                {loading
                  ? "Sending..."
                  : "Send reset email"}
              </button>


              <button
                className="campuserve-secondary-button"
                onClick={() => {

                  setShowForgotPassword(false);

                  setResetEmail("");
                  setError("");
                  setMessage("");

                }}
                disabled={loading}
              >
                Back to login
              </button>


              {error && (
                <div className="campuserve-error">
                  {error}
                </div>
              )}


              {message && (
                <div className="campuserve-success">
                  {message}
                </div>
              )}

            </div>

          </div>

        </div>
      );
    }

    // ----------------------------------------------
    // NORMAL LOGIN SCREEN
    // ----------------------------------------------

    return (
      <div className="campuserve-login-page cs-owl-login">

        {/* ============================================
        UNIVERSITY BRANDING
    ============================================ */}

        <LoginBrandPanel />


        {/* ============================================
        LOGIN AREA
    ============================================ */}

        <div className="campuserve-login-area">

          <div className="campuserve-login-card">

            <div className="campuserve-login-heading">

              <h2>
                Welcome back
              </h2>

              <p>
                Sign in to your CampuServe account
                to continue.
              </p>

            </div>


            {/* EMAIL */}

            <div className="campuserve-form-group">

              <label>
                Email address
              </label>

              <input
                className="campuserve-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                disabled={loading}
              />

            </div>


            {/* PASSWORD */}

            <div className="campuserve-form-group">

              <label>
                Password
              </label>

              <div className="campuserve-input-wrapper">

                <input
                  className="campuserve-input campuserve-password-input"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  disabled={loading}
                />

                <button
                  type="button"
                  className="campuserve-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  <EyeIcon hidden={showPassword} />
                </button>

              </div>

            </div>


            {/* FORGOT PASSWORD */}

            <div className="campuserve-forgot-row">

              <button
                type="button"
                className="campuserve-link-button"
                onClick={() => {

                  setShowForgotPassword(true);

                  setError("");
                  setMessage("");

                }}
                disabled={loading}
              >
                Forgot password?
              </button>

            </div>


            {/* LOGIN */}

            <button
              className="campuserve-primary-button"
              onClick={handleEmailLogin}
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>


            {/* DIVIDER */}

            <div className="campuserve-divider">

              <span>or</span>

            </div>


            {/* GOOGLE */}

            <button
              className="campuserve-google-button"
              onClick={handleGoogleLogin}
              disabled={loading}
            >

              <span className="campuserve-google-icon">
                G
              </span>

              {loading
                ? "Signing in..."
                : "Continue with Google"}

            </button>


            {/* ERROR */}

            {error && (
              <div className="campuserve-error">
                {error}
              </div>
            )}


            {/* SUCCESS */}

            {message && (
              <div className="campuserve-success">
                {message}
              </div>
            )}


            {/* ALUMNI */}

            <AlumniAccessForm />


            {/* TESTING ONLY: dev server shortcuts, hidden on the live site */}

            {SHOW_TEST_LOGIN && (
              <div className="campuserve-dev-access">
                <span>TESTING ONLY · open a dashboard without logging in</span>

                {testAccountsLoading ? (
                  <p className="campuserve-dev-access__empty">Loading accounts…</p>
                ) : (
                  TEST_ROLES.map(([role, label]) => {
                    const roleAccounts = testAccounts.filter(
                      (item) => item.role === role
                    );

                    return (
                      <div className="campuserve-dev-access__group" key={role}>
                        <strong>
                          {label} <small>({roleAccounts.length})</small>
                        </strong>

                        {roleAccounts.length === 0 ? (
                          <p className="campuserve-dev-access__empty">
                            No active {label.toLowerCase()} accounts
                          </p>
                        ) : (
                          <div className="campuserve-dev-access__buttons">
                            {roleAccounts.map((item, index) => (
                              <button
                                key={item.email || item.student_id || index}
                                type="button"
                                onClick={() => handleTestLogin(item)}
                                title={item.email}
                              >
                                <b>
                                  {item.name ||
                                    [item.firstName, item.lastName]
                                      .filter(Boolean)
                                      .join(" ") ||
                                    item.email ||
                                    "Unnamed account"}
                                </b>
                                <small>{item.student_id || item.email}</small>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>

        </div>

      </div>
    );
  }

  // ==================================================
  // AUTHENTICATED APPLICATION
  // ==================================================

  return (
    <div>
      {/* The student dashboard has its own branded sidebar and top bar,
          so this generic heading is only shown for the other roles. */}
      {account.role !== "student" &&
        account.role !== "alumni" && (
          <>
            <h1>CampuServe</h1>

            <hr />
          </>
        )}

      <Routes>

        {/* -------------------------------------------
            STUDENT DASHBOARD
        ------------------------------------------- */}

        <Route
          path="/student"
          element={
            account.role ===
              "student" ||
              account.role ===
              "alumni" ? (
              <StudentDashboard
                account={account}
              />
            ) : (
              <Navigate
                to="/"
                replace
              />
            )
          }
        />

        {/* -------------------------------------------
            STUDENT / ALUMNI DOCUMENT REQUESTS
        ------------------------------------------- */}

        <Route
          path="/student/requests"
          element={
            account.role ===
              "student" ||
              account.role ===
              "alumni" ? (
              <DocumentRequestList
                studentId={
                  account.student_id ||
                  ""
                }
              />
            ) : (
              <Navigate
                to="/student"
                replace
              />
            )
          }
        />

        {/* -------------------------------------------
            STUDENT / ALUMNI CLAIM STUB
        ------------------------------------------- */}

        <Route
          path="/student/requests/:requestId/claim"
          element={
            account.role ===
              "student" ||
              account.role ===
              "alumni" ? (
              <ClaimStub />
            ) : (
              <Navigate
                to="/student"
                replace
              />
            )
          }
        />

        {/* -------------------------------------------
            ADMIN DASHBOARD
        ------------------------------------------- */}

        <Route
          path="/admin"
          element={
            account.role ===
              "admin" ? (
              <AdminDashboard
                account={account}
              />
            ) : (
              <Navigate
                to="/"
                replace
              />
            )
          }
        />

        {/* -------------------------------------------
            GENERAL OFFICE DASHBOARD
        ------------------------------------------- */}

        <Route
          path="/general-office"
          element={
            account.role ===
              "general_office" ? (
              <GeneralOfficeDashboard
                account={account}
              />
            ) : (
              <Navigate
                to="/"
                replace
              />
            )
          }
        />

        {/* CASHIER DASHBOARD */}
        <Route
          path="/cashier"
          element={
            account.role === "cashier" ? (
              <CashierDashboard account={account} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* -------------------------------------------
            DEFAULT DASHBOARD
        ------------------------------------------- */}

        <Route
          path="/"
          element={
            <>
              {(account.role ===
                "student" ||
                account.role ===
                "alumni") && (
                  <Navigate
                    to="/student"
                    replace
                  />
                )}

              {account.role === "cashier" && (
                <Navigate to="/cashier" replace />
              )}

              {account.role ===
                "admin" && (
                  <Navigate
                    to="/admin"
                    replace
                  />
                )}

              {account.role ===
                "general_office" && (
                  <Navigate
                    to="/general-office"
                    replace
                  />
                )}

              {account.role === "registrar" && (
                <RegistrarDashboard account={account} />
              )}


            </>
          }
        />

        {/* -------------------------------------------
            UNKNOWN ROUTE
        ------------------------------------------- */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>


    </div>
  );
}

export default App;