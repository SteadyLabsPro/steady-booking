import { isAdmin } from "@/lib/admin/auth";
import { qrSvg, qrPngBuffer } from "@/lib/qr/generate";

/**
 * QR image endpoint: /admin/tools/qr/image?data=<text>&format=svg|png&size=<px>
 * Admin-only. Reusable for any encoded data. Downloads are named client-side
 * via the anchor's `download` attribute.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");
  if (!data) {
    return new Response("Missing 'data'", { status: 400 });
  }

  // Brand navy modules, or plain black.
  const dark = searchParams.get("branded") === "1" ? "#173a4e" : "#000000";

  if (searchParams.get("format") === "svg") {
    const svg = await qrSvg(data, dark);
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }

  const size = Math.min(4096, Math.max(256, Number(searchParams.get("size")) || 2048));
  const png = await qrPngBuffer(data, size, dark);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
