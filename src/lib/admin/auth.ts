import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

/**
 * Admin auth. Two ways in, both stateless (no DB sessions):
 *  - Named users via ADMIN_USERS (JSON: [{ "email", "password" }]) — each logs
 *    in with their email + password (e.g. the venue owner).
 *  - A legacy shared password via ADMIN_PASSWORD — email left blank.
 *
 * The session cookie is `<base64url(identity)>.<HMAC(password, msg:identity)>`,
 * so it's signed with that identity's own password: removing a user from
 * ADMIN_USERS (or changing their password) instantly invalidates their cookie,
 * without affecting anyone else. Server-only — never import client-side.
 */

export const ADMIN_COOKIE = "admin_session";
const MESSAGE = "tide-admin-v1";

interface AdminUser {
  email: string;
  password: string;
}

function adminUsers(): AdminUser[] {
  const raw = process.env.ADMIN_USERS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (u) =>
          u &&
          typeof u.email === "string" &&
          typeof u.password === "string" &&
          u.email.trim() &&
          u.password,
      )
      .map((u) => ({ email: u.email.trim().toLowerCase(), password: u.password }));
  } catch {
    return [];
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/** The password for an identity ("" = legacy shared login), or null if unknown. */
function passwordForIdentity(identity: string): string | null {
  if (identity === "") return process.env.ADMIN_PASSWORD ?? null;
  return adminUsers().find((u) => u.email === identity)?.password ?? null;
}

function tokenFor(identity: string, password: string): string {
  return crypto
    .createHmac("sha256", password)
    .update(`${MESSAGE}:${identity}`)
    .digest("hex");
}

/** Validate an email+password login; returns the identity to sign, or null. */
export function authenticate(email: string, password: string): string | null {
  const id = email.trim().toLowerCase();
  if (id) {
    const user = adminUsers().find((u) => u.email === id);
    return user && safeEqual(user.password, password) ? id : null;
  }
  const shared = process.env.ADMIN_PASSWORD;
  return shared && safeEqual(shared, password) ? "" : null;
}

/** Cookie value to set for an authenticated identity. */
export function sessionCookieValue(identity: string): string | null {
  const pw = passwordForIdentity(identity);
  if (pw == null) return null;
  const idB64 = Buffer.from(identity, "utf8").toString("base64url");
  return `${idB64}.${tokenFor(identity, pw)}`;
}

/** Whether the current request carries a valid admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw || !raw.includes(".")) return false;
  const [idB64, token] = raw.split(".");
  let identity: string;
  try {
    identity = Buffer.from(idB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const pw = passwordForIdentity(identity);
  if (pw == null) return false; // identity removed / revoked
  return safeEqual(token, tokenFor(identity, pw));
}

/** Redirect to the login page unless the request is authenticated. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
