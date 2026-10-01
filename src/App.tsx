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

type Account = {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  firebaseUid?: string;
  student_id?: string;
};

function App() {
  const [account, setAccount] = useState<Account | null>(null);
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

    // Check account status
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

    // Add the Firebase UID to the account
    // used by the React application.
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

  // Login screen
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

        {error && (
          <p>{error}</p>
        )}
      </div>
    );
  }

  // Dashboard
  return (
    <div>
      <h1>CampuServe</h1>

      <hr />

      {account.role === "student" && (
        <div>
          <h2>Student Dashboard</h2>
          <p>
            Welcome to the CampuServe
            student dashboard.
          </p>

          <button>
            Request a Document
          </button>

          <button>
            Reserve an Item
          </button>

          <button>
            View Transactions
          </button>
        </div>
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

      {account.role === "general_office" && (
        <div>
          <h2>Supply Staff Dashboard</h2>

          <button>
            Manage Item Reservations
          </button>

          <button>
            Manage Inventory
          </button>

          <button>
            View Claiming Schedule
          </button>
        </div>
      )}

      {account.role === "admin" && (
  <AdminDashboard account={account} />
)}

      <br />

      <button onClick={handleLogout}>
        Log Out
      </button>
    </div>
  );
}

export default App;