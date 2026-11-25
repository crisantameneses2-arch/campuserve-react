import { useEffect, useState } from "react";

import {
  subscribeToOfficeConversations,
  subscribeToStudentConversations,
  STUDENT_OFFICES,
  type Office,
} from "../../services/messages";

/** Total unread messages for a student, across all offices. */
export function useStudentUnreadMessages(studentId: string): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!studentId) {
      setUnread(0);
      return;
    }

    return subscribeToStudentConversations(
      studentId,
      (rows) =>
        setUnread(
          rows
            .filter((row) => STUDENT_OFFICES.includes(row.office))
            .reduce((total, row) => total + (row.studentUnread || 0), 0)
        ),
      () => setUnread(0)
    );
  }, [studentId]);

  return unread;
}

/** Total unread student messages waiting in one office's inbox. */
export function useOfficeUnreadMessages(office: Office): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    return subscribeToOfficeConversations(
      office,
      (rows) =>
        setUnread(
          rows.reduce((total, row) => total + (row.staffUnread || 0), 0)
        ),
      () => setUnread(0)
    );
  }, [office]);

  return unread;
}
