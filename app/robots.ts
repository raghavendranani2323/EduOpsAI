import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://eduops.in";
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/data-rights", "/support", "/status"],
      disallow: ["/api/", "/dashboard", "/attendance", "/students", "/fees", "/settings", "/parent", "/p/"],
    }],
    sitemap: `${base}/sitemap.xml`,
  };
}
