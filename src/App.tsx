import "./seedInventory";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ClaimStub from "./pages/student/ClaimStub";
import DocumentRequestList from "./pages/student/DocumentRequestList";

import "./App.css";

import { useState } from "react";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
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
import GeneralOfficeDashboard from "./dashboards/GeneralOfficeDashboard/GeneralOfficeDashboard";

type Account = {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  firebaseUid?: string;
  student_id?: string;
};

function App() {
  const [account, setAccount] =
    useState<Account | null>(null);

  const [error, setError] = useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  const [resetEmail, setResetEmail] =
    useState("");

  // ==================================================
  // GOOGLE PASSWORD SETUP STATES
  // ==================================================

  const [showSetPassword, setShowSetPassword] =
    useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

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
        `Login failed: ${
          error?.code ||
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
        `Google login failed: ${
          error?.code ||
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
          "The passwords do not match."
        );

        return;
      }

      if (!pendingGoogleUser.email) {
        setError(
          "Your Google account does not have an email address."
        );

        return;
      }

      // ----------------------------------------------
      // Create Email/Password credential
      // ----------------------------------------------

      const credential =
        EmailAuthProvider.credential(
          pendingGoogleUser.email,
          newPassword
        );

      // ----------------------------------------------
      // Link password to the SAME Firebase user
      // ----------------------------------------------

      await linkWithCredential(
        pendingGoogleUser,
        credential
      );

      // ----------------------------------------------
      // Save Firebase UID
      // ----------------------------------------------

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

      // ----------------------------------------------
      // Finish login
      // ----------------------------------------------

      setAccount({
        ...pendingGoogleAccount.accountData,
        firebaseUid:
          pendingGoogleUser.uid,
      });

      setShowSetPassword(false);

      setNewPassword("");
      setConfirmPassword("");

      setPendingGoogleUser(null);
      setPendingGoogleAccount(null);

      setMessage("");

    } catch (error: any) {
      console.error(
        "Set password error:",
        error
      );

      if (
        error?.code ===
        "auth/provider-already-linked"
      ) {
        setError(
          "This account already has a CampuServe password."
        );

      } else if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        setError(
          "This email is already being used by another Firebase account."
        );

      } else if (
        error?.code ===
        "auth/weak-password"
      ) {
        setError(
          "Password is too weak. Please use at least 6 characters."
        );

      } else {
        setError(
          `Unable to create password: ${
            error?.code ||
            "unknown-error"
          }`
        );
      }

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

  const handleLogout = async () => {
    await signOut(auth);

    setAccount(null);

    setEmail("");
    setPassword("");
    setError("");
    setMessage("");
  };

  // ==================================================
  // LOGIN SCREEN
  // ==================================================

  if (!account) {

    // ----------------------------------------------
    // SET UP PASSWORD SCREEN
    // ----------------------------------------------

    if (showSetPassword) {
      return (
        <div>
          <h1>CampuServe</h1>

          <h2>
            Create Your CampuServe Password
          </h2>

          <p>
            Your Google account has been
            verified. Please create a
            password so you can also log in
            using your email and password.
          </p>

          {pendingGoogleUser?.email && (
            <p>
              <strong>Email:</strong>{" "}
              {pendingGoogleUser.email}
            </p>
          )}

          <br />

          <div>
            <label>
              CampuServe Password
            </label>

            <br />

            <input
              type="password"
              placeholder="Create a password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value
                )
              }
              disabled={loading}
            />
          </div>

          <br />

          <div>
            <label>
              Confirm Password
            </label>

            <br />

            <input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              disabled={loading}
            />
          </div>

          <br />

          <p>
            Your password must be at least
            6 characters long.
          </p>

          <button
            onClick={
              handleSetPassword
            }
            disabled={loading}
          >
            {loading
              ? "Creating Password..."
              : "Create Password"}
          </button>

          <br />
          <br />

          <button
            onClick={async () => {
              await signOut(auth);

              setShowSetPassword(false);

              setNewPassword("");
              setConfirmPassword("");

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
            <p>
              {error}
            </p>
          )}
        </div>
      );
    }

    // ----------------------------------------------
    // FORGOT PASSWORD SCREEN
    // ----------------------------------------------

    if (showForgotPassword) {
      return (
        <div>
          <h1>CampuServe</h1>

          <h2>
            Forgot Password
          </h2>

          <p>
            Enter the email address
            registered with your
            CampuServe account.
          </p>

          <input
            type="email"
            placeholder="Email address"
            value={resetEmail}
            onChange={(event) =>
              setResetEmail(
                event.target.value
              )
            }
            disabled={loading}
          />

          <br />
          <br />

          <button
            onClick={
              handleForgotPassword
            }
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : "Send Password Reset Email"}
          </button>

          <br />
          <br />

          <button
            onClick={() => {
              setShowForgotPassword(
                false
              );

              setResetEmail("");
              setError("");
              setMessage("");
            }}
          >
            Back to Login
          </button>

          {error && (
            <p>
              {error}
            </p>
          )}

          {message && (
            <p>
              {message}
            </p>
          )}
        </div>
      );
    }

    // ----------------------------------------------
    // NORMAL LOGIN SCREEN
    // ----------------------------------------------

    return (
      <div>
        <h1>CampuServe</h1>

        <h2>Login</h2>

        <div>
          <label>
            Email
          </label>

          <br />

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            disabled={loading}
          />
        </div>

        <br />

        <div>
          <label>
            Password
          </label>

          <br />

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            disabled={loading}
          />
        </div>

        <br />

        <button
          onClick={
            handleEmailLogin
          }
          disabled={loading}
        >
          {loading
            ? "Signing in..."
            : "Login"}
        </button>

        <br />
        <br />

        <button
          onClick={() => {
            setShowForgotPassword(
              true
            );

            setError("");
            setMessage("");
          }}
          disabled={loading}
        >
          Forgot Password?
        </button>

        <br />
        <br />

        <p>OR</p>

        <button
          onClick={
            handleGoogleLogin
          }
          disabled={loading}
        >
          {loading
            ? "Signing in..."
            : "Continue with Google"}
        </button>

        {error && (
          <p>
            {error}
          </p>
        )}

        {message && (
          <p>
            {message}
          </p>
        )}

        <hr />

        <h3>Alumni</h3>

        <p>
          Alumni registration will be
          added here. Alumni accounts
          must be approved by the
          Registrar or Administrator
          before they can access
          CampuServe.
        </p>
      </div>
    );
  }

  // ==================================================
  // AUTHENTICATED APPLICATION
  // ==================================================

  return (
    <div>
      <h1>CampuServe</h1>

      <hr />

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

              {account.role ===
                "registrar" && (
                <div>
                  <h2>
                    Registrar Staff
                    Dashboard
                  </h2>

                  <button>
                    Manage Document
                    Requests
                  </button>

                  <button>
                    View Claiming
                    Schedule
                  </button>

                  <button>
                    Daily Preparation
                    Summary
                  </button>
                </div>
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

      <br />

      <button
        onClick={handleLogout}
      >
        Log Out
      </button>
    </div>
  );
}

export default App;