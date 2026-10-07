import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { Resend } from "resend";
import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return {
      db: getFirestore(),
      auth: getAuth(),
    };
  }

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

  return {
    db: getFirestore(app),
    auth: getAuth(app),
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    /*
     * ---------------------------------------------------------
     * 1. CHECK FIREBASE AUTHENTICATION
     * ---------------------------------------------------------
     */

    const authorization =
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing Firebase authentication token.",
      });
    }

    const idToken = authorization.substring(7);

    const { db, auth } = getFirebaseAdmin();

    const decodedToken = await auth.verifyIdToken(idToken);

    const hostUid = decodedToken.uid;

    /*
     * ---------------------------------------------------------
     * 2. GET REQUEST DATA
     * ---------------------------------------------------------
     */

    const { requestId, memberId } = req.body || {};

    if (
      typeof requestId !== "string" ||
      typeof memberId !== "string"
    ) {
      return res.status(400).json({
        error: "requestId and memberId are required.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 3. FIND THE HOST ACCOUNT
     * ---------------------------------------------------------
     */

    const hostUser = await auth.getUser(hostUid);

    const hostEmail = hostUser.email;

    if (!hostEmail) {
      return res.status(403).json({
        error: "Authenticated account does not have an email address.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 4. FIND THE DOCUMENT REQUEST
     * ---------------------------------------------------------
     */

    const requestRef = db
      .collection("document_requests")
      .doc(requestId);

    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({
        error: "Document request not found.",
      });
    }

    const requestData = requestSnap.data();

    /*
     * Make sure the authenticated student owns this request.
     *
     * The request was created using student_id, so compare
     * against the Firebase account's email/student information
     * where available.
     */

    const accountsSnapshot = await db
      .collection("accounts")
      .where("email", "==", hostEmail)
      .limit(1)
      .get();

    if (accountsSnapshot.empty) {
      return res.status(403).json({
        error: "Host account could not be verified.",
      });
    }

    const hostAccount = accountsSnapshot.docs[0].data();

    if (
      requestData?.student_id &&
      hostAccount?.student_id &&
      requestData.student_id !== hostAccount.student_id
    ) {
      return res.status(403).json({
        error: "You are not the owner of this group request.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 5. FIND GROUP MEMBER
     * ---------------------------------------------------------
     */

    const memberRef = db
      .collection("group_request_members")
      .doc(memberId);

    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return res.status(404).json({
        error: "Group member invitation not found.",
      });
    }

    const memberData = memberSnap.data();

    if (memberData?.request_id !== requestId) {
      return res.status(403).json({
        error: "This invitation does not belong to this request.",
      });
    }

    /*
     * Only PENDING invitations can be sent.
     */

    if (memberData?.invitation_status !== "PENDING") {
      return res.status(400).json({
        error:
          "This invitation has already been accepted or declined.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 6. FIND INVITED STUDENT
     * ---------------------------------------------------------
     */

    const invitedStudentId = memberData?.student_id;

    if (!invitedStudentId) {
      return res.status(400).json({
        error: "Invited student ID is missing.",
      });
    }

    const invitedAccountSnapshot = await db
      .collection("accounts")
      .where("student_id", "==", invitedStudentId)
      .limit(1)
      .get();

    if (invitedAccountSnapshot.empty) {
      return res.status(404).json({
        error: "Invited student's account could not be found.",
      });
    }

    const invitedAccount =
      invitedAccountSnapshot.docs[0].data();

    const invitedEmail = invitedAccount?.email;

    if (!invitedEmail) {
      return res.status(400).json({
        error: "Invited student does not have an email address.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 7. CHECK RESEND LIMIT
     * ---------------------------------------------------------
     *
     * A pending invitation may only be resent after 1 minute.
     */

    const lastResendAt = memberData?.last_resend_at;

    if (lastResendAt) {
      const lastResendDate =
        typeof lastResendAt.toDate === "function"
          ? lastResendAt.toDate()
          : new Date(lastResendAt);

      const elapsed =
        Date.now() - lastResendDate.getTime();

      if (elapsed < 60_000) {
        const remainingSeconds = Math.ceil(
          (60_000 - elapsed) / 1000
        );

        return res.status(429).json({
          error: `Please wait ${remainingSeconds} seconds before resending this invitation.`,
          remainingSeconds,
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * 8. GENERATE SECURE INVITATION TOKEN
     * ---------------------------------------------------------
     *
     * The raw token goes ONLY into the email URL.
     *
     * Firestore receives only the SHA-256 hash.
     */

    const rawToken = crypto
      .randomBytes(32)
      .toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const tokenExpiresAt =
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    /*
     * ---------------------------------------------------------
     * 9. SAVE TOKEN
     * ---------------------------------------------------------
     */

    await memberRef.update({
      invitation_token_hash: tokenHash,
      token_expires_at: tokenExpiresAt,
      invitation_sent: false,
      last_resend_at: new Date(),
    });

    /*
     * ---------------------------------------------------------
     * 10. CREATE EMAIL LINKS
     * ---------------------------------------------------------
     */

    const baseUrl =
      process.env.APP_BASE_URL ||
      "http://localhost:5173";

    const cleanBaseUrl = baseUrl.replace(/\/$/, "");

    const acceptUrl =
      `${cleanBaseUrl}/api/group-invitation/accept` +
      `?token=${encodeURIComponent(rawToken)}`;

    const declineUrl =
      `${cleanBaseUrl}/api/group-invitation/decline` +
      `?token=${encodeURIComponent(rawToken)}`;

    /*
     * ---------------------------------------------------------
     * 11. REQUEST INFORMATION
     * ---------------------------------------------------------
     */

    const hostName =
      hostAccount?.name ||
      hostAccount?.full_name ||
      requestData?.student_id ||
      "A CampuServe student";

    const purpose =
      requestData?.purpose ||
      "document request";

    /*
     * ---------------------------------------------------------
     * 12. SEND EMAIL
     * ---------------------------------------------------------
     */

    const resendApiKey =
      process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      throw new Error(
        "Missing RESEND_API_KEY"
      );
    }

    const resend = new Resend(resendApiKey);

    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "CampuServe <onboarding@resend.dev>";

    const safeHostName = escapeHtml(hostName);
    const safePurpose = escapeHtml(purpose);
    const safeStudentId = escapeHtml(invitedStudentId);

    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: invitedEmail,
      subject:
        "CampuServe — Group Document Request Invitation",

      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background: #f5f7fb;
    font-family: Arial, Helvetica, sans-serif;
  "
>
  <div
    style="
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 25px rgba(0,0,0,0.08);
    "
  >

    <!-- HEADER -->

    <div
      style="
        padding: 28px 30px;
        background: #1d4ed8;
        color: #ffffff;
      "
    >
      <h1
        style="
          margin: 0;
          font-size: 24px;
        "
      >
        CampuServe
      </h1>

      <p
        style="
          margin: 8px 0 0;
          font-size: 14px;
          opacity: 0.9;
        "
      >
        Group Document Request
      </p>
    </div>

    <!-- CONTENT -->

    <div
      style="
        padding: 32px 30px;
      "
    >

      <h2
        style="
          margin: 0 0 18px;
          color: #111827;
          font-size: 22px;
        "
      >
        You have been invited to a group request
      </h2>

      <p
        style="
          color: #374151;
          font-size: 15px;
          line-height: 1.6;
        "
      >
        <strong>${safeHostName}</strong>
        has added you to a CampuServe group
        document request.
      </p>

      <div
        style="
          margin: 24px 0;
          padding: 18px;
          background: #f3f4f6;
          border-radius: 10px;
        "
      >

        <p
          style="
            margin: 0 0 8px;
            color: #6b7280;
            font-size: 13px;
          "
        >
          Request
        </p>

        <p
          style="
            margin: 0;
            color: #111827;
            font-weight: bold;
            font-size: 16px;
          "
        >
          ${safePurpose}
        </p>

        <p
          style="
            margin: 12px 0 0;
            color: #6b7280;
            font-size: 13px;
          "
        >
          Your Student ID:
          <strong>${safeStudentId}</strong>
        </p>

      </div>

      <p
        style="
          color: #374151;
          font-size: 15px;
          line-height: 1.6;
        "
      >
        Please choose whether you want to join
        this group request.
      </p>

      <!-- ACCEPT BUTTON -->

      <div
        style="
          text-align: center;
          margin: 28px 0 14px;
        "
      >
        <a
          href="${acceptUrl}"
          style="
            display: inline-block;
            padding: 14px 28px;
            background: #2563eb;
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 15px;
          "
        >
          Accept Invitation
        </a>
      </div>

      <!-- DECLINE BUTTON -->

      <div
        style="
          text-align: center;
          margin: 0 0 28px;
        "
      >
        <a
          href="${declineUrl}"
          style="
            display: inline-block;
            padding: 12px 26px;
            background: #ffffff;
            color: #dc2626;
            text-decoration: none;
            border: 1px solid #dc2626;
            border-radius: 8px;
            font-weight: bold;
            font-size: 14px;
          "
        >
          Decline Invitation
        </a>
      </div>

      <p
        style="
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.5;
          text-align: center;
        "
      >
        This invitation expires in 7 days.
        If you did not expect this invitation,
        you can safely ignore this email.
      </p>

    </div>

    <!-- FOOTER -->

    <div
      style="
        padding: 18px 30px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        text-align: center;
      "
    >
      <p
        style="
          margin: 0;
          color: #9ca3af;
          font-size: 12px;
        "
      >
        CampuServe
      </p>
    </div>

  </div>
</body>
</html>
      `,
    });

    if (emailResult.error) {
      /*
       * Email failed, so remove the newly generated token.
       * This prevents an unusable invitation from remaining valid.
       */

      await memberRef.update({
        invitation_token_hash: null,
        token_expires_at: null,
        invitation_sent: false,
      });

      console.error(
        "Resend email error:",
        emailResult.error
      );

      return res.status(500).json({
        error:
          "The invitation email could not be sent.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 13. MARK INVITATION AS SENT
     * ---------------------------------------------------------
     */

    await memberRef.update({
      invitation_sent: true,
    });

    return res.status(200).json({
      success: true,
      message: "Group invitation sent successfully.",
    });
  } catch (error) {
    console.error(
      "Send group invitation error:",
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to send group invitation.",
    });
  }
}