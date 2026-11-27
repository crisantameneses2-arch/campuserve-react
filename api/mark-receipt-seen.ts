import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/*
 * Marks a digital receipt as seen, so it stops popping up on the
 * student's other devices (StudentDashboard's closeReceipt).
 *
 * The browser may not be allowed to write to document_requests /
 * itemReservations itself, so the write happens here with admin rights.
 * The caller proves who they are with their Firebase ID token, and only
 * a record that belongs to them can be marked.
 *
 * POST { kind: "DOCUMENT" | "ITEM", id: "<Firestore doc id>" }
 * Authorization: Bearer <Firebase ID token>
 */

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) throw new Error("Missing FIREBASE_PRIVATE_KEY");

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

/* Same rule StudentDashboard uses to work out the student's ID. */
function studentIdOf(account: { student_id?: string; email?: string }) {
  return (
    account.student_id ||
    account.email?.split("@")[0].replace("dummytest", "") ||
    ""
  );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // The local dev server calls the deployed API from another origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const kind = body?.kind;
  const id = typeof body?.id === "string" ? body.id : "";

  if ((kind !== "DOCUMENT" && kind !== "ITEM") || !id || id.includes("/")) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token) return res.status(401).json({ error: "Not signed in" });

  try {
    const app = getAdminApp();
    const db = getFirestore(app);

    let uid: string;
    let email: string | undefined;

    try {
      const decoded = await getAuth(app).verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email;
    } catch {
      return res.status(401).json({ error: "Not signed in" });
    }

    // Who is this? Look up their account the way the app does.
    const accounts = await db
      .collection("accounts")
      .where("firebaseUid", "==", uid)
      .limit(1)
      .get();

    const account = accounts.empty
      ? { email }
      : (accounts.docs[0].data() as { student_id?: string; email?: string });

    const studentId = studentIdOf(account);

    if (!studentId) return res.status(403).json({ error: "Not allowed" });

    const ref = db
      .collection(kind === "DOCUMENT" ? "document_requests" : "itemReservations")
      .doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) return res.status(404).json({ error: "Not found" });

    const data = snapshot.data() || {};
    const owner = kind === "DOCUMENT" ? data.student_id : data.studentId;

    if (String(owner || "") !== studentId) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const field = kind === "DOCUMENT" ? "receipt_seen_at" : "receiptSeenAt";

    if (!data[field]) {
      await ref.update({ [field]: FieldValue.serverTimestamp() });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("mark-receipt-seen failed:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
