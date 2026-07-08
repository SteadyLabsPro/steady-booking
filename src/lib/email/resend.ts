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

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await resend().emails.send({
    from: fromAddress(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
