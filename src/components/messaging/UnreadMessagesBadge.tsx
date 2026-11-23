import type { Office } from "../../services/messages";
import { useOfficeUnreadMessages } from "./useUnreadMessages";
import "./Messaging.css";

/**
 * Small unread counter for a staff dashboard's "Messages" menu item.
 * Renders nothing when there are no unread messages.
 */
export default function UnreadMessagesBadge({ office }: { office: Office }) {
  const unread = useOfficeUnreadMessages(office);

  if (unread <= 0) return null;

  return (
    <b className="msx-nav-badge" aria-label={`${unread} unread messages`}>
      {unread > 9 ? "9+" : unread}
    </b>
  );
}
