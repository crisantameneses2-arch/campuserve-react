import "./App.css";

import { useState } from "react";
import {
  signInWithPopup,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
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
};

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      // Open Google sign-in
      const result = await signInWithPopup(
        auth,
        googleProvider
      );

      // Get the signed-in Google user
      const user = result.user;

      console.log("Logged in user:", user);
      console.log("Firebase UID:", user.uid);

      // Look for the user's CampuServe account
      const accountRef = doc(
        db,
        "accounts",
        user.uid
      );

      const accountSnapshot = await getDoc(accountRef);

      if (!accountSnapshot.exists()) {
        setError(
          "This Google account is not registered in CampuServe."
        );

        await signOut(auth);
        return;
      }

      // Get CampuServe account information
      const accountData =
        accountSnapshot.data() as Account;

      // Check account status
      if (accountData.status !== "active") {
        setError(
          "Your CampuServe account is not active."
        );

        await signOut(auth);
        return;
      }

      // Login successful
      setAccount(accountData);

    } catch (error) {
      console.error("Google login error:", error);

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

      <h2>
        Welcome,{" "}
        {account.name || account.email}!
      </h2>

      <p>
        <strong>Email:</strong>{" "}
        {account.email}
      </p>

      <p>
        <strong>Role:</strong>{" "}
        {account.role}
      </p>

      <p>
        <strong>Status:</strong>{" "}
        {account.status}
      </p>

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
  <AdminDashboard />
)}

      <br />

      <button onClick={handleLogout}>
        Log Out
      </button>
    </div>
  );
}

export default App;