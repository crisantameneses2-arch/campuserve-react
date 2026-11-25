import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  OFFICES,
  OFFICE_LABEL,
  conversationIdFor,
  lookupStudent,
  markConversationRead,
  sendMessage,
  subscribeToConversationMessages,
  subscribeToOfficeConversations,
  subscribeToStudentConversations,
  type ChatMessage,
  type Conversation,
  type Office,
} from "../../services/messages";
import { announceNewMessage } from "../../services/messageEvents";
import { millis, toDate } from "../../utils/format";
import GroupInviteChat, {
  GROUP_THREAD_KEY,
  useGroupInvites,
} from "./GroupInviteChat";

import "./Messaging.css";

/*
 * One messaging screen used by both sides:
 *
 *   <MessagesPanel mode="student" studentId=… studentName=… />
 *     Students see one thread per office (Registrar Office, Supply Office)
 *     and can start a conversation with either of them.
 *
 *   <MessagesPanel mode="staff" office="registrar" staffName=… />
 *     Staff see every student conversation for their office, can search
 *     it, and can start a new conversation by Student ID.
 *
 * All styles are scoped under `.msx`, so the panel looks the same in
 * every dashboard without affecting anything around it.
 */

type MessagesPanelProps =
  | {
      mode: "student";
      studentId: string;
      studentName: string;
      /** Opens a group request the student started. */
      onContinueDraft?: (requestId: string) => void;
      /** Open the Group Requests conversation first. */
      openGroupInvites?: boolean;
    }
  | {
      mode: "staff";
      office: Office;
      staffName: string;
    };

type Thread = {
  key: string;
  conversationId: string;
  studentId: string;
  studentName: string;
  office: Office;
  title: string;
  subtitle: string;
  preview: string;
  lastAt?: unknown;
  unread: number;
};

export default function MessagesPanel(props: MessagesPanelProps) {
  const isStudent = props.mode === "student";
  const side: "student" | "staff" = props.mode;

  const studentId = props.mode === "student" ? props.studentId : "";
  const studentName = props.mode === "student" ? props.studentName : "";
  const office = props.mode === "staff" ? props.office : null;
  const senderName =
    props.mode === "student" ? props.studentName : props.staffName;

  /* ---------------- conversations ---------------- */

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  useEffect(() => {
    setListLoading(true);
    setListError("");

    const handleRows = (rows: Conversation[]) => {
      setConversations(rows);
      setListLoading(false);
    };

    const handleError = (error: Error) => {
      console.warn("Could not load conversations:", error);
      setListError(
        "Messages could not be loaded. Please check your connection and try again."
      );
      setListLoading(false);
    };

    if (isStudent) {
      if (!studentId) {
        setConversations([]);
        setListLoading(false);
        return;
      }

      return subscribeToStudentConversations(
        studentId,
        handleRows,
        handleError
      );
    }

    if (!office) return;

    return subscribeToOfficeConversations(office, handleRows, handleError);
  }, [isStudent, studentId, office]);

  /* Staff can open a conversation with a student who has not written yet. */
  const [draftThread, setDraftThread] = useState<Thread | null>(null);

  const threads: Thread[] = useMemo(() => {
    if (isStudent) {
      // Always show every office, even before the first message.
      return OFFICES.map((item) => {
        const conversation = conversations.find(
          (row) => row.office === item
        );

        return {
          key: item,
          conversationId: conversationIdFor(studentId, item),
          studentId,
          studentName,
          office: item,
          title: OFFICE_LABEL[item],
          subtitle: OFFICE_HINT[item],
          preview: conversation
            ? `${conversation.lastSenderRole === "student" ? "You: " : ""}${conversation.lastMessage}`
            : "",
          lastAt: conversation?.lastAt,
          unread: conversation?.studentUnread ?? 0,
        };
      }).sort((a, b) => {
        // Offices with recent messages first, then the default order.
        if (a.lastAt && b.lastAt) return millis(b.lastAt) - millis(a.lastAt);
        if (a.lastAt) return -1;
        if (b.lastAt) return 1;
        return 0;
      });
    }

    const rows: Thread[] = conversations.map((conversation) => ({
      key: conversation.id,
      conversationId: conversation.id,
      studentId: conversation.studentId,
      studentName: conversation.studentName,
      office: conversation.office,
      title: conversation.studentName || conversation.studentId,
      subtitle: conversation.studentId,
      preview: `${conversation.lastSenderRole === "staff" ? "You: " : ""}${conversation.lastMessage}`,
      lastAt: conversation.lastAt,
      unread: conversation.staffUnread,
    }));

    if (
      draftThread &&
      !rows.some((row) => row.conversationId === draftThread.conversationId)
    ) {
      rows.unshift(draftThread);
    }

    return rows;
  }, [isStudent, conversations, studentId, studentName, draftThread]);

  /* ---------------- selection ---------------- */

  const [selectedKey, setSelectedKey] = useState<string | null>(
    props.mode === "student" && props.openGroupInvites
      ? GROUP_THREAD_KEY
      : null
  );

  /* Group request invitations: a conversation of their own (students only). */
  const group = useGroupInvites(studentId);
  const groupOpen = isStudent && selectedKey === GROUP_THREAD_KEY;
  const [search, setSearch] = useState("");

  const visibleThreads = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return threads;

    return threads.filter((thread) =>
      `${thread.title} ${thread.subtitle} ${thread.preview}`
        .toLowerCase()
        .includes(term)
    );
  }, [threads, search]);

  const selected =
    threads.find((thread) => thread.key === selectedKey) ?? null;

  /* ---------------- messages of the open thread ---------------- */

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const selectedConversationId = selected?.conversationId ?? null;

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    return subscribeToConversationMessages(
      selectedConversationId,
      (rows) => {
        setMessages(rows);
        setMessagesLoading(false);
      },
      (error) => {
        console.warn("Could not load messages:", error);
        setMessagesLoading(false);
      }
    );
  }, [selectedConversationId]);

  // Mark as read while the thread is open.
  const selectedUnread = selected?.unread ?? 0;

  useEffect(() => {
    if (selectedConversationId && selectedUnread > 0) {
      void markConversationRead(selectedConversationId, side);
    }
  }, [selectedConversationId, selectedUnread, side]);

  // Keep the newest message in view.
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, selectedConversationId]);

  /* ---------------- composer ---------------- */

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();

    if (!selected || sending) return;

    const message = text.trim();

    if (!message) return;

    setSending(true);
    setSendError("");

    try {
      await sendMessage({
        studentId: selected.studentId,
        // Staff also save the name, so a conversation they start
        // shows the student's name instead of only the ID.
        studentName: isStudent
          ? studentName
          : selected.studentName || undefined,
        office: selected.office,
        senderRole: side,
        senderName,
        text: message,
      });

      setText("");

      // The notification is a bonus; a failure here must not
      // look like the message failed.
      announceNewMessage({
        side,
        studentId: selected.studentId,
        studentName: selected.studentName,
        office: selected.office,
        senderName,
      }).catch((error) =>
        console.warn("Could not send message notification:", error)
      );
    } catch (error) {
      console.error("Could not send message:", error);
      setSendError(
        error instanceof Error && error.message
          ? error.message
          : "Your message could not be sent. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift + Enter adds a new line.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  /* ---------------- staff: start a new conversation ---------------- */

  const [newOpen, setNewOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [newError, setNewError] = useState("");
  const [newLoading, setNewLoading] = useState(false);

  async function handleStartConversation(event: FormEvent) {
    event.preventDefault();

    if (!office) return;

    const id = newStudentId.trim();

    if (!id) {
      setNewError("Please enter a Student ID.");
      return;
    }

    setNewLoading(true);
    setNewError("");

    try {
      const student = await lookupStudent(id);

      if (!student) {
        setNewError("No student found with that ID.");
        return;
      }

      const conversationId = conversationIdFor(student.studentId, office);

      const existing = threads.find(
        (thread) => thread.conversationId === conversationId
      );

      if (existing) {
        setSelectedKey(existing.key);
      } else {
        setDraftThread({
          key: conversationId,
          conversationId,
          studentId: student.studentId,
          studentName: student.name,
          office,
          title: student.name,
          subtitle: student.studentId,
          preview: "",
          unread: 0,
        });
        setSelectedKey(conversationId);
      }

      setNewOpen(false);
      setNewStudentId("");
    } catch (error) {
      console.error("Could not look up student:", error);
      setNewError("Could not search for this student. Please try again.");
    } finally {
      setNewLoading(false);
    }
  }

  /* ---------------- render ---------------- */

  const panelTitle = isStudent
    ? "Messages"
    : `${OFFICE_LABEL[office ?? "registrar"]} inbox`;

  return (
    <section
      className={`msx ${selected || groupOpen ? "msx--thread-open" : ""}`}
      aria-label={panelTitle}
    >
      {/* ===== Conversation list ===== */}

      <div className="msx-list">
        <div className="msx-list__head">
          <div>
            <span className="msx-eyebrow">
              {isStudent ? "CONTACT AN OFFICE" : "STUDENT MESSAGES"}
            </span>
            <h2>{panelTitle}</h2>
          </div>

          {!isStudent && (
            <button
              type="button"
              className="msx-btn msx-btn--soft"
              onClick={() => {
                setNewOpen(!newOpen);
                setNewError("");
              }}
              aria-expanded={newOpen}
            >
              {newOpen ? "Cancel" : "+ New"}
            </button>
          )}
        </div>

        {!isStudent && newOpen && (
          <form className="msx-new" onSubmit={handleStartConversation}>
            <label htmlFor="msx-new-student">Message a student</label>

            <div className="msx-new__row">
              <input
                id="msx-new-student"
                className="msx-input"
                value={newStudentId}
                onChange={(event) => {
                  setNewStudentId(event.target.value);
                  setNewError("");
                }}
                placeholder="Student ID"
                disabled={newLoading}
                autoFocus
              />

              <button
                type="submit"
                className="msx-btn msx-btn--primary"
                disabled={newLoading || !newStudentId.trim()}
              >
                {newLoading ? "Finding…" : "Open"}
              </button>
            </div>

            {newError && <p className="msx-error">{newError}</p>}
          </form>
        )}

        {!isStudent && (
          <input
            className="msx-input msx-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or Student ID"
            aria-label="Search conversations"
          />
        )}

        <div className="msx-threads" role="list">
          {isStudent && (
            <button
              type="button"
              role="listitem"
              className={`msx-thread ${groupOpen ? "is-active" : ""} ${group.pendingCount > 0 ? "is-unread" : ""}`}
              onClick={() => {
                setSelectedKey(GROUP_THREAD_KEY);
                setSendError("");
              }}
            >
              <span className="msx-avatar msx-avatar--group" aria-hidden="true">
                <GroupIcon />
              </span>

              <span className="msx-thread__body">
                <span className="msx-thread__top">
                  <strong>Group Requests</strong>
                  {group.latest && (
                    <small>{formatShortTime(group.latest.at)}</small>
                  )}
                </span>

                <span className="msx-thread__preview">
                  {group.latest?.text || "Invitations from classmates"}
                </span>
              </span>

              {group.pendingCount > 0 && (
                <span
                  className="msx-count"
                  aria-label={`${group.pendingCount} pending invitations`}
                >
                  {group.pendingCount > 9 ? "9+" : group.pendingCount}
                </span>
              )}
            </button>
          )}

          {listLoading ? (
            <p className="msx-muted msx-pad">Loading conversations…</p>
          ) : listError ? (
            <p className="msx-error msx-pad">{listError}</p>
          ) : visibleThreads.length === 0 ? (
            <div className="msx-empty-list">
              <strong>
                {search ? "No matching conversations" : "No messages yet"}
              </strong>
              <p>
                {search
                  ? "Try another name or Student ID."
                  : "When students message this office, their conversations will appear here."}
              </p>
            </div>
          ) : (
            visibleThreads.map((thread) => (
              <button
                key={thread.key}
                type="button"
                role="listitem"
                className={`msx-thread ${selected?.key === thread.key ? "is-active" : ""} ${thread.unread > 0 ? "is-unread" : ""}`}
                onClick={() => {
                  setSelectedKey(thread.key);
                  setSendError("");
                }}
              >
                <span className="msx-avatar" aria-hidden="true">
                  {isStudent ? (
                    <OfficeIcon office={thread.office} />
                  ) : (
                    getInitials(thread.title)
                  )}
                </span>

                <span className="msx-thread__body">
                  <span className="msx-thread__top">
                    <strong>{thread.title}</strong>
                    {thread.lastAt !== undefined && (
                      <small>{formatShortTime(thread.lastAt)}</small>
                    )}
                  </span>

                  <span className="msx-thread__preview">
                    {thread.preview || thread.subtitle}
                  </span>
                </span>

                {thread.unread > 0 && (
                  <span
                    className="msx-count"
                    aria-label={`${thread.unread} unread`}
                  >
                    {thread.unread > 9 ? "9+" : thread.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ===== Open thread ===== */}

      <div className="msx-chat">
        {groupOpen ? (
          <>
            <header className="msx-chat__head">
              <button
                type="button"
                className="msx-btn msx-btn--ghost msx-back"
                onClick={() => setSelectedKey(null)}
                aria-label="Back to conversations"
              >
                ←
              </button>

              <span className="msx-avatar msx-avatar--group" aria-hidden="true">
                <GroupIcon />
              </span>

              <div>
                <strong>Group Requests</strong>
                <small>Invitations from classmates</small>
              </div>
            </header>

            <GroupInviteChat
              studentName={studentName}
              data={group}
              onContinueDraft={
                props.mode === "student" ? props.onContinueDraft : undefined
              }
            />
          </>
        ) : !selected ? (
          <div className="msx-placeholder">
            <span className="msx-placeholder__icon" aria-hidden="true">
              <ChatIcon />
            </span>
            <strong>
              {isStudent ? "Choose an office" : "Choose a conversation"}
            </strong>
            <p>
              {isStudent
                ? "Pick the office you want to talk to. Questions about documents go to the Registrar; item reservations go to the Supply Office."
                : "Select a student on the left to read and reply."}
            </p>
          </div>
        ) : (
          <>
            <header className="msx-chat__head">
              <button
                type="button"
                className="msx-btn msx-btn--ghost msx-back"
                onClick={() => setSelectedKey(null)}
                aria-label="Back to conversations"
              >
                ←
              </button>

              <span className="msx-avatar" aria-hidden="true">
                {isStudent ? (
                  <OfficeIcon office={selected.office} />
                ) : (
                  getInitials(selected.title)
                )}
              </span>

              <div>
                <strong>{selected.title}</strong>
                <small>{selected.subtitle}</small>
              </div>
            </header>

            <div className="msx-messages" aria-live="polite">
              {messagesLoading && messages.length === 0 ? (
                <p className="msx-muted msx-center">Loading messages…</p>
              ) : messages.length === 0 ? (
                <div className="msx-start">
                  <strong>Start the conversation</strong>
                  <p>
                    {isStudent
                      ? `Send your question to the ${selected.title}. Staff will reply here, and you'll get a notification.`
                      : `Send a message to ${selected.title}. They'll be notified on their dashboard.`}
                  </p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const mine = message.senderRole === side;
                  const previous = messages[index - 1];
                  const showDay =
                    !previous ||
                    dayKey(previous.createdAt) !== dayKey(message.createdAt);

                  return (
                    <div key={message.id} className="msx-msg-wrap">
                      {showDay && (
                        <div className="msx-day">
                          <span>{formatDay(message.createdAt)}</span>
                        </div>
                      )}

                      <div className={`msx-msg ${mine ? "is-mine" : ""}`}>
                        {!mine && (
                          <span className="msx-msg__name">
                            {message.senderName}
                          </span>
                        )}

                        <p>{message.text}</p>

                        {message.related && (
                          <span className="msx-msg__ref">
                            About {message.related.label || message.related.id}
                          </span>
                        )}

                        <time>{formatTime(message.createdAt)}</time>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={threadEndRef} />
            </div>

            <form className="msx-composer" onSubmit={handleSend}>
              {sendError && <p className="msx-error">{sendError}</p>}

              <div className="msx-composer__row">
                <label className="msx-visually-hidden" htmlFor="msx-text">
                  Message
                </label>

                <textarea
                  id="msx-text"
                  className="msx-input msx-textarea"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Type your message…"
                  rows={1}
                  maxLength={2000}
                  disabled={sending}
                />

                <button
                  type="submit"
                  className="msx-btn msx-btn--primary msx-send"
                  disabled={sending || !text.trim()}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>

              <small className="msx-hint">
                Press Enter to send · Shift + Enter for a new line
              </small>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------- helpers ---------------- */

const OFFICE_HINT: Record<Office, string> = {
  registrar: "Document requests & claiming",
  general_office: "Item reservations",
};

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/[\s._-]+/)
    .filter((part) => /[a-z]/i.test(part));

  if (parts.length === 0) return "ST";

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function dayKey(value: unknown) {
  const date = toDate(value) ?? new Date();

  return date.toDateString();
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
  const date = toDate(value) ?? new Date();

  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortTime(value: unknown) {
  const date = toDate(value) ?? new Date();

  return date.toDateString() === new Date().toDateString()
    ? formatTime(value)
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function OfficeIcon({ office }: { office: Office }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 19,
    height: 19,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (office === "registrar") {
    return (
      <svg {...common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
    );
  }

  if (office === "general_office") {
    return (
      <svg {...common}>
        <path d="M6 8h12l1 13H5L6 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 3 20 7v5c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V7z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.7c1.6.6 2.7 2.2 3 4.8" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 4h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H10l-5.5 3v-4.2A3 3 0 0 1 3.5 15V7a3 3 0 0 1 3-3Z" />
      <path d="M8 10h8M8 13.5h6" />
    </svg>
  );
}
