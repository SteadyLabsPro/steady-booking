import type { MetadataRoute } from "next";
import { tenant } from "@/config/tenant.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the admin, API and Stripe return pages out of search.
      disallow: ["/admin", "/api/", "/booking/confirmed", "/pass/confirmed"],
    },
    sitemap: `${tenant.url}/sitemap.xml`,
    host: tenant.url,
  };
}
