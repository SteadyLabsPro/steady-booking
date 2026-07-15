"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { TenantHeroImage } from "@/engine";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 5500;

/**
 * Hero photos as a slow cross-fade. A single image renders statically; several
 * auto-advance with tappable dots. Auto-advance is disabled for users who
 * prefer reduced motion (they can still tap through).
 */
export function HeroSlider({ images }: { images: TenantHeroImage[] }) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) return null;

  return (
    <>
      {images.map((img, i) => (
        <Image
          key={img.src}
          src={img.src}
          alt={img.alt}
          fill
          priority={i === 0}
          sizes="(max-width: 768px) 100vw, 57vw"
          aria-hidden={i !== index}
          className={cn(
            "object-cover object-center transition-opacity duration-[1200ms] ease-in-out motion-reduce:transition-none",
            i === index ? "opacity-100" : "opacity-0",
          )}
        />
      ))}

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1} of ${count}`}
              aria-current={i === index}
              className={cn(
                "h-2.5 w-2.5 rounded-full ring-1 ring-black/20 transition-colors",
                i === index ? "bg-white" : "bg-white/45 hover:bg-white/75",
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}
