import type { ReceiptData, ReceiptLine } from "./DigitalReceipt";

/*
 * Draws the digital receipt as a PNG and downloads it.
 * Plain <canvas> drawing, so no extra library is needed and it works the
 * same on phones and laptops. The layout mirrors the on-screen receipt.
 */

const W = 760; // image width in px (drawn at 2× for sharp text)
const PAD = 56;
const INK = "#2d3640";
const MUTED = "#7b8794";
const PAPER = "#fbfaf6";
const MONO = '"Courier New", Courier, ui-monospace, monospace';

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = String(text || "").split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function drawReceipt(
  receipt: ReceiptData,
  lines: ReceiptLine[],
  paidAt: Date | null
): HTMLCanvasElement {
  // Draw on a tall scratch canvas, then crop to the used height.
  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = 4000;

  const ctx = scratch.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't create the receipt image.");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, scratch.height);
  ctx.textBaseline = "top";

  let y = 56;
  const right = W - PAD;
  const isDocument = receipt.kind === "DOCUMENT";

  const center = (text: string, font: string, color = INK, spacing = 0) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    if (spacing) {
      // simple letter spacing
      const chars = text.split("");
      const width = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, -spacing);
      let x = W / 2 - width / 2;
      ctx.textAlign = "left";
      for (const ch of chars) {
        ctx.fillText(ch, x, y);
        x += ctx.measureText(ch).width + spacing;
      }
    } else {
      ctx.fillText(text, W / 2, y);
    }
  };

  const rule = () => {
    ctx.strokeStyle = "#b9c0c8";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 26;
  };

  const row = (label: string, value: string) => {
    ctx.font = `24px ${MONO}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.fillText(label, PAD, y);

    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    const valueLines = wrap(ctx, value, (right - PAD) * 0.58);
    valueLines.forEach((line, index) => ctx.fillText(line, right, y + index * 32));
    y += Math.max(1, valueLines.length) * 32 + 8;
  };

  // ---- header ----
  center("CAMPUSERVE", `bold 40px ${MONO}`, INK, 8);
  y += 54;
  center("Pangasinan State University · Lingayen", `20px ${MONO}`, MUTED);
  y += 44;

  ctx.font = `26px ${MONO}`;
  const title = "PAYMENT RECEIPT";
  const titleWidth = ctx.measureText(title).width + 60;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(W / 2 - titleWidth / 2, y - 10, titleWidth, 52);
  center(title, `26px ${MONO}`, INK, 4);
  y += 70;

  // ---- meta ----
  row("Receipt no.", receipt.receiptNumber || "—");
  row("Date", formatDate(paidAt));
  row("Received from", receipt.studentName || "—");
  row("Student ID", receipt.studentId || "—");
  row(isDocument ? "Request" : "Reservation", receipt.referenceId || "—");
  y += 6;
  rule();

  // ---- lines ----
  const items: ReceiptLine[] = lines.length
    ? lines
    : [{ label: isDocument ? "Document request" : "Item reservation", amount: receipt.amount }];

  for (const line of items) {
    ctx.font = `25px ${MONO}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    const labelLines = wrap(ctx, line.label, (right - PAD) * 0.66);
    labelLines.forEach((text, index) => ctx.fillText(text, PAD, y + index * 32));

    ctx.textAlign = "right";
    ctx.fillText(peso(line.amount), right, y);
    y += labelLines.length * 32;

    if (line.detail) {
      ctx.font = `21px ${MONO}`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = "left";
      ctx.fillText(line.detail, PAD, y + 2);
      y += 30;
    }
    y += 14;
  }

  rule();

  // ---- total ----
  ctx.font = `26px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.fillText("TOTAL PAID", PAD, y + 8);
  ctx.font = `bold 40px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(peso(receipt.amount), right, y);
  y += 66;

  row("Paid at", "Cashier's Office");
  if (receipt.cashierName) row("Received by", receipt.cashierName);
  if (receipt.paymentStubCode) row("Payment stub", receipt.paymentStubCode);
  if (!isDocument && receipt.claimCode) row("Claim code", receipt.claimCode);
  y += 6;
  rule();

  // ---- footer ----
  const footerTop = y;
  ctx.font = `22px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  const note = isDocument
    ? "Your request is now in the Registrar's processing queue. We'll notify you when it's ready for claiming."
    : "Your reservation is paid. Show your claim code when you pick up your items.";
  for (const line of wrap(ctx, note, right - PAD)) {
    ctx.fillText(line, W / 2, y);
    y += 30;
  }
  y += 18;
  center("Thank you!", `bold 28px ${MONO}`, INK, 2);
  y += 60;

  // ---- PAID stamp ----
  ctx.save();
  ctx.translate(right - 120, footerTop + 40);
  ctx.rotate(-0.22);
  ctx.globalAlpha = 0.78;
  ctx.strokeStyle = "#c0392b";
  ctx.fillStyle = "#c0392b";
  ctx.lineWidth = 5;
  ctx.strokeRect(-92, -38, 184, 76);
  ctx.font = `bold 50px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAID", 0, 2);
  ctx.restore();

  // ---- crop + torn edge ----
  const out = document.createElement("canvas");
  out.width = W;
  out.height = y + 20;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Your browser couldn't create the receipt image.");
  outCtx.drawImage(scratch, 0, 0);

  // zig-zag bottom edge
  outCtx.globalCompositeOperation = "destination-out";
  outCtx.beginPath();
  const tooth = 16;
  outCtx.moveTo(0, out.height);
  for (let x = 0; x <= W; x += tooth) {
    outCtx.lineTo(x, out.height - (x / tooth) % 2 * 10);
  }
  outCtx.lineTo(W, out.height);
  outCtx.closePath();
  outCtx.fill();

  return out;
}

/** Downloads the receipt as "CampuServe-Receipt-<number>.png". */
export async function downloadReceiptImage(
  receipt: ReceiptData,
  lines: ReceiptLine[],
  paidAt: Date | null
) {
  const canvas = drawReceipt(receipt, lines, paidAt);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Your browser couldn't save the receipt image.");

  const safeName = String(receipt.receiptNumber || receipt.referenceId || "receipt")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .slice(0, 60);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CampuServe-Receipt-${safeName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
