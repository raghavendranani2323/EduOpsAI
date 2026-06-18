import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://eduops.in";
  return ["", "/privacy", "/terms", "/data-rights", "/support", "/status"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date("2026-06-18"),
    changeFrequency: path ? "monthly" : "weekly",
    priority: path ? 0.6 : 1,
  }));
}
