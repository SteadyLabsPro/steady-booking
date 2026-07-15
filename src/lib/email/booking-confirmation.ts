import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { formatPrice, formatSessionDate, formatSessionTime } from "@/engine";
import { isEmailConfigured, sendEmail } from "./resend";
import { accessNoticeHtml } from "./blocks";

interface ConfirmationData {
  firstName: string;
  startsAt: string;
  guests: number;
  totalMinor: number;
  bookingRef: string;
  /** Set when the booking was paid with pass credits rather than money. */
  pass?: { creditsUsed: number; remaining: number };
}

/** Pure renderer — inline-styled HTML for broad email-client support. */
export function renderBookingConfirmation(d: ConfirmationData): {
  subject: string;
  html: string;
} {
  const date = formatSessionDate(d.startsAt, tenant.timezone);
  const time = formatSessionTime(d.startsAt, tenant.timezone);
  const total = formatPrice(d.totalMinor, tenant.currency);
  // Leads with the access code — guests can't get in without collecting it.
  const subject = "Access Code & Booking Confirmation";

  const cell = "padding:8px 0;color:#6f6a62;";
  const val = "padding:8px 0;text-align:right;font-weight:600;";
  const top = "border-top:1px solid #e7e1d6;";

  // Paid with credits: show what was used and what's left, not a £0.00 total.
  const plural = (n: number) => (n === 1 ? "credit" : "credits");
  const payment = d.pass
    ? `<tr><td style="${cell}${top}padding-top:12px;">Paid with</td><td style="${val}${top}padding-top:12px;">Your pass &middot; ${d.pass.creditsUsed} ${plural(d.pass.creditsUsed)} used</td></tr>
          <tr><td style="${cell}">Credits remaining</td><td style="${val}">${d.pass.remaining} ${plural(d.pass.remaining)}</td></tr>`
    : `<tr><td style="${cell}${top}padding-top:12px;">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:700;${top}">${total}</td></tr>`;

  const html = `
  <div style="background:#f5eee6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#211f1c;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e1d6;border-radius:12px;overflow:hidden;">
      <div style="background:#173a4e;padding:24px;text-align:center;">
        <div style="color:#f7f4ef;font-size:18px;letter-spacing:2px;font-weight:600;">${tenant.name.toUpperCase()}</div>
        <div style="color:#c2a06a;font-size:11px;letter-spacing:2px;margin-top:4px;">${tenant.descriptor.toUpperCase()}</div>
      </div>
      <div style="padding:28px 24px;">
        <h1 style="font-size:20px;margin:0 0 8px;">You&rsquo;re booked, ${d.firstName}</h1>
        <p style="color:#6f6a62;font-size:14px;margin:0 0 20px;">Your session is confirmed. We look forward to seeing you.</p>
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6f6a62;">When</td><td style="padding:8px 0;text-align:right;font-weight:600;">${date} &middot; ${time}</td></tr>
          <tr><td style="padding:8px 0;color:#6f6a62;">Guests</td><td style="padding:8px 0;text-align:right;font-weight:600;">${d.guests}</td></tr>
          <tr><td style="padding:8px 0;color:#6f6a62;">Where</td><td style="padding:8px 0;text-align:right;font-weight:600;">${tenant.address}</td></tr>
          ${payment}
        </table>
        <p style="color:#9a948b;font-size:12px;margin:20px 0 0;">Booking reference ${d.bookingRef}</p>

        <!-- Access code — guests can't get in without this, so make it loud. -->
        ${accessNoticeHtml("booking")}
      </div>
      <div style="padding:16px 24px;background:#f5eee6;text-align:center;color:#6f6a62;font-size:12px;">
        ${tenant.name} &middot; ${tenant.address}
      </div>
    </div>
  </div>`;

  return { subject, html };
}

/** Fetch a booking and email the customer their confirmation. No-op if email
 * isn't configured. Never throws — email failure must not break a booking. */
export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bookings")
      .select(
        `quantity, total_minor, pass_id,
         customers ( first_name, email ),
         sessions ( starts_at ),
         passes ( remaining_credits )`,
      )
      .eq("id", bookingId)
      .maybeSingle();

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const row = data as any;
    const email = row?.customers?.email;
    const startsAt = row?.sessions?.starts_at;
    if (!email || !startsAt) return;

    // Redemptions are sent after the credit is deducted, so remaining_credits
    // is already the post-booking balance.
    const pass =
      row.pass_id && row.passes
        ? {
            creditsUsed: row.quantity,
            remaining: row.passes.remaining_credits ?? 0,
          }
        : undefined;

    const { subject, html } = renderBookingConfirmation({
      firstName: row.customers.first_name || "there",
      startsAt,
      guests: row.quantity,
      totalMinor: row.total_minor,
      pass,
      bookingRef: bookingId.slice(0, 8),
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    await sendEmail({ to: email, subject, html });
  } catch (e) {
    console.error("[email] booking confirmation failed:", e);
  }
}
