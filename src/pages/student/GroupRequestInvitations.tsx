
import { useEffect, useState } from "react";

import {
  subscribeToGroupInvites,
  respondToGroupInvite,
  lookupGroupStudent,
  type GroupInvite,
} from "../../services/groupRequests";

import "./GroupRequestInvitations.css";

type Props = {
  studentId: string;
};

export default function GroupRequestInvitations({
  studentId,
}: Props) {
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [studentName, setStudentName] = useState("");
  const [respondingId, setRespondingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) {
      setInvites([]);
      return;
    }

    return subscribeToGroupInvites(
      studentId,
      setInvites
    );
  }, [studentId]);

  useEffect(() => {
    let active = true;

    async function loadStudentName() {
      try {
        const student = await lookupGroupStudent(studentId);

        if (active) {
          setStudentName(student?.name || studentId);
        }
      } catch {
        if (active) {
          setStudentName(studentId);
        }
      }
    }

    if (studentId) {
      loadStudentName();
    }

    return () => {
      active = false;
    };
  }, [studentId]);

  async function handleResponse(
    invite: GroupInvite,
    response: "ACCEPTED" | "DECLINED"
  ) {
    if (invite.status !== "PENDING") return;

    try {
      setError("");
      setRespondingId(invite.memberDocId);

      await respondToGroupInvite(
        invite,
        response,
        studentName || studentId
      );
    } catch (err) {
      console.error("Could not respond to group invitation:", err);
      setError("Your response could not be saved. Please try again.");
    } finally {
      setRespondingId("");
    }
  }

  return (
    <div className="group-invitations-page">
      <div className="group-invitations-header">
        <div>
          <h2>Group Request Invitations</h2>
          <p>
            Review invitations from classmates who want to include you
            in a group document request.
          </p>
        </div>
      </div>

      {error && (
        <div className="group-invitation-error">
          {error}
        </div>
      )}

      {invites.length === 0 ? (
        <div className="group-invitations-empty">
          <h3>No group invitations</h3>
          <p>
            You currently have no group document request invitations.
          </p>
        </div>
      ) : (
        <div className="group-invitations-list">
          {invites.map((invite) => {
            const isResponding =
              respondingId === invite.memberDocId;

            return (
              <div
                className="group-invitation-card"
                key={invite.memberDocId}
              >
                <div className="group-invitation-top">
                  <div>
                    <h3>{invite.requesterName}</h3>
                    <p>Invited you to a group document request</p>
                  </div>

                  <span
                    className={`group-invitation-status ${invite.status.toLowerCase()}`}
                  >
                    {invite.status}
                  </span>
                </div>

                <div className="group-invitation-details">
                  <p>
                    <strong>Documents:</strong>{" "}
                    {invite.documentsLabel}
                  </p>

                  <p>
                    <strong>Purpose:</strong>{" "}
                    {invite.purpose || "Not specified yet"}
                  </p>

                  <p>
                    <strong>Request status:</strong>{" "}
                    {invite.requestStatus || "DRAFT"}
                  </p>

                  {invite.totalAmount > 0 && (
                    <p>
                      <strong>Total amount:</strong>{" "}
                      ₱{invite.totalAmount.toFixed(2)}
                    </p>
                  )}
                </div>

                {invite.status === "PENDING" ? (
                  <div className="group-invitation-actions">
                    <button
                      type="button"
                      className="group-invitation-accept"
                      disabled={isResponding}
                      onClick={() =>
                        handleResponse(invite, "ACCEPTED")
                      }
                    >
                      {isResponding ? "Please wait..." : "Accept"}
                    </button>

                    <button
                      type="button"
                      className="group-invitation-decline"
                      disabled={isResponding}
                      onClick={() =>
                        handleResponse(invite, "DECLINED")
                      }
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <p className="group-invitation-responded">
                    You have already responded to this invitation.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
