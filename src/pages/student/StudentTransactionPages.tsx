import { useMemo, useState } from "react";
import { formatClaimDate, normalizeStatus, statusLabel } from "../../utils/format";
import type { StudentTransaction } from "../../dashboards/StudentDashboard/StudentDashboard";

type TypeFilter = "ALL" | "DOCUMENT" | "ITEM";
type PendingStatus = "ALL" | "PENDING" | "RESCHEDULED";
type HistoryStatus =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "DECLINED";

export function MyRequests({
  transactions,
  loading,
}: {
  transactions: StudentTransaction[];
  loading: boolean;
}) {
  const [type, setType] = useState<TypeFilter>("ALL");
  const [status, setStatus] = useState<PendingStatus>("ALL");

  const rows = useMemo(() => transactions.filter((tx) => {
    const normalized = normalizeStatus(tx.status);
    return (
      (normalized === "PENDING" || normalized === "RESCHEDULED") &&
      (type === "ALL" || tx.kind === type) &&
      (status === "ALL" || normalized === status)
    );
  }), [transactions, type, status]);

  return (
    <section className="page-card">
      <div className="page-heading">
        <span className="section-kicker">MY REQUESTS</span>
        <h1>My Requests</h1>
        <p>Current document requests and item reservations that still need action or scheduling.</p>
      </div>

      <FilterBar
        type={type}
        setType={setType}
        status={status}
        setStatus={setStatus}
        statuses={["ALL", "PENDING", "RESCHEDULED"]}
      />

      {loading ? <Loading /> : rows.length === 0 ? (
        <Empty text="You don't have any pending or rescheduled requests matching these filters." />
      ) : (
        <div className="recent-transaction-list">
          {rows.map((tx) => <TransactionCard key={tx.key} transaction={tx} />)}
        </div>
      )}
    </section>
  );
}

export function HistoryTransactions({
  transactions,
  loading,
}: {
  transactions: StudentTransaction[];
  loading: boolean;
}) {
  const [type, setType] = useState<TypeFilter>("ALL");
  const [status, setStatus] = useState<HistoryStatus>("ALL");

  const rows = useMemo(() => transactions.filter((tx) => {
    const normalized = normalizeStatus(tx.status);
    return (
      (type === "ALL" || tx.kind === type) &&
      (status === "ALL" || normalized === status)
    );
  }), [transactions, type, status]);

  return (
    <section className="page-card">
      <div className="page-heading">
        <span className="section-kicker">HISTORY TRANSACTIONS</span>
        <h1>History Transactions</h1>
        <p>All document requests and item reservations, including their current or completed status.</p>
      </div>

      <FilterBar
        type={type}
        setType={setType}
        status={status}
        setStatus={setStatus}
        statuses={["ALL", "PENDING", "PROCESSING", "READY_FOR_PICKUP", "COMPLETED", "RESCHEDULED", "CANCELLED", "DECLINED"]}
      />

      {loading ? <Loading /> : rows.length === 0 ? (
        <Empty text="No document or item transactions match these filters." />
      ) : (
        <div className="recent-transaction-list">
          {rows.map((tx) => <TransactionCard key={tx.key} transaction={tx} />)}
        </div>
      )}
    </section>
  );
}

function FilterBar({
  type,
  setType,
  status,
  setStatus,
  statuses,
}: any) {
  return (
    <div className="transaction-filters">
      <div className="transaction-filter-group">
        <span className="transaction-filter-label">Type</span>
        <div className="transaction-filter-buttons">
          {(["ALL", "DOCUMENT", "ITEM"] as TypeFilter[]).map((value) => (
            <button key={value} type="button" className={`transaction-filter ${type === value ? "active" : ""}`} onClick={() => setType(value)}>
              {value === "ALL" ? "All" : value === "DOCUMENT" ? "Document" : "Item"}
            </button>
          ))}
        </div>
      </div>

      <div className="transaction-filter-group">
        <span className="transaction-filter-label">Status</span>
        <div className="transaction-filter-buttons">
          {statuses.map((value: string) => (
            <button key={value} type="button" className={`transaction-filter ${status === value ? "active" : ""}`} onClick={() => setStatus(value)}>
              {value === "ALL" ? "All" : statusLabel(value)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionCard({ transaction }: { transaction: StudentTransaction }) {
  const normalized = normalizeStatus(transaction.status);
  return (
    <div className="transaction-row">
      <span className="transaction-row__icon">{transaction.kind === "DOCUMENT" ? "▤" : "▣"}</span>
      <div className="transaction-row__main">
        <strong>{transaction.title}</strong>
        <span>{transaction.kind === "DOCUMENT" ? "Document Request" : "Item Reservation"} · ID {transaction.id}</span>
        {transaction.date && <small>{formatClaimDate(transaction.date)}{transaction.time ? ` · ${transaction.time}` : ""}</small>}
      </div>
      <span className={`status-badge status-badge--${normalized.toLowerCase()}`}>{statusLabel(normalized)}</span>
    </div>
  );
}

function Loading() {
  return <div className="dashboard-loading"><span className="dashboard-spinner" /><span>Loading...</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty-widget"><strong>No matching transactions</strong><p>{text}</p></div>;
}
