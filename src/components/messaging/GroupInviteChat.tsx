import { useEffect, useMemo, useRef, useState } from "react";

import {
  respondToGroupInvite,
  subscribeToGroupInvites,
  subscribeToGroupMembers,
  type GroupInvite,
  type InvitationStatus,
} from "../../services/groupRequests";
import { subscribeToStudentDraftGroupRequests } from "../../services/documentRequests";
import { millis, toDate } from "../../utils/format";

/*
 * Group document request invitations, shown as a chat conversation
 * inside the student's Messages panel.
 *
 *   - Each invitation a classmate sent is an incoming bubble with
 *     the request details and Accept / Decline buttons.
 *   - Once answered, the student's reply appears as their own bubble.
 *   - Group requests the student started appear as outgoing bubbles
 *     that show who has answered, with a "Continue request" button.
 */

type DraftMember = {
  studentId: string;
  name: string;
  status: InvitationStatus;
};

type Draft = {
  requestId: string;
  createdAt: unknown;
};

export const GROUP_THREAD_KEY = "group-invites";

/* ---------------- data ---------------- */

export function useGroupInvites(studentId: string) {
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [members, setMembers] = useState<Record<string, DraftMember[]>>({});

  useEffect(() => {
    if (!studentId) {
      setInvites([]);
      return;
    }

    return subscribeToGroupInvites(studentId, setInvites);
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      setDrafts([]);
      return;
    }

    return subscribeToStudentDraftGroupRequests(studentId, (rows) =>
      setDrafts(
        rows
          .map((row) => ({
            requestId: String(row.request_id ?? ""),
            createdAt: row.created_at,
          }))
          .filter((draft) => draft.requestId)
      )
    );
  }, [studentId]);

  // Re-subscribe only when the set of draft IDs changes.
  const draftIds = drafts.map((draft) => draft.requestId).join("|");

  useEffect(() => {
    if (!draftIds) {
      setMembers({});
      return;
    }

    const unsubscribers = draftIds.split("|").map((requestId) =>
      subscribeToGroupMembers(requestId, (rows) =>
        setMembers((previous) => ({ ...previous, [requestId]: rows }))
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [draftIds]);

  const pending = invites.filter((invite) => invite.status === "PENDING");

  // Newest activity, for sorting the thread list and its preview.
  const latest = useMemo(() => {
    const items = [
      ...invites.map((invite) => ({
        at: invite.createdAt,
        text:
          invite.status === "PENDING"
            ? `${invite.requesterName} invited you to a group request`
            : `You ${invite.status === "ACCEPTED" ? "accepted" : "declined"} ${invite.requesterName}'s invitation`,
      })),
      ...drafts.map((draft) => ({
        at: draft.createdAt,
        text: "You started a group request",
      })),
    ].sort((a, b) => millis(b.at) - millis(a.at));

    return items[0] ?? null;
  }, [invites, drafts]);

  return { invites, drafts, members, pendingCount: pending.length, latest };
}

/* ---------------- conversation ---------------- */

export default function GroupInviteChat({
  studentName,
  data,
  onContinueDraft,
}: {
  studentName: string;
  data: ReturnType<typeof useGroupInvites>;
  onContinueDraft?: (requestId: string) => void;
}) {
  const { invites, drafts, members } = data;
  const [respondingId, setRespondingId] = useState("");
  const [error, setError] = useState("");

  async function respond(
    invite: GroupInvite,
    response: "ACCEPTED" | "DECLINED"
  ) {
    if (invite.status !== "PENDING" || respondingId) return;

    setError("");
    setRespondingId(invite.memberDocId);

    try {
      await respondToGroupInvite(invite, response, studentName);
    } catch (err) {
      console.error("Could not respond to group invitation:", err);
      setError("Your response could not be saved. Please try again.");
    } finally {
      setRespondingId("");
    }
  }

  // Invitations and the student's own requests, oldest first like a chat.
  const items = useMemo(
    () =>
      [
        ...invites.map((invite) => ({
          kind: "invite" as const,
          at: invite.createdAt,
          invite,
        })),
        ...drafts.map((draft) => ({
          kind: "draft" as const,
          at: draft.createdAt,
          draft,
        })),
      ].sort((a, b) => millis(a.at) - millis(b.at)),
    [invites, drafts]
  );

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  return (
    <>
      <div className="msx-messages" aria-live="polite">
        {items.length === 0 ? (
          <div className="msx-start">
            <strong>No group invitations yet</strong>
            <p>
              When a classmate invites you to a group document request, it
              will appear here so you can accept or decline it.
            </p>
          </div>
        ) : (
          items.map((item, index) => {
            const previous = items[index - 1];
            const showDay =
              !previous || dayKey(previous.at) !== dayKey(item.at);

            return (
              <div
                key={
                  item.kind === "invite"
                    ? item.invite.memberDocId
                    : item.draft.requestId
                }
                className="msx-msg-wrap"
              >
                {showDay && (
                  <div className="msx-day">
                    <span>{formatDay(item.at)}</span>
                  </div>
                )}

                {item.kind === "invite" ? (
                  <InviteBubbles
                    invite={item.invite}
                    responding={respondingId === item.invite.memberDocId}
                    onRespond={respond}
                  />
                ) : (
                  <DraftBubble
                    requestId={item.draft.requestId}
                    at={item.at}
                    members={members[item.draft.requestId] ?? []}
                    onContinue={onContinueDraft}
                  />
                )}
              </div>
            );
          })
        )}

        <div ref={endRef} />
      </div>

      <div className="msx-composer msx-composer--note">
        {error && <p className="msx-error">{error}</p>}
        <small className="msx-hint">
          Reply to an invitation with Accept or Decline. Your answer is sent
          to the classmate who invited you.
        </small>
      </div>
    </>
  );
}

function InviteBubbles({
  invite,
  responding,
  onRespond,
}: {
  invite: GroupInvite;
  responding: boolean;
  onRespond: (invite: GroupInvite, response: "ACCEPTED" | "DECLINED") => void;
}) {
  const answered = invite.status !== "PENDING";

  return (
    <>
      <div className="msx-msg msx-invite">
        <span className="msx-msg__name">{invite.requesterName}</span>

        <p>
          Hi! I'm requesting documents as a group. Do you want to join my
          request?
        </p>

        <div className="msx-invite__card">
          <span className="msx-invite__tag">GROUP DOCUMENT REQUEST</span>
          <strong>{invite.documentsLabel || "Documents to be chosen"}</strong>

          <dl>
            <div>
              <dt>Purpose</dt>
              <dd>{invite.purpose || "Not specified yet"}</dd>
            </div>
            {invite.totalAmount > 0 && (
              <div>
                <dt>Total</dt>
                <dd>₱{invite.totalAmount.toFixed(2)}</dd>
              </div>
            )}
            <div>
              <dt>Request ID</dt>
              <dd>{invite.requestId}</dd>
            </div>
          </dl>

          {!answered && (
            <div className="msx-invite__actions">
              <button
                type="button"
                className="msx-btn msx-btn--primary"
                disabled={responding}
                onClick={() => onRespond(invite, "ACCEPTED")}
              >
                {responding ? "Sending…" : "Accept"}
              </button>
              <button
                type="button"
                className="msx-btn msx-btn--soft"
                disabled={responding}
                onClick={() => onRespond(invite, "DECLINED")}
              >
                Decline
              </button>
            </div>
          )}
        </div>

        <time>{formatTime(invite.createdAt)}</time>
      </div>

      {answered && (
        <div className="msx-msg is-mine">
          <p>
            {invite.status === "ACCEPTED"
              ? "✓ I accepted the invitation."
              : "I declined the invitation."}
          </p>
        </div>
      )}
    </>
  );
}

function DraftBubble({
  requestId,
  at,
  members,
  onContinue,
}: {
  requestId: string;
  at: unknown;
  members: DraftMember[];
  onContinue?: (requestId: string) => void;
}) {
  const waiting = members.filter((m) => m.status === "PENDING").length;

  return (
    <div className="msx-msg is-mine msx-invite">
      <p>
        {members.length === 0
          ? "I started a group request but haven't invited anyone yet."
          : `I invited ${members.length} classmate${members.length === 1 ? "" : "s"} to my group request.`}
      </p>

      <div className="msx-invite__card">
        <span className="msx-invite__tag">
          YOUR GROUP REQUEST · {requestId}
        </span>

        {members.length > 0 && (
          <ul className="msx-invite__members">
            {members.map((member) => (
              <li key={member.studentId}>
                <span>{member.name}</span>
                <em className={`is-${member.status.toLowerCase()}`}>
                  {member.status === "PENDING"
                    ? "Waiting"
                    : member.status === "ACCEPTED"
                      ? "Accepted"
                      : "Declined"}
                </em>
              </li>
            ))}
          </ul>
        )}

        {waiting > 0 && (
          <small className="msx-invite__note">
            Waiting for {waiting} {waiting === 1 ? "reply" : "replies"}
          </small>
        )}

        {onContinue && (
          <div className="msx-invite__actions">
            <button
              type="button"
              className="msx-btn msx-btn--primary"
              onClick={() => onContinue(requestId)}
            >
              Continue request
            </button>
          </div>
        )}
      </div>

      <time>{formatTime(at)}</time>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function dayKey(value: unknown) {
  return (toDate(value) ?? new Date()).toDateString();
}

function formatDay(value: unknown) {
  const date = toDate(value) ?? new Date();
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: unknown) {
  return (toDate(value) ?? new Date()).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}
