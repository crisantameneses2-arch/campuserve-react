import { useEffect, useMemo, useState } from "react";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

import { db } from "../../../firebase";

import "./ActivityLogs.css";

/* =====================================================
   TYPES
===================================================== */

type Category =
  | "requests"
  | "reservations"
  | "accounts"
  | "settings"
  | "other";

type LogRow = {
  id: string;
  actorId: string;
  actor: string;
  role: string;
  action: string;
  description: string;
  category: Category;
  requestId: string;
  details: [string, string][];
  ms: number;
  searchText: string;
};

/* =====================================================
   CONSTANTS & HELPERS
===================================================== */

const MAX_LOGS = 500;
const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;

const CATEGORY_LABELS: Record<Category, string> = {
  requests: "Requests",
  reservations: "Reservations",
  accounts: "Accounts",
  settings: "Settings & Roles",
  other: "Other",
};

const TIME_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

const humanize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const roleLabel = (role: string) =>
  role === "admin" ? "Administrator" : humanize(role || "unknown");

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
};

function categorize(action: string, requestId: string): Category {
  const key = action.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

  if (/RESERVATION|INVENTORY/.test(key)) return "reservations";
  if (/ACCOUNT|USER/.test(key)) return "accounts";
  if (/SETTING|ROLE|PERMISSION/.test(key)) return "settings";
  if (
    requestId ||
    /REQUEST|PROCESSING|DOCUMENT|CLAIMING|PAYMENT/.test(key)
  ) {
    return "requests";
  }

  return "other";
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const formatDate = (ms: number) =>
  ms
    ? new Date(ms).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const formatTime = (ms: number) =>
  ms
    ? new Date(ms).toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

/** Stops spreadsheet apps from running cells that begin with = + - @ */
function csvCell(value: unknown): string {
  let cell = String(value ?? "");

  if (/^[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }

  return `"${cell.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: LogRow[]) {
  const header = [
    "Date",
    "Time",
    "User",
    "Role",
    "Action",
    "Category",
    "Description",
    "Request ID",
  ];

  const lines = rows.map((row) =>
    [
      formatDate(row.ms),
      formatTime(row.ms),
      row.actor,
      roleLabel(row.role),
      row.action,
      CATEGORY_LABELS[row.category],
      row.description,
      row.requestId,
    ]
      .map(csvCell)
      .join(",")
  );

  const csv =
    "\ufeff" +
    [header.map(csvCell).join(","), ...lines].join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = `activity-logs-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

/* =====================================================
   COMPONENT
===================================================== */

function ActivityLogs() {
  const [rawLogs, setLogs] = useState<LogRow[]>([]);
  const [studentNames, setStudentNames] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState("");

  /* ---------- live data ---------- */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, "activityLogs"),
        orderBy("timestamp", "desc"),
        limit(MAX_LOGS)
      ),
      (snapshot) => {
        setLogs(
          snapshot.docs.map((item) => {
            const data = item.data();

            const action = String(data.action || "Activity");
            const requestId = String(data.request_id || "");
            const description = String(data.description || "");
            const actor = String(data.actor_name || "System");
            const role = String(data.actor_role || "");

            const details: [string, string][] =
              data.details && typeof data.details === "object"
                ? Object.entries(
                    data.details as Record<string, unknown>
                  ).map(([key, value]) => [
                    humanize(key),
                    formatDetailValue(value),
                  ])
                : [];

            return {
              id: item.id,
              actorId: String(data.actor_id || ""),
              actor,
              role,
              action: humanize(action),
              description,
              category: categorize(action, requestId),
              requestId,
              details,
              ms:
                data.timestamp instanceof Timestamp
                  ? data.timestamp.toMillis()
                  : 0,
              searchText: [
                actor,
                roleLabel(role),
                action,
                description,
                requestId,
              ]
                .join(" ")
                .toLowerCase(),
            };
          })
        );
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        setError(
          `Could not load activity logs: ${snapshotError.message}`
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Student actions are logged with the student ID, so look up names.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "accounts"),
      (snapshot) => {
        const names: Record<string, string> = {};

        snapshot.docs.forEach((item) => {
          const data = item.data();
          const studentId = String(data.student_id || "")
            .trim()
            .toUpperCase();
          const name =
            [data.firstName, data.lastName]
              .filter((part) => typeof part === "string" && part)
              .join(" ")
              .trim() || String(data.name || "").trim();

          if (studentId && name) names[studentId] = name;
        });

        setStudentNames(names);
      },
      (snapshotError) => {
        console.error("Could not load accounts:", snapshotError);
      }
    );

    return unsubscribe;
  }, []);

  const logs = useMemo(
    () =>
      rawLogs.map((log) => {
        const name =
          log.role === "student"
            ? studentNames[log.actorId.trim().toUpperCase()]
            : undefined;

        return name
          ? {
              ...log,
              actor: name,
              searchText: `${log.searchText} ${name.toLowerCase()}`,
            }
          : log;
      }),
    [rawLogs, studentNames]
  );

  /* ---------- derived ---------- */

  const roleOptions = useMemo(
    () =>
      Array.from(new Set(logs.map((log) => log.role)))
        .filter(Boolean)
        .sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();

    const since =
      timeFilter === "today"
        ? startOfToday()
        : timeFilter === "all"
        ? 0
        : now - Number(timeFilter) * DAY;

    return logs.filter(
      (log) =>
        (roleFilter === "ALL" || log.role === roleFilter) &&
        (categoryFilter === "ALL" ||
          log.category === categoryFilter) &&
        log.ms >= since &&
        (!term || log.searchText.includes(term))
    );
  }, [logs, search, roleFilter, categoryFilter, timeFilter]);

  const stats = useMemo(() => {
    const today = startOfToday();
    const week = Date.now() - 7 * DAY;

    return {
      today: logs.filter((log) => log.ms >= today).length,
      week: logs.filter((log) => log.ms >= week).length,
      admin: logs.filter((log) => log.role === "admin").length,
      registrar: logs.filter((log) => log.role === "registrar")
        .length,
    };
  }, [logs]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(
    pageStart,
    pageStart + PAGE_SIZE
  );

  const resetPage = () => setPage(1);

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="logs-page">
      <div className="logs-header">
        <div>
          <h1>Activity Logs</h1>
          <p>
            Live feed of important activities recorded in
            CampuServe (latest {MAX_LOGS} entries).
          </p>
        </div>

        <button
          type="button"
          className="logs-refresh-button"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
        >
          ⬇ Export CSV
        </button>
      </div>

      {error && (
        <div className="logs-error" role="alert">
          {error}
        </div>
      )}

      <div className="logs-summary">
        <div>
          <span>Today's Activities</span>
          <strong>{stats.today}</strong>
        </div>

        <div>
          <span>Last 7 Days</span>
          <strong>{stats.week}</strong>
        </div>

        <div>
          <span>Admin Actions</span>
          <strong>{stats.admin}</strong>
        </div>

        <div>
          <span>Registrar Actions</span>
          <strong>{stats.registrar}</strong>
        </div>
      </div>

      <div className="logs-card">
        <div className="logs-toolbar">
          <div className="logs-search">
            <input
              type="text"
              placeholder="Search by user, action, description or request ID..."
              value={search}
              aria-label="Search activity logs"
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
            />
          </div>

          <select
            value={roleFilter}
            aria-label="Filter by role"
            onChange={(event) => {
              setRoleFilter(event.target.value);
              resetPage();
            }}
          >
            <option value="ALL">All Roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            aria-label="Filter by activity type"
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              resetPage();
            }}
          >
            <option value="ALL">All Activities</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map(
              (category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              )
            )}
          </select>

          <select
            value={timeFilter}
            aria-label="Filter by time"
            onChange={(event) => {
              setTimeFilter(event.target.value);
              resetPage();
            }}
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="logs-list">
          {loading ? (
            <p className="logs-empty">Loading activity…</p>
          ) : pageRows.length === 0 ? (
            <p className="logs-empty">
              {logs.length === 0
                ? "No activity has been recorded yet."
                : "No activity matches your search or filters."}
            </p>
          ) : (
            pageRows.map((log) => (
              <div className="log-item" key={log.id}>
                <div className="log-icon">
                  {log.actor.charAt(0).toUpperCase()}
                </div>

                <div className="log-main">
                  <div className="log-title">
                    <strong>{log.actor}</strong>

                    <span className="log-role">
                      {roleLabel(log.role)}
                    </span>

                    <span className="log-action">{log.action}</span>
                  </div>

                  <p>{log.description || "No description."}</p>

                  {log.details.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="log-details-toggle"
                        aria-expanded={openId === log.id}
                        onClick={() =>
                          setOpenId(openId === log.id ? "" : log.id)
                        }
                      >
                        {openId === log.id
                          ? "Hide details"
                          : "Show details"}
                      </button>

                      {openId === log.id && (
                        <dl className="log-details">
                          {log.details.map(([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </>
                  )}
                </div>

                <div className="log-time">
                  <strong>{formatDate(log.ms)}</strong>
                  <span>{formatTime(log.ms)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div className="logs-pagination">
            <span>
              Showing {pageStart + 1}–
              {Math.min(pageStart + PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>

            <div>
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                Previous
              </button>

              <span>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityLogs;
