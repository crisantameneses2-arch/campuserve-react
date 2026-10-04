import "./seedInventory";



import { Navigate, Route, Routes } from "react-router-dom";
import ClaimStub from "./pages/student/ClaimStub";
import DocumentRequestList from "./pages/student/DocumentRequestList";

import "./App.css";

import { useState } from "react";

import {
  signInWithPopup,
  signOut,
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
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const result = await signInWithPopup(
        auth,
        googleProvider
      );

      const user = result.user;

      console.log("Logged in user:", user);
      console.log("Firebase UID:", user.uid);
      console.log("Google email:", user.email);

      if (!user.email) {
        setError(
          "Your Google account does not have an email address."
        );

        await signOut(auth);
        return;
      }

      const normalizedEmail =
        user.email.trim().toLowerCase();

      // Find the pre-registered account
      // using the Google email address.
      const accountsQuery = query(
        collection(db, "accounts"),
        where("email", "==", normalizedEmail)
      );

      const accountSnapshot =
        await getDocs(accountsQuery);

      if (accountSnapshot.empty) {
        setError(
          "This Google account is not registered in CampuServe."
        );

        await signOut(auth);
        return;
      }

      const accountDocument =
        accountSnapshot.docs[0];

      const accountData =
        accountDocument.data() as Account;

      // Check account status.
      if (accountData.status !== "active") {
        setError(
          "Your CampuServe account is not active."
        );

        await signOut(auth);
        return;
      }

      // Link the Firebase UID to the account.
      await updateDoc(
        doc(
          db,
          "accounts",
          accountDocument.id
        ),
        {
          firebaseUid: user.uid,
        }
      );

      // Save the account for the React application.
      setAccount({
        ...accountData,
        firebaseUid: user.uid,
      });
    } catch (error) {
      console.error(
        "Google login error:",
        error
      );

      setError(
        "Google login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAccount(null);
  };

  // --------------------------------------------------
  // LOGIN SCREEN
  // --------------------------------------------------

  if (!account) {
    return (
      <div>
        <h1>CampuServe</h1>

        <h2>Login</h2>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading
            ? "Signing in..."
            : "Sign in with Google"}
        </button>

        {error && <p>{error}</p>}
      </div>
    );
  }

  // --------------------------------------------------
  // AUTHENTICATED APPLICATION
  // --------------------------------------------------

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
            account.role === "student" ? (
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
    STUDENT DOCUMENT REQUESTS
------------------------------------------- */}
<Route
  path="/student/requests"
  element={
    account.role === "student" ? (
      <DocumentRequestList
        studentId={account.student_id || ""}
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
            STUDENT CLAIM STUB
        ------------------------------------------- */}
        <Route
          path="/student/requests/:requestId/claim"
          element={
            account.role === "student" ? (
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
            account.role === "admin" ? (
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
            account.role === "general_office" ? (
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
              {account.role === "student" && (
                <Navigate
                  to="/student"
                  replace
                />
              )}

              {account.role === "admin" && (
                <Navigate
                  to="/admin"
                  replace
                />
              )}
              {account.role === "general_office" && (
                  <Navigate
                      to="/general-office"
                      replace
                  />
              )}

      {account.role === "registrar" && (
        <div>
          <h2>Registrar Staff Dashboard</h2>

          <button>
            Manage Document Requests
          </button>

          <button>
            View Claiming Schedule
          </button>

          <button>
            Daily Preparation Summary
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

      <button onClick={handleLogout}>
        Log Out
      </button>
    </div>
  );
}

export default App;
