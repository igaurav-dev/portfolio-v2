import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();
  const now = new Date();

  const staticRoutes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/hire", priority: 0.95, freq: "monthly" },
    { path: "/work", priority: 0.9, freq: "monthly" },
    { path: "/decisions", priority: 0.8, freq: "monthly" },
    { path: "/graph", priority: 0.7, freq: "monthly" },
    { path: "/day", priority: 0.6, freq: "daily" },
    { path: "/proof", priority: 0.6, freq: "daily" },
    { path: "/craft", priority: 0.7, freq: "monthly" },
    { path: "/ask", priority: 0.6, freq: "monthly" },
    { path: "/resume", priority: 0.8, freq: "monthly" },
    { path: "/about", priority: 0.7, freq: "monthly" },
    { path: "/growth", priority: 0.5, freq: "monthly" },
    { path: "/status", priority: 0.3, freq: "daily" },
  ];

  return [
    ...staticRoutes.map((r) => ({
      url: `${SITE_URL}${r.path}`,
      lastModified: now,
      changeFrequency: r.freq,
      priority: r.priority,
    })),
    ...projects.map((p) => ({
      url: `${SITE_URL}/work/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
  ];
}
