import {
  notify,
  roleAudience,
  studentAudience,
  type StaffRole,
} from "./notifications";
import {
  OFFICE_LABEL,
  type Office,
  type RelatedRef,
} from "./messages";

/** A new chat message pings the other side. */
export async function announceNewMessage(args: {
  side: "student" | "staff";
  studentId: string;
  studentName?: string;
  office: Office;
  senderName: string;
  related?: RelatedRef | null;
}): Promise<void> {
  const about = args.related
    ? ` about ${
        args.related.label ||
        args.related.id
      }`
    : "";

  if (args.side === "student") {
    await notify({
      audience: roleAudience(
        args.office as StaffRole
      ),
      type: "INFO",
      title: "New Message",
      message: `${
        args.studentName ||
        args.studentId
      } sent a message${about}.`,
      kind:
        args.related?.kind ?? null,
      relatedId:
        args.related?.id ?? null,
    });
  } else {
    await notify({
      audience: studentAudience(
        args.studentId
      ),
      type: "INFO",
      title: `Message from ${
        OFFICE_LABEL[args.office]
      }`,
      message: `${
        args.senderName
      } sent you a message${about}.`,
      kind:
        args.related?.kind ?? null,
      relatedId:
        args.related?.id ?? null,
    });
  }
}