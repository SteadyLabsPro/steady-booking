import QRCode from "qrcode";

/**
 * Reusable QR generation. Any string can be encoded (URLs today; later session,
 * instructor, venue, or booking deep-links). High error correction (H, ~30%
 * recovery) so a logo can be added centrally later, and a 4-module quiet zone
 * for reliable scanning in print. `dark` sets the module colour (brand navy for
 * branded codes) — always on white for maximum contrast/scannability.
 */

const BASE = {
  errorCorrectionLevel: "H" as const,
  margin: 4,
};

/** Vector QR (best for print — scales to any size). */
export function qrSvg(data: string, dark = "#000000"): Promise<string> {
  return QRCode.toString(data, {
    ...BASE,
    type: "svg",
    color: { dark, light: "#ffffff" },
  });
}

/** Raster QR at a given pixel width (default 2048 for large prints). */
export function qrPngBuffer(
  data: string,
  width = 2048,
  dark = "#000000",
): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    ...BASE,
    type: "png",
    width,
    color: { dark, light: "#ffffff" },
  });
}
