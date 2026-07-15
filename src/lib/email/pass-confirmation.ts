import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { formatPrice } from "@/engine";
import { isEmailConfigured, sendEmail } from "./resend";
import { accessNoticeHtml } from "./blocks";

interface PassData {
  firstName: string;
  credits: number;
  pricePaidMinor: number;
  expiresAt: string | null;
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Pure renderer — inline-styled HTML for broad email-client support. */
export function renderPassConfirmation(d: PassData): {
  subject: string;
  html: string;
} {
  const paid = formatPrice(d.pricePaidMinor, tenant.currency);
  const expiry = formatExpiry(d.expiresAt);
  const subject = `Your ${tenant.name} pass — ${d.credits} visits`;

  const expiryRow = expiry
    ? `<tr><td style="padding:8px 0;color:#6f6a62;">Valid until</td><td style="padding:8px 0;text-align:right;font-weight:600;">${expiry}</td></tr>`
    : "";

  const html = `
  <div style="background:#f5eee6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#211f1c;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e1d6;border-radius:12px;overflow:hidden;">
      <div style="background:#173a4e;padding:24px;text-align:center;">
        <div style="color:#f7f4ef;font-size:18px;letter-spacing:2px;font-weight:600;">${tenant.name.toUpperCase()}</div>
        <div style="color:#c2a06a;font-size:11px;letter-spacing:2px;margin-top:4px;">${tenant.descriptor.toUpperCase()}</div>
      </div>
      <div style="padding:28px 24px;">
        <h1 style="font-size:20px;margin:0 0 8px;">Your pass is ready, ${d.firstName}</h1>
        <p style="color:#6f6a62;font-size:14px;margin:0 0 20px;">Thank you. Your visits are on your account — just book with this email address and choose &ldquo;Use pass&rdquo;.</p>
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6f6a62;">Visits</td><td style="padding:8px 0;text-align:right;font-weight:600;">${d.credits} credits</td></tr>
          ${expiryRow}
          <tr><td style="padding:12px 0 0;color:#6f6a62;border-top:1px solid #e7e1d6;">Paid</td><td style="padding:12px 0 0;text-align:right;font-weight:700;border-top:1px solid #e7e1d6;">${paid}</td></tr>
        </table>
        <p style="color:#9a948b;font-size:12px;margin:20px 0 0;">1 credit = 1 person-session. Use them for yourself or bring guests.</p>

        <!-- Access code — framed for a pass (no session booked yet). -->
        ${accessNoticeHtml("pass")}
      </div>
      <div style="padding:16px 24px;background:#f5eee6;text-align:center;color:#6f6a62;font-size:12px;">
        ${tenant.name} &middot; ${tenant.address}
      </div>
    </div>
  </div>`;

  return { subject, html };
}

/** Fetch a pass and email the buyer their confirmation. No-op if email isn't
 * configured. Never throws — email failure must not break a purchase. */
export async function sendPassConfirmation(passId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("passes")
      .select(
        "total_credits, price_paid_minor, expires_at, customers ( first_name, email )",
      )
      .eq("id", passId)
      .maybeSingle();

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const row = data as any;
    const email = row?.customers?.email;
    if (!email) return;

    const { subject, html } = renderPassConfirmation({
      firstName: row.customers.first_name || "there",
      credits: row.total_credits,
      pricePaidMinor: row.price_paid_minor,
      expiresAt: row.expires_at,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    await sendEmail({ to: email, subject, html });
  } catch (e) {
    console.error("[email] pass confirmation failed:", e);
  }
}
