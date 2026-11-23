
import { useEffect, useState } from "react";

import {
  subscribeToGroupInvites,
  respondToGroupInvite,
  lookupGroupStudent,
  subscribeToGroupMembers,
  type GroupInvite,
  type InvitationStatus,
} from "../../services/groupRequests";

import {
  subscribeToStudentDraftGroupRequests,
} from "../../services/documentRequests";

import "./GroupRequestInvitations.css";

type Props = {
  studentId: string;
  onContinueDraft: (requestId: string) => void;
};

type DraftMember = {
  studentId: string;
  name: string;
  status: InvitationStatus;
};

type DraftMembersMap = Record<string, DraftMember[]>;

function timestampMillis(value: unknown): number {
  if (!value) return 0;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    return new Date(value).getTime() || 0;
  }

  if (typeof value === "object") {
    const timestamp = value as {
      toMillis?: () => number;
      seconds?: number;
    };

    if (typeof timestamp.toMillis === "function") {
      return timestamp.toMillis();
    }

    if (typeof timestamp.seconds === "number") {
      return timestamp.seconds * 1000;
    }
  }

  return 0;
}

function formatDate(value: unknown): string {
  const milliseconds = timestampMillis(value);

  if (!milliseconds) return "Date unavailable";

  return new Date(milliseconds).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function GroupRequestInvitations({
  studentId,
  onContinueDraft,
}: Props) {
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [studentName, setStudentName] = useState("");
  const [respondingId, setRespondingId] = useState("");
  const [error, setError] = useState("");

  const [draftRequests, setDraftRequests] = useState<
    Record<string, unknown>[]
  >([]);

  const [draftMembers, setDraftMembers] =
    useState<DraftMembersMap>({});

  // Listen to incoming invitations.
  useEffect(() => {
    if (!studentId) {
      setInvites([]);
      return;
    }

    return subscribeToGroupInvites(studentId, setInvites);
  }, [studentId]);

  // Listen to the student's own draft requests.
  useEffect(() => {
    if (!studentId) {
      setDraftRequests([]);
      return;
    }

    return subscribeToStudentDraftGroupRequests(
      studentId,
      setDraftRequests
    );
  }, [studentId]);

  // Listen to the members of every draft request.
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (!draftRequests.length) {
      setDraftMembers({});
      return;
    }

    const sortedDrafts = [...draftRequests].sort(
      (a, b) =>
        timestampMillis(b.created_at) -
        timestampMillis(a.created_at)
    );

    sortedDrafts.forEach((draft) => {
      const requestId = String(draft.request_id ?? "");

      if (!requestId) return;

      const unsubscribe = subscribeToGroupMembers(
        requestId,
        (members) => {
          setDraftMembers((previous) => ({
            ...previous,
            [requestId]: members,
          }));
        }
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [draftRequests]);

  // Load the current student's name.
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

  const sortedDrafts = [...draftRequests].sort(
    (a, b) =>
      timestampMillis(b.created_at) -
      timestampMillis(a.created_at)
  );

  const sortedInvites = [...invites].sort(
    (a, b) =>
      timestampMillis(b.createdAt) -
      timestampMillis(a.createdAt)
  );

  return (
    <div className="group-invitations-page">
      <div className="group-invitations-header">
        <div>
          <h2>Group Request Invitations</h2>
          <p>
            Review invitations from classmates and manage your
            own group document requests.
          </p>
        </div>
      </div>

      {error && (
        <div className="group-invitation-error">
          {error}
        </div>
      )}
      <section className="group-request-section">
        <h3>Incoming Group Invitations</h3>

        {sortedInvites.length === 0 ? (
          <div className="group-invitations-empty">
            <h3>No group invitations</h3>
            <p>
              You currently have no group document request invitations.
            </p>
          </div>
        ) : (
          <div className="group-invitations-list">
            {sortedInvites.map((invite) => {
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
                      <p>
                        Invited you to a group document request
                      </p>
                    </div>

                    <span
                      className={`group-invitation-status ${invite.status.toLowerCase()}`}
                    >
                      {invite.status}
                    </span>
                  </div>

                  <div className="group-invitation-details">
                    <p>
                      <strong>Request ID:</strong>{" "}
                      {invite.requestId}
                    </p>

                    <p>
                      <strong>Created:</strong>{" "}
                      {formatDate(invite.createdAt)}
                    </p>

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
      </section>

      {/* YOUR DRAFT REQUESTS */}
      <section className="group-request-section">
        <h3>Your Draft Group Requests</h3>

        {sortedDrafts.length === 0 ? (
          <div className="group-invitations-empty">
            <p>You have no unfinished group requests.</p>
          </div>
        ) : (
          <div className="group-invitations-list">
            {sortedDrafts.map((draft) => {
              const requestId = String(draft.request_id ?? "");
              const members = draftMembers[requestId] ?? [];

              const accepted = members.filter(
                (m) => m.status === "ACCEPTED"
              ).length;

              const pending = members.filter(
                (m) => m.status === "PENDING"
              ).length;

              const declined = members.filter(
                (m) => m.status === "DECLINED"
              ).length;

              return (
                <div
                  className="group-invitation-card"
                  key={requestId}
                >
                  <div className="group-invitation-top">
                    <div>
                      <h3>Group Document Request</h3>
                      <p>
                        Request ID: {requestId}
                      </p>
                    </div>

                    <span className="group-invitation-status pending">
                      DRAFT
                    </span>
                  </div>

                  <div className="group-invitation-details">
                    <p>
                      <strong>Created:</strong>{" "}
                      {formatDate(draft.created_at)}
                    </p>

                    <p>
                      <strong>Invited students:</strong>{" "}
                      {members.length}
                    </p>

                    <div className="group-draft-counts">
                      <span>Accepted: {accepted}</span>
                      <span>Pending: {pending}</span>
                      <span>Declined: {declined}</span>
                    </div>
                  </div>

                  <div className="group-draft-members">
                    <strong>Invited classmates</strong>

                    {members.length === 0 ? (
                      <p>No classmates have been invited yet.</p>
                    ) : (
                      <div className="group-draft-member-list">
                        {members.map((member) => (
                          <div
                            className="group-draft-member"
                            key={member.studentId}
                          >
                            <span>
                              {member.name}
                              <small> ({member.studentId})</small>
                            </span>

                            <span
                              className={`group-invitation-status ${member.status.toLowerCase()}`}
                            >
                              {member.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="group-invitation-actions">
                    <button
                      type="button"
                      className="group-invitation-accept"
                      onClick={() => onContinueDraft(requestId)}
                    >
                      Continue Request
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* INCOMING INVITATIONS */}
      
    </div>
  );
}
