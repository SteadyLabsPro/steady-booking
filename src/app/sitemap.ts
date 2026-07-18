import type { MetadataRoute } from "next";
import { tenant } from "@/config/tenant.config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = tenant.url;
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
