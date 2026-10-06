import { useEffect, useMemo, useState } from "react";
import {
  subscribeToNotifications,
  type AppNotification,
} from "../services/notifications";

/** Live notifications for one audience, plus the unread count for `userKey`. */
export function useNotifications(
  audience: string | string[] | null,
  userKey: string
) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(audience));
  const [error, setError] = useState("");

  const audienceKey = Array.isArray(audience)
    ? audience.join("|")
    : audience;

  useEffect(() => {
    if (!audience) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    return subscribeToNotifications(
      audience,
      (rows) => {
        setItems(rows);
        setLoading(false);
        setError("");
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey]);

  const unread = useMemo(
    () =>
      items.filter(
        (n) => !n.readBy.includes(userKey)
      ).length,
    [items, userKey]
  );

  return {
    items,
    unread,
    loading,
    error,
  };
}
