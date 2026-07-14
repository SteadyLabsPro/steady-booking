import { Resend } from "resend";
import { tenant } from "@/config/tenant.config";

/**
 * Resend adapter — the only email-provider-specific file. The rest of the app
 * calls sendEmail() with plain content. Built for test mode: with no key the
 * module imports fine and sends are skipped by callers via isEmailConfigured().
 */

let client: Resend | null = null;

function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  if (!client) client = new Resend(key);
  return client;
}

/** Whether a real Resend key is configured. */
export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return typeof key === "string" && key.startsWith("re_");
}

/** From address: RESEND_FROM env, else the tenant name + contact email. */
function fromAddress(): string {
  return process.env.RESEND_FROM ?? `${tenant.name} <${tenant.contactEmail}>`;
}

/** Rough plain-text fallback from HTML — a multipart/alternative text part
 * improves deliverability (spam filters distrust HTML-only mail). */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&middot;/gi, "·")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&rarr;/gi, "->")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim();
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  // The Resend SDK returns { data, error } rather than throwing on API errors
  // (e.g. an unverified from-domain), so surface those as thrown errors.
  const replyTo = tenant.replyToEmail ?? tenant.contactEmail;
  const { data, error } = await resend().emails.send({
    from: fromAddress(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: htmlToText(params.html),
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
  return { id: data?.id ?? "" };
}
