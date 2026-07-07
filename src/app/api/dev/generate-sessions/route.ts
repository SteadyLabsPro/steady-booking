import { NextResponse } from "next/server";
import { generateSessions } from "@/lib/supabase/sessions";

/**
 * Temporary bootstrap endpoint to generate the rolling session window from
 * config rules. Disabled in production — a properly gated generator (Admin /
 * cron) replaces this later. POST to trigger.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, {
      status: 403,
    });
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
