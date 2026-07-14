import { NextResponse } from "next/server";
import { generateSessions } from "@/lib/supabase/sessions";

export const dynamic = "force-dynamic";

/**
 * Rolling session generator. Vercel Cron hits this daily (see vercel.json) to
 * keep the availability window topped up. generateSessions() is idempotent, so
 * each run only inserts the newly-in-window day's slots.
 *
 * Secured with CRON_SECRET: Vercel automatically sends it as a Bearer token on
 * cron invocations when the env var is set. In dev (no secret) it's open so we
 * can trigger it locally.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await generateSessions();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error).message ?? e) },
      { status: 500 },
    );
  }
}
