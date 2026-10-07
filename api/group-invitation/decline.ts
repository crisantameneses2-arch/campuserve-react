import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing FIREBASE_PRIVATE_KEY");
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  return getFirestore();
}

function htmlPage(
  title: string,
  message: string,
  success = false
) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>${title}</title>

  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f7fb;
      font-family: Arial, sans-serif;
    }

    .card {
      width: min(90%, 460px);
      background: white;
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }

    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      background: ${success ? "#fee2e2" : "#f3f4f6"};
    }

    h1 {
      margin: 0 0 12px;
      font-size: 24px;
      color: #1f2937;
    }

    p {
      margin: 0;
      color: #6b7280;
      line-height: 1.6;
    }
  </style>
</head>

<body>
  <div class="card">
    <div class="icon">
      ${success ? "✕" : "!"}
    </div>

    <h1>${title}</h1>

    <p>${message}</p>
  </div>
</body>
</html>
`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).send(
      htmlPage(
        "Method Not Allowed",
        "This invitation link can only be opened through the email invitation."
      )
    );
  }

  try {
    const token =
      typeof req.query.token === "string"
        ? req.query.token
        : "";

    if (!token) {
      return res.status(400).send(
        htmlPage(
          "Invalid Invitation",
          "This invitation link is missing its invitation token."
        )
      );
    }

    // Hash the raw token from the email.
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const db = getFirebaseAdmin();

    // Find the member using the hashed token.
    const snapshot = await db
      .collection("group_request_members")
      .where("invitation_token_hash", "==", tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).send(
        htmlPage(
          "Invitation Not Found",
          "This invitation is invalid, expired, or has already been replaced."
        )
      );
    }

    const memberDoc = snapshot.docs[0];
    const member = memberDoc.data();

    // Check expiration.
    const tokenExpiresAt = member.token_expires_at;

    if (!tokenExpiresAt) {
      return res.status(400).send(
        htmlPage(
          "Invalid Invitation",
          "This invitation does not have a valid expiration date."
        )
      );
    }

    const expirationDate =
      typeof tokenExpiresAt.toDate === "function"
        ? tokenExpiresAt.toDate()
        : new Date(tokenExpiresAt);

    if (expirationDate.getTime() < Date.now()) {
      return res.status(410).send(
        htmlPage(
          "Invitation Expired",
          "This group request invitation has expired. Please ask the request owner to resend the invitation."
        )
      );
    }

    // Do not allow a second response.
    if (member.invitation_status === "DECLINED") {
      return res.status(200).send(
        htmlPage(
          "Invitation Declined",
          "You have already declined this group request invitation.",
          true
        )
      );
    }

    if (member.invitation_status === "ACCEPTED") {
      return res.status(200).send(
        htmlPage(
          "Invitation Already Accepted",
          "You have already accepted this group request invitation."
        )
      );
    }

    if (member.invitation_status !== "PENDING") {
      return res.status(400).send(
        htmlPage(
          "Invalid Invitation",
          "This invitation is no longer available."
        )
      );
    }

    // Decline the invitation.
    await memberDoc.ref.update({
      invitation_status: "DECLINED",
      responded_at: new Date(),
    });

    return res.status(200).send(
      htmlPage(
        "Invitation Declined",
        "You have declined this group request invitation. The request owner will be notified in CampuServe.",
        true
      )
    );
  } catch (error) {
    console.error("Decline invitation error:", error);

    return res.status(500).send(
      htmlPage(
        "Something Went Wrong",
        "We could not process your invitation response. Please try again later."
      )
    );
  }
}