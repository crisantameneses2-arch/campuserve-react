import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

/**
 * Signs out and returns to the login screen.
 *
 * The logged-in account lives in App's React state, and App's
 * onAuthStateChanged listener is currently commented out, so signing out of
 * Firebase alone would leave the dashboard on screen. Reloading at the root
 * clears that state and shows the login page.
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    // Even if Firebase sign-out fails (e.g. offline), still leave the dashboard.
    console.warn("Sign-out failed:", error);
  }

  window.location.replace("/");
}
