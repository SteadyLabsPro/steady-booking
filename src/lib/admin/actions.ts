"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, sessionCookieValue, ADMIN_COOKIE } from "./auth";

export interface LoginState {
  error?: string;
}

/** Verify the admin credentials (email+password, or blank email for the shared
 * password) and set the session cookie. */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const identity = authenticate(email, password);
  if (identity === null) {
    return { error: "Incorrect email or password." };
  }
  const value = sessionCookieValue(identity);
  if (!value) return { error: "Admin is not configured." };

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  redirect("/admin");
}

/** Clear the admin session. */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0 });
  redirect("/admin/login");
}
