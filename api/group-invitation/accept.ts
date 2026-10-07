import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getFirestore,
} from "firebase-admin/firestore";

import crypto from "crypto";

/* =========================================================
   FIREBASE ADMIN
========================================================= */

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:
        process.env.FIREBASE_PROJECT_ID,

      clientEmail:
        process.env.FIREBASE_CLIENT_EMAIL,

      privateKey:
        process.env.FIREBASE_PRIVATE_KEY?.replace(
          /\\n/g,
          "\n"
        ),
    }),
  });
}

const db =
  getFirestore();

/* =========================================================
   HASH INVITATION TOKEN
========================================================= */

function hashInvitationToken(
  token: string
): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/* =========================================================
   HTML RESPONSE
========================================================= */

function htmlResponse(
  res: VercelResponse,
  statusCode: number,
  title: string,
  message: string
) {
  return res
    .status(statusCode)
    .setHeader(
      "Content-Type",
      "text/html; charset=utf-8"
    )
    .send(`
      <!DOCTYPE html>

      <html>
        <head>
          <meta charset="UTF-8" />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <title>
            ${title}
          </title>
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
              max-width: 520px;
              margin: 80px auto;
              padding: 24px;
            "
          >

            <div
              style="
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                padding: 32px;
                text-align: center;
              "
            >

              <h1
                style="
                  color: #111827;
                  margin-top: 0;
                "
              >
                ${title}
              </h1>

              <p
                style="
                  color: #4b5563;
                  line-height: 1.6;
                  font-size: 16px;
                "
              >
                ${message}
              </p>

              <p
                style="
                  color: #9ca3af;
                  font-size: 13px;
                  margin-top: 28px;
                "
              >
                CampuServe
              </p>

            </div>

          </div>

        </body>
      </html>
    `);
}

/* =========================================================
   GET TOKEN
========================================================= */

function getToken(
  req: VercelRequest
): string | null {
  const token =
    req.query.token;

  if (
    typeof token !==
    "string"
  ) {
    return null;
  }

  const cleanToken =
    token.trim();

  if (!cleanToken) {
    return null;
  }

  return cleanToken;
}

/* =========================================================
   HANDLER
========================================================= */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  /* -------------------------------------------------------
     ONLY GET
  ------------------------------------------------------- */

  if (req.method !== "GET") {
    return htmlResponse(
      res,
      405,
      "Method Not Allowed",
      "This invitation link cannot be used with this request method."
    );
  }

  try {
    /* =====================================================
       1. GET TOKEN
    ===================================================== */

    const token =
      getToken(req);

    if (!token) {
      return htmlResponse(
        res,
        400,
        "Invalid Invitation",
        "This invitation link is missing its invitation token."
      );
    }

    /* =====================================================
       2. HASH TOKEN
    ===================================================== */

    const tokenHash =
      hashInvitationToken(
        token
      );

    /* =====================================================
       3. FIND INVITATION
    ===================================================== */

    const invitationQuery =
      await db
        .collection(
          "group_request_members"
        )
        .where(
          "invitation_token_hash",
          "==",
          tokenHash
        )
        .limit(1)
        .get();

    if (
      invitationQuery.empty
    ) {
      return htmlResponse(
        res,
        404,
        "Invitation Not Found",
        "This invitation is invalid or has already expired."
      );
    }

    const invitationDoc =
      invitationQuery.docs[0];

    const invitation =
      invitationDoc.data();

    /* =====================================================
       4. CHECK EXPIRATION
    ===================================================== */

    const tokenExpiresAt =
      invitation.token_expires_at;

    if (
      !tokenExpiresAt
    ) {
      return htmlResponse(
        res,
        400,
        "Invitation Expired",
        "This invitation does not have a valid expiration date."
      );
    }

    const expirationDate =
      tokenExpiresAt.toDate
        ? tokenExpiresAt.toDate()
        : new Date(
            tokenExpiresAt
          );

    if (
      expirationDate.getTime() <
      Date.now()
    ) {
      return htmlResponse(
        res,
        410,
        "Invitation Expired",
        "This invitation has expired. Please ask the group request host to send a new invitation."
      );
    }

    /* =====================================================
       5. CHECK STATUS
    ===================================================== */

    const currentStatus =
      String(
        invitation.invitation_status ??
          ""
      );

    if (
      currentStatus ===
      "ACCEPTED"
    ) {
      return htmlResponse(
        res,
        200,
        "Already Accepted",
        "You have already accepted this CampuServe group request."
      );
    }

    if (
      currentStatus ===
      "DECLINED"
    ) {
      return htmlResponse(
        res,
        200,
        "Invitation Declined",
        "This invitation has already been declined."
      );
    }

    if (
      currentStatus !==
      "PENDING"
    ) {
      return htmlResponse(
        res,
        400,
        "Invalid Invitation",
        "This invitation is no longer available."
      );
    }

    /* =====================================================
       6. UPDATE FIRESTORE
    ===================================================== */

    await invitationDoc.ref.update({
      invitation_status:
        "ACCEPTED",

      responded_at:
        new Date(),
    });

    /* =====================================================
       7. SUCCESS
    ===================================================== */

    return htmlResponse(
      res,
      200,
      "Invitation Accepted",
      "You have successfully accepted the CampuServe group request. The request host can now continue with the group request."
    );
  } catch (error) {
    console.error(
      "Accept invitation error:",
      error
    );

    return htmlResponse(
      res,
      500,
      "Something Went Wrong",
      "We could not process this invitation right now. Please try again later."
    );
  }
}