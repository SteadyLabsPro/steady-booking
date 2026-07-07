import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

/**
 * Simple shared-password admin auth. On login we set an httpOnly cookie whose
 * value is an HMAC keyed by ADMIN_PASSWORD, so it can be verified statelessly
 * (no DB sessions). Server-only — never import into a client component.
 */

export const ADMIN_COOKIE = "admin_session";
const MESSAGE = "tide-admin-v1";

/** The expected cookie token for the configured password, or null if unset. */
export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return crypto.createHmac("sha256", pw).update(MESSAGE).digest("hex");
}

/** Whether the current request carries a valid admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const expected = adminToken();
  if (!expected) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token || token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Redirect to the login page unless the request is authenticated. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
