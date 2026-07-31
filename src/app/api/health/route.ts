import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight health check for uptime monitors (UptimeRobot, Better Stack, …).
 * Confirms the app is up AND the database is reachable — so a monitor pinging
 * this catches a dead DB or broken deploy, not just "a page was served".
 * Returns 200 when healthy, 503 otherwise.
 */
export async function GET() {
  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("sessions")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json(
      { ok: true, service: "tidehouse", time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error).message ?? e) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
