"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { tenant } from "@/config/tenant.config";

const DEFAULT_URL = tenant.url;

function imageUrl(
  format: "svg" | "png",
  data: string,
  opts: { size?: number; branded?: boolean } = {},
) {
  const params = new URLSearchParams({ format, data });
  if (opts.size) params.set("size", String(opts.size));
  if (opts.branded) params.set("branded", "1");
  return `/admin/tools/qr/image?${params.toString()}`;
}

/** Turn a URL into a sensible download filename. */
function fileSlug(data: string): string {
  try {
    const u = new URL(data);
    const path = u.pathname.replace(/\/+$/, "").replace(/\//g, "-");
    return `qr-${u.hostname}${path}`.replace(/[^a-z0-9-]/gi, "-");
  } catch {
    return "qr-code";
  }
}

export default function QrToolPage() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [active, setActive] = useState(DEFAULT_URL);
  const [branded, setBranded] = useState(true);

  const generate = () => setActive(url.trim() || DEFAULT_URL);
  const slug = fileSlug(active);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">QR code</h1>
        <p className="text-sm text-muted">
          Enter any link. SVG is best for print; PNG is a large raster.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="qr-url" className="text-sm font-medium">
          Link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="qr-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder={DEFAULT_URL}
            className="h-11 flex-1 rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent"
          />
          <Button onClick={generate}>Generate</Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={branded}
          onChange={(e) => setBranded(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        <span>Branded (navy)</span>
      </label>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${active}-${branded}`}
          src={imageUrl("png", active, { size: 1024, branded })}
          alt="QR code preview"
          className="h-64 w-64"
        />
        <p className="break-all text-center text-xs text-muted">{active}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href={imageUrl("svg", active, { branded })} download={`${slug}.svg`}>
            <Button variant="outline">Download SVG</Button>
          </a>
          <a
            href={imageUrl("png", active, { size: 2048, branded })}
            download={`${slug}.png`}
          >
            <Button variant="outline">Download PNG</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
