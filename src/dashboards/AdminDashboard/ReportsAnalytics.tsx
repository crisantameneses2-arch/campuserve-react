import { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { DOCUMENTS } from "../../constants/documents";

import "./ReportsAnalytics.css";

/* =====================================================
   TYPES
===================================================== */

type PeriodKey = "7" | "30" | "month" | "year";

type Range = {
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
  unit: "day" | "month";
  buckets: number;
  label: string;
  prevLabel: string;
};

type RequestItem = {
  id: string;
  requestId: string;
  status: string;
  createdMs: number;
};

type ReservationItem = {
  id: string;
  reservationId: string;
  status: string;
  createdMs: number;
  embedded: Record<string, unknown>[];
};

type Ranked = { name: string; count: number };

type Comparison = { current: number; previous: number };

/* =====================================================
   HELPERS
===================================================== */

const DAY = 24 * 60 * 60 * 1000;

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "30", label: "Last 30 Days" },
  { value: "7", label: "Last 7 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

const IN_PROGRESS = [
  "APPROVED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "RESCHEDULED",
];

const DOCUMENT_NAMES = new Map<string, string>(
  DOCUMENTS.map((item) => [item.id, item.name])
);

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMillis = (value: unknown): number =>
  value instanceof Timestamp ? value.toMillis() : 0;

const startOfDay = (ms: number) => {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

function getRange(key: PeriodKey): Range {
  const now = new Date();
  const today = startOfDay(now.getTime());

  if (key === "7" || key === "30") {
    const days = Number(key);
    const start = today - (days - 1) * DAY;

    return {
      start,
      end: today + DAY,
      prevStart: start - days * DAY,
      prevEnd: start,
      unit: "day",
      buckets: days,
      label: `Last ${days} days`,
      prevLabel: `previous ${days} days`,
    };
  }

  if (key === "month") {
    const year = now.getFullYear();
    const month = now.getMonth();

    return {
      start: new Date(year, month, 1).getTime(),
      end: new Date(year, month + 1, 1).getTime(),
      prevStart: new Date(year, month - 1, 1).getTime(),
      prevEnd: new Date(year, month, 1).getTime(),
      unit: "day",
      buckets: new Date(year, month + 1, 0).getDate(),
      label: now.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      }),
      prevLabel: "last month",
    };
  }

  const year = now.getFullYear();

  return {
    start: new Date(year, 0, 1).getTime(),
    end: new Date(year + 1, 0, 1).getTime(),
    prevStart: new Date(year - 1, 0, 1).getTime(),
    prevEnd: new Date(year, 0, 1).getTime(),
    unit: "month",
    buckets: 12,
    label: String(year),
    prevLabel: "last year",
  };
}

const inRange = (ms: number, start: number, end: number) =>
  ms >= start && ms < end;

function bucketIndex(ms: number, range: Range): number {
  if (range.unit === "month") return new Date(ms).getMonth();

  return Math.round((startOfDay(ms) - range.start) / DAY);
}

function bucketLabel(index: number, range: Range): string {
  if (range.unit === "month") {
    return new Date(2000, index, 1).toLocaleDateString("en-PH", {
      month: "short",
    });
  }

  const date = new Date(range.start + index * DAY);

  return range.buckets <= 7
    ? date.toLocaleDateString("en-PH", { weekday: "short" })
    : String(date.getDate());
}

function documentName(detail: Record<string, unknown>): string {
  const custom = text(detail.custom_document_name);
  if (custom) return custom;

  const type = text(detail.document_type);

  return DOCUMENT_NAMES.get(type.toLowerCase()) || type || "Document";
}

function topRanked(counts: Map<string, number>, size = 5): Ranked[] {
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, size);
}

function changeText(
  { current, previous }: Comparison,
  prevLabel: string
): string {
  if (previous === 0) {
    return current === 0
      ? `No activity in this or the ${prevLabel}`
      : `New activity (none in the ${prevLabel})`;
  }

  const pct = ((current - previous) / previous) * 100;

  if (Math.abs(pct) < 0.05) return `No change from ${prevLabel}`;

  return `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(
    1
  )}% from ${prevLabel}`;
}

/** Stops spreadsheet apps from running cells that begin with = + - @ */
function csvCell(value: unknown): string {
  let cell = String(value ?? "");

  if (/^[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }

  return `"${cell.replace(/"/g, '""')}"`;
}

/* =====================================================
   COMPONENT
===================================================== */

function ReportsAnalytics() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [requestDetails, setRequestDetails] = useState<
    Record<string, Record<string, unknown>[]>
  >({});
  const [reservations, setReservations] = useState<
    ReservationItem[]
  >([]);
  const [reservationDetails, setReservationDetails] = useState<
    Record<string, Record<string, unknown>[]>
  >({});
  const [activeStudents, setActiveStudents] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("30");

  /* ---------- live data ---------- */

  useEffect(() => {
    let requestsReady = false;
    let reservationsReady = false;

    const done = () => {
      if (requestsReady && reservationsReady) setLoading(false);
    };

    const fail = (label: string) => (e: { message: string }) => {
      setError(`Could not load ${label}: ${e.message}`);
      setLoading(false);
    };

    const unsubscribers = [
      onSnapshot(
        collection(db, "document_requests"),
        (snapshot) => {
          setRequests(
            snapshot.docs.map((item) => {
              const data = item.data();

              return {
                id: item.id,
                requestId: text(data.request_id) || item.id,
                status: text(data.status).toUpperCase(),
                createdMs:
                  toMillis(data.created_at) ||
                  toMillis(data.submitted_at),
              };
            })
          );
          setError("");
          requestsReady = true;
          done();
        },
        fail("document requests")
      ),

      onSnapshot(
        collection(db, "document_request_details"),
        (snapshot) => {
          const grouped: Record<string, Record<string, unknown>[]> =
            {};

          snapshot.docs.forEach((item) => {
            const data = item.data();
            const requestId = text(data.request_id);

            if (requestId) (grouped[requestId] ||= []).push(data);
          });

          setRequestDetails(grouped);
        },
        (e) => console.error("Could not load request details:", e)
      ),

      onSnapshot(
        collection(db, "itemReservations"),
        (snapshot) => {
          setReservations(
            snapshot.docs.map((item) => {
              const data = item.data();

              return {
                id: item.id,
                reservationId: text(data.reservationId) || item.id,
                status: text(data.status).toLowerCase(),
                createdMs: toMillis(data.createdAt),
                embedded: Array.isArray(data.items)
                  ? (data.items as Record<string, unknown>[])
                  : [],
              };
            })
          );
          setError("");
          reservationsReady = true;
          done();
        },
        fail("item reservations")
      ),

      onSnapshot(
        collection(db, "itemReservationDetails"),
        (snapshot) => {
          const grouped: Record<string, Record<string, unknown>[]> =
            {};

          snapshot.docs.forEach((item) => {
            const data = item.data();
            const reservationId = text(data.reservationId);

            if (reservationId)
              (grouped[reservationId] ||= []).push(data);
          });

          setReservationDetails(grouped);
        },
        (e) =>
          console.error("Could not load reservation items:", e)
      ),

      onSnapshot(
        collection(db, "accounts"),
        (snapshot) => {
          setActiveStudents(
            snapshot.docs.filter((item) => {
              const data = item.data();

              return (
                data.role === "student" && data.status === "active"
              );
            }).length
          );
        },
        (e) => console.error("Could not load accounts:", e)
      ),
    ];

    return () => unsubscribers.forEach((stop) => stop());
  }, []);

  /* ---------- report numbers ---------- */

  const report = useMemo(() => {
    const range = getRange(period);

    const inCurrent = (ms: number) =>
      inRange(ms, range.start, range.end);
    const inPrevious = (ms: number) =>
      inRange(ms, range.prevStart, range.prevEnd);

    const currentRequests = requests.filter((item) =>
      inCurrent(item.createdMs)
    );
    const currentReservations = reservations.filter((item) =>
      inCurrent(item.createdMs)
    );

    const isDone = (status: string) => status === "COMPLETED";
    const isClaimed = (status: string) => status === "claimed";

    const compare = (
      requestTest: (item: RequestItem) => boolean,
      reservationTest: (item: ReservationItem) => boolean
    ) => ({
      current:
        requests.filter(
          (item) => inCurrent(item.createdMs) && requestTest(item)
        ).length +
        reservations.filter(
          (item) =>
            inCurrent(item.createdMs) && reservationTest(item)
        ).length,
      previous:
        requests.filter(
          (item) => inPrevious(item.createdMs) && requestTest(item)
        ).length +
        reservations.filter(
          (item) =>
            inPrevious(item.createdMs) && reservationTest(item)
        ).length,
    });

    const requestComparison: Comparison = {
      current: currentRequests.length,
      previous: requests.filter((item) => inPrevious(item.createdMs))
        .length,
    };

    const reservationComparison: Comparison = {
      current: currentReservations.length,
      previous: reservations.filter((item) =>
        inPrevious(item.createdMs)
      ).length,
    };

    const completedComparison = compare(
      (item) => isDone(item.status),
      (item) => isClaimed(item.status)
    );

    // Chart: requests per day (or per month for a year).
    const series = new Array<number>(range.buckets).fill(0);

    currentRequests.forEach((item) => {
      const index = bucketIndex(item.createdMs, range);
      if (index >= 0 && index < series.length) series[index] += 1;
    });

    // Status breakdown of requests in the period.
    const statusCounts = {
      completed: currentRequests.filter((item) =>
        isDone(item.status)
      ).length,
      inProgress: currentRequests.filter((item) =>
        IN_PROGRESS.includes(item.status)
      ).length,
      pending: currentRequests.filter(
        (item) => item.status === "PENDING"
      ).length,
      closed: currentRequests.filter((item) =>
        ["DECLINED", "CANCELLED"].includes(item.status)
      ).length,
    };

    // Most requested documents.
    const documentCounts = new Map<string, number>();

    currentRequests.forEach((item) => {
      (requestDetails[item.requestId] ||
        requestDetails[item.id] ||
        []
      ).forEach((detail) => {
        const name = documentName(detail);

        documentCounts.set(
          name,
          (documentCounts.get(name) || 0) + (num(detail.quantity) || 1)
        );
      });
    });

    // Most reserved items.
    const itemCounts = new Map<string, number>();

    currentReservations.forEach((item) => {
      const lines =
        item.embedded.length > 0
          ? item.embedded
          : reservationDetails[item.reservationId] || [];

      lines.forEach((line) => {
        const name = text(line.itemName) || "Item";

        itemCounts.set(
          name,
          (itemCounts.get(name) || 0) + (num(line.quantity) || 1)
        );
      });
    });

    return {
      range,
      requestComparison,
      reservationComparison,
      completedComparison,
      series,
      statusCounts,
      statusTotal: currentRequests.length,
      topDocuments: topRanked(documentCounts),
      topItems: topRanked(itemCounts),
    };
  }, [
    period,
    requests,
    requestDetails,
    reservations,
    reservationDetails,
  ]);

  const { range } = report;
  const maxBar = Math.max(...report.series, 0);
  const labelEvery = range.buckets > 14 ? 5 : 1;

  const percent = (count: number) =>
    report.statusTotal === 0
      ? "0%"
      : `${Math.round((count / report.statusTotal) * 100)}%`;

  const exportReport = () => {
    const rows: [string, string, string | number][] = [
      ["Period", range.label, ""],
      ["Summary", "Document requests", report.requestComparison.current],
      [
        "Summary",
        "Item reservations",
        report.reservationComparison.current,
      ],
      [
        "Summary",
        "Completed transactions",
        report.completedComparison.current,
      ],
      ["Summary", "Active students", activeStudents],
      ["Request status", "Completed", report.statusCounts.completed],
      ["Request status", "In progress", report.statusCounts.inProgress],
      ["Request status", "Pending", report.statusCounts.pending],
      [
        "Request status",
        "Declined / cancelled",
        report.statusCounts.closed,
      ],
      ...report.series.map(
        (count, index): [string, string, number] => [
          "Requests over time",
          bucketLabel(index, range),
          count,
        ]
      ),
      ...report.topDocuments.map(
        (item): [string, string, number] => [
          "Most requested documents",
          item.name,
          item.count,
        ]
      ),
      ...report.topItems.map(
        (item): [string, string, number] => [
          "Most reserved items",
          item.name,
          item.count,
        ]
      ),
    ];

    const csv =
      "\ufeff" +
      [
        ["Section", "Label", "Value"].map(csvCell).join(","),
        ...rows.map((row) => row.map(csvCell).join(",")),
      ].join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `campuserve-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>Reports & Analytics</h1>
          <p>
            Requests, reservations and usage for {range.label}.
            Counted by the date each one was submitted.
          </p>
        </div>

        <div className="reports-actions">
          <select
            value={period}
            aria-label="Report period"
            onChange={(event) =>
              setPeriod(event.target.value as PeriodKey)
            }
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={exportReport}
            disabled={loading}
          >
            Export Report
          </button>
        </div>
      </div>

      {error && (
        <div className="reports-error" role="alert">
          {error}
        </div>
      )}

      <div className="reports-summary">
        <div className="report-stat-card">
          <span>Document Requests</span>
          <strong>
            {loading ? "…" : report.requestComparison.current}
          </strong>
          <small>
            {loading
              ? "Loading…"
              : changeText(report.requestComparison, range.prevLabel)}
          </small>
        </div>

        <div className="report-stat-card">
          <span>Item Reservations</span>
          <strong>
            {loading ? "…" : report.reservationComparison.current}
          </strong>
          <small>
            {loading
              ? "Loading…"
              : changeText(
                  report.reservationComparison,
                  range.prevLabel
                )}
          </small>
        </div>

        <div className="report-stat-card">
          <span>Completed Transactions</span>
          <strong>
            {loading ? "…" : report.completedComparison.current}
          </strong>
          <small>
            {loading
              ? "Loading…"
              : changeText(
                  report.completedComparison,
                  range.prevLabel
                )}
          </small>
        </div>

        <div className="report-stat-card">
          <span>Active Students</span>
          <strong>{loading ? "…" : activeStudents}</strong>
          <small>Current active accounts</small>
        </div>
      </div>

      <div className="reports-grid">
        <div className="report-chart-card large">
          <div className="report-card-header">
            <div>
              <h2>Requests Overview</h2>
              <p>
                Document requests submitted{" "}
                {range.unit === "month" ? "each month" : "each day"}
                .
              </p>
            </div>
          </div>

          <div className="mock-chart">
            {maxBar === 0 ? (
              <p className="reports-empty">
                {loading
                  ? "Loading…"
                  : "No document requests in this period."}
              </p>
            ) : (
              <>
                <div
                  className={`chart-bars ${
                    range.buckets > 12 ? "dense" : ""
                  }`}
                >
                  {report.series.map((count, index) => (
                    <div
                      key={index}
                      style={{
                        height: `${
                          count === 0
                            ? 0
                            : Math.max((count / maxBar) * 100, 4)
                        }%`,
                      }}
                      title={`${bucketLabel(index, range)}: ${count} request${
                        count === 1 ? "" : "s"
                      }`}
                    />
                  ))}
                </div>

                <div
                  className={`chart-labels ${
                    range.buckets > 12 ? "dense" : ""
                  }`}
                  style={{
                    gridTemplateColumns: `repeat(${range.buckets}, 1fr)`,
                  }}
                >
                  {report.series.map((_, index) => (
                    <span key={index}>
                      {index % labelEvery === 0
                        ? bucketLabel(index, range)
                        : ""}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="report-chart-card">
          <div className="report-card-header">
            <h2>Request Status</h2>
          </div>

          <div className="status-report">
            <div>
              <span>Completed</span>
              <strong>
                {percent(report.statusCounts.completed)}
                <small> ({report.statusCounts.completed})</small>
              </strong>
            </div>

            <div>
              <span>In progress</span>
              <strong>
                {percent(report.statusCounts.inProgress)}
                <small> ({report.statusCounts.inProgress})</small>
              </strong>
            </div>

            <div>
              <span>Pending</span>
              <strong>
                {percent(report.statusCounts.pending)}
                <small> ({report.statusCounts.pending})</small>
              </strong>
            </div>

            <div>
              <span>Declined / cancelled</span>
              <strong>
                {percent(report.statusCounts.closed)}
                <small> ({report.statusCounts.closed})</small>
              </strong>
            </div>
          </div>
        </div>

        <div className="report-chart-card">
          <div className="report-card-header">
            <h2>Most Requested Documents</h2>
          </div>

          <div className="ranking-list">
            {report.topDocuments.length === 0 ? (
              <p className="reports-empty">
                No documents requested in this period.
              </p>
            ) : (
              report.topDocuments.map((item, index) => (
                <div key={item.name}>
                  <span>{index + 1}</span>
                  <p>{item.name}</p>
                  <strong>{item.count}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="report-chart-card">
          <div className="report-card-header">
            <h2>Most Reserved Items</h2>
          </div>

          <div className="ranking-list">
            {report.topItems.length === 0 ? (
              <p className="reports-empty">
                No items reserved in this period.
              </p>
            ) : (
              report.topItems.map((item, index) => (
                <div key={item.name}>
                  <span>{index + 1}</span>
                  <p>{item.name}</p>
                  <strong>{item.count}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsAnalytics;