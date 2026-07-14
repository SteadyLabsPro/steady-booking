import QRCode from "qrcode";
import sharp from "sharp";

/**
 * Reusable QR generation with a centred "TH" monogram. High error correction
 * (H, ~30% recovery) means the small centre badge doesn't break scanning. The
 * monogram is drawn as vector rects (not text), so it renders identically in
 * any SVG/PNG renderer with no font dependency. `dark` sets the module + badge
 * colour (brand navy for branded codes), always on white for max contrast.
 */

const BASE = {
  errorCorrectionLevel: "H" as const,
  margin: 4,
};

/** A centred white badge with a vector "TH" monogram, sized to the QR grid. */
function centreMonogram(n: number, color: string): string {
  const c = n / 2;
  const badge = n * 0.25; // badge width (~6% of area — safe at level H)
  const rad = n * 0.028;
  const hM = badge * 0.5; // monogram height
  const wM = badge * 0.64; // monogram width (two letters)
  const gap = hM * 0.16;
  const t = hM * 0.2; // stroke thickness
  const letterW = (wM - gap) / 2;
  const top = c - hM / 2;
  const xT = c - wM / 2;
  const xH = xT + letterW + gap;
  const f = (x: number) => x.toFixed(2);
  const rect = (x: number, y: number, w: number, h: number) =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${color}"/>`;

  return (
    `<g shape-rendering="geometricPrecision">` +
    `<rect x="${f(c - badge / 2)}" y="${f(c - badge / 2)}" width="${f(badge)}" height="${f(badge)}" rx="${f(rad)}" fill="#ffffff"/>` +
    // T
    rect(xT, top, letterW, t) +
    rect(xT + letterW / 2 - t / 2, top, t, hM) +
    // H
    rect(xH, top, t, hM) +
    rect(xH + letterW - t, top, t, hM) +
    rect(xH, c - t / 2, letterW, t) +
    `</g>`
  );
}

/** QR SVG with the centred TH monogram. */
export async function qrSvg(data: string, dark = "#000000"): Promise<string> {
  const svg = await QRCode.toString(data, {
    ...BASE,
    type: "svg",
    color: { dark, light: "#ffffff" },
  });
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/);
  if (!m) return svg;
  const n = parseFloat(m[1]);
  return svg.replace("</svg>", `${centreMonogram(n, dark)}</svg>`);
}

/** Raster QR at a given pixel width, rendered from the badged SVG (crisp). */
export async function qrPngBuffer(
  data: string,
  width = 2048,
  dark = "#000000",
): Promise<Buffer> {
  const svg = await qrSvg(data, dark);
  // Give the SVG explicit pixel dimensions so sharp rasterises at full res.
  const sized = svg.replace("<svg ", `<svg width="${width}" height="${width}" `);
  return sharp(Buffer.from(sized)).png().toBuffer();
}
