/** Formats a peso amount for the document request wizard, e.g. ₱1,230. */
export function formatPeso(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "—";

  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
