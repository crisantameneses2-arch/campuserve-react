import {
  notify,
  officeRoleFor,
  roleAudience,
  statusNotificationCopy,
  studentAudience,
} from "./notifications";

import { getRequestAudienceIds } from "./groupRequests";

import {
  formatClaimDate,
  formatClaimTime,
  type TransactionKind,
} from "../utils/format";

/* =========================================================
   One place that decides who hears about what.
   Every call is best-effort (notify() never throws).
========================================================= */

type Base = {
  kind: TransactionKind;
  id: string;
  studentId: string;
  studentName?: string;
  /** Human label, e.g. "Certified True Copy" or "University Uniform – Medium" */
  label: string;
};

const noun = (kind: TransactionKind) =>
  kind === "DOCUMENT"
    ? "document request"
    : "item reservation";

const Noun = (kind: TransactionKind) =>
  kind === "DOCUMENT"
    ? "Request"
    : "Reservation";

const who = (b: Base) =>
  b.studentName || b.studentId;

/** A student submitted a new request/reservation -> the owning office. */
export async function announceSubmitted(
  b: Base
): Promise<void> {
  await notify({
    audience: roleAudience(
      officeRoleFor(b.kind)
    ),
    type: "SUBMITTED",
    title:
      b.kind === "DOCUMENT"
        ? "New Document Request"
        : "New Item Reservation",
    message: `${who(b)} submitted a ${noun(
      b.kind
    )}: ${b.label} (${b.id}).`,
    kind: b.kind,
    relatedId: b.id,
  });
}

/** Group requests: tell every added student, so it shows up in their Messages > Group Request. */
export async function announceGroupInvites(
  b: Base,
  memberIds: string[]
): Promise<void> {
  await notify(
    memberIds.map((memberId) => ({
      audience: studentAudience(memberId),
      type: "GROUP_REQUEST" as const,
      title: "Group Document Request",
      message: `${who(b)} has added you to a ${b.label} group request.`,
      kind: "DOCUMENT" as const,
      relatedId: b.id,
    }))
  );
}

/** Staff moved a transaction to a new status -> the student (and accepted group members). */
export async function announceStatusChange(
  b: Base & { status: string }
): Promise<void> {
  const copy = statusNotificationCopy(
    b.kind,
    b.status,
    b.label
  );

  if (!copy) return;

  const recipients =
    b.kind === "DOCUMENT"
      ? await getRequestAudienceIds(
          b.id,
          b.studentId
        )
      : [b.studentId];

  await notify(
    recipients.map((studentId) => ({
      audience: studentAudience(studentId),
      type: copy.type,
      title: copy.title,
      message: copy.message,
      kind: b.kind,
      relatedId: b.id,
    }))
  );
}

/** Student cancelled -> confirmation to them, heads-up to the office and admin. */
export async function announceStudentCancelled(
  b: Base
): Promise<void> {
  await notify([
    {
      audience: studentAudience(b.studentId),
      type: "CANCELLED",
      title: `${Noun(b.kind)} Cancelled`,
      message: `You cancelled your ${b.label} ${noun(
        b.kind
      )} (${b.id}).`,
      kind: b.kind,
      relatedId: b.id,
    },

    ...(["office", "admin"] as const).map(
      (target) => ({
        audience:
          target === "admin"
            ? roleAudience("admin")
            : roleAudience(
                officeRoleFor(b.kind)
              ),
        type: "CANCELLED" as const,
        title: `${Noun(b.kind)} Cancelled`,
        message: `${who(b)} cancelled ${b.label} (${b.id}).`,
        kind: b.kind,
        relatedId: b.id,
      })
    ),
  ]);
}

/** Student rescheduled -> confirmation to them, heads-up to the office and admin. */
export async function announceStudentRescheduled(
  b: Base & {
    fromDate: string;
    fromTime: string;
    toDate: string;
    toTime: string;
  }
): Promise<void> {
  const from = `${formatClaimDate(
    b.fromDate
  )}, ${formatClaimTime(b.fromTime)}`;

  const to = `${formatClaimDate(
    b.toDate
  )}, ${formatClaimTime(b.toTime)}`;

  await notify([
    {
      audience: studentAudience(b.studentId),
      type: "RESCHEDULED",
      title: `${Noun(b.kind)} Rescheduled`,
      message: `Your ${b.label} ${noun(
        b.kind
      )} (${b.id}) moved to ${to}.`,
      kind: b.kind,
      relatedId: b.id,
    },

    {
      audience: roleAudience(
        officeRoleFor(b.kind)
      ),
      type: "RESCHEDULED",
      title: `${Noun(b.kind)} Rescheduled`,
      message: `${who(b)} moved ${b.label} (${b.id}) from ${from} to ${to}.`,
      kind: b.kind,
      relatedId: b.id,
    },

    {
      audience: roleAudience("admin"),
      type: "RESCHEDULED",
      title: `${Noun(b.kind)} Rescheduled`,
      message: `${who(b)} moved ${b.label} (${b.id}) to ${to}.`,
      kind: b.kind,
      relatedId: b.id,
    },
  ]);
}