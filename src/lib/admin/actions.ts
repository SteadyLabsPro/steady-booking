"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminToken, ADMIN_COOKIE } from "./auth";

export interface LoginState {
  error?: string;
}

/** Verify the admin password and set the session cookie. */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return { error: "Admin is not configured." };

  const token = adminToken();
  if (!token || password !== pw) return { error: "Incorrect password." };

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
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
