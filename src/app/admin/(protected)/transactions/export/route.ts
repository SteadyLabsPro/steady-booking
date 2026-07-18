import { isAdmin } from "@/lib/admin/auth";
import {
  getAdminTransactions,
  filterTransactions,
  isDateKey,
  todayKey,
} from "@/lib/admin/transactions";
import { tenant } from "@/config/tenant.config";
import { sessionDateKey, formatSessionTime } from "@/engine";

/**
 * CSV export of transactions in a payment-date range.
 * GET /admin/transactions/export?from=YYYY-MM-DD&to=YYYY-MM-DD — admin only.
 * Amounts are plain numbers (no symbol) so Excel treats them as currency.
 */

function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? todayKey();
  const to = searchParams.get("to") ?? from;
  if (!isDateKey(from) || !isDateKey(to) || from > to) {
    return new Response("Invalid date range", { status: 400 });
  }

  const tz = tenant.timezone;
  // Same free-text filter as the page, so the CSV matches what's on screen.
  const rows = filterTransactions(
    await getAdminTransactions(from, to),
    searchParams.get("q"),
  );

  const header = [
    "Date",
    "Time",
    "Type",
    "Customer",
    "Email",
    "Phone",
    "Session date",
    "Session time",
    "Qty",
    "Amount",
    "Refunded",
    "Net",
    "Currency",
    "Payment",
    "Status",
    "Reference",
    "Stripe ref",
    "Refund ref",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        sessionDateKey(r.occurredAt, tz),
        formatSessionTime(r.occurredAt, tz),
        r.kind === "pass" ? "Pass sale" : "Booking",
        r.customerName,
        r.email,
        r.phone,
        r.sessionStartsAt ? sessionDateKey(r.sessionStartsAt, tz) : "",
        r.sessionStartsAt ? formatSessionTime(r.sessionStartsAt, tz) : "",
        r.quantity,
        (r.amountMinor / 100).toFixed(2),
        (r.refundedMinor / 100).toFixed(2),
        ((r.amountMinor - r.refundedMinor) / 100).toFixed(2),
        tenant.currency,
        r.paymentStatus,
        r.status,
        r.reference,
        r.stripeRef,
        r.refundRef,
      ]
        .map(cell)
        .join(","),
    );
  }

  // Leading BOM so Excel reads UTF-8 (accents, £) correctly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const name =
    from === to
      ? `transactions-${from}.csv`
      : `transactions-${from}_to_${to}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
