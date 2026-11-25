import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/*
 * Emails a student notification to the student's institutional email.
 *
 * The app calls this right after it creates a notification for one
 * student ("student:<studentId>" audience), sending only the
 * notification's id. Everything else is looked up here, so the endpoint
 * can't be used to send arbitrary emails:
 *
 *   - the title and message come from the notification itself
 *   - the recipient is the email on the student's account
 *   - nothing is sent if the student turned Email Notifications off
 *     (notification_preferences/{studentId}.email === false)
 *   - each notification is emailed at most once, and only while it is
 *     new (old notifications are never emailed later)
 *
 * The result is saved on the notification as email_status:
 *   sending | sent | failed | opted_out | no_email
 */

const MAX_AGE_MS = 15 * 60 * 1000;

function getDb() {
  if (getApps().length > 0) return getFirestore();

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing FIREBASE_PRIVATE_KEY");
  }

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  return getFirestore(app);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  const timestamp = value as { toMillis?: () => number };
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function emailHtml(options: {
  name: string;
  title: string;
  message: string;
  link: string | null;
}) {
  const name = escapeHtml(options.name);
  const title = escapeHtml(options.title);
  const message = escapeHtml(options.message);

  const button = options.link
    ? `
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${escapeHtml(options.link)}"
           style="display:inline-block;padding:13px 26px;background:#1e6896;color:#ffffff;
                  text-decoration:none;border-radius:999px;font-weight:bold;font-size:14px;">
          Open CampuServe
        </a>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:36px auto;background:#ffffff;border-radius:16px;
              overflow:hidden;border:1px solid #dce8ef;">
    <div style="padding:24px 28px;background:#173f60;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;">CampuServe</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">
        Pangasinan State University · Lingayen
      </p>
    </div>

    <div style="padding:30px 28px 24px;">
      <p style="margin:0 0 16px;color:#5b7286;font-size:14px;">Hi ${name},</p>

      <h2 style="margin:0 0 10px;color:#173f60;font-size:20px;">${title}</h2>

      <p style="margin:0;color:#34495e;font-size:15px;line-height:1.6;">${message}</p>

      ${button}
    </div>

    <div style="padding:16px 28px;background:#f7fafc;border-top:1px solid #e3edf3;
                text-align:center;">
      <p style="margin:0;color:#8a9cad;font-size:12px;line-height:1.5;">
        You're receiving this because Email Notifications are on in your
        CampuServe Account Settings. You can turn them off there anytime.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  /*
   * The app on localhost (npm run dev) calls this deployed function, so
   * cross-site calls are allowed. That is safe: the caller only names a
   * notification; the recipient and content are always looked up here.
   */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { notificationId } = req.body || {};

  if (typeof notificationId !== "string" || !notificationId) {
    return res.status(400).json({ error: "notificationId is required." });
  }

  try {
    const db = getDb();
    const notificationRef = db.collection("notifications").doc(notificationId);

    /*
     * 1. Claim the notification (at most one email per notification).
     */

    const claim = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(notificationRef);

      if (!snapshot.exists) return { ok: false as const, status: 404, reason: "not_found" };

      const data = snapshot.data() || {};
      const audience = String(data.audience || "");

      if (!audience.startsWith("student:")) {
        return { ok: false as const, status: 400, reason: "not_a_student_notification" };
      }

      if (data.email_status) {
        return { ok: false as const, status: 200, reason: "already_handled" };
      }

      const createdAt = toMillis(data.createdAt);

      if (!createdAt || Date.now() - createdAt > MAX_AGE_MS) {
        return { ok: false as const, status: 200, reason: "too_old" };
      }

      transaction.update(notificationRef, { email_status: "sending" });

      return {
        ok: true as const,
        studentId: audience.slice("student:".length),
        title: String(data.title || "CampuServe update"),
        message: String(data.message || ""),
      };
    });

    if (!claim.ok) {
      return res.status(claim.status).json({ sent: false, reason: claim.reason });
    }

    const finish = (email_status: string, extra: Record<string, unknown> = {}) =>
      notificationRef.update({
        email_status,
        email_updated_at: FieldValue.serverTimestamp(),
        ...extra,
      });

    /*
     * 2. Respect the student's Email Notifications setting.
     */

    const preferences = await db
      .collection("notification_preferences")
      .doc(claim.studentId)
      .get();

    if (preferences.exists && preferences.data()?.email === false) {
      await finish("opted_out");
      return res.status(200).json({ sent: false, reason: "opted_out" });
    }

    /*
     * 3. Find the student's institutional email.
     */

    const accounts = await db
      .collection("accounts")
      .where("student_id", "==", claim.studentId)
      .limit(1)
      .get();

    const account = accounts.empty ? null : accounts.docs[0].data();
    const to = typeof account?.email === "string" ? account.email.trim() : "";

    if (!to) {
      await finish("no_email");
      return res.status(200).json({ sent: false, reason: "no_email" });
    }

    /*
     * 4. Send it.
     */

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

    const resend = new Resend(resendApiKey);

    const from =
      process.env.RESEND_FROM_EMAIL || "CampuServe <onboarding@resend.dev>";

    const baseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");

    const result = await resend.emails.send({
      from,
      to,
      subject: `CampuServe — ${claim.title}`,
      text: `${claim.title}\n\n${claim.message}${baseUrl ? `\n\nOpen CampuServe: ${baseUrl}/student` : ""}`,
      html: emailHtml({
        name: String(account?.name || account?.full_name || "Student"),
        title: claim.title,
        message: claim.message,
        link: baseUrl ? `${baseUrl}/student` : null,
      }),
    });

    if (result.error) {
      console.error("Resend email error:", result.error);
      await finish("failed", { email_error: String(result.error.message || "") });
      return res.status(502).json({ sent: false, reason: "send_failed" });
    }

    await finish("sent", { email_id: result.data?.id || null });

    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error("Send notification email error:", error);

    return res.status(500).json({
      sent: false,
      error: error instanceof Error ? error.message : "Failed to send email.",
    });
  }
}
