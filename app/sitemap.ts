import type { MetadataRoute } from "next";
import { SEO_PAGES, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(SEO_PAGES)
    .filter(([, page]) => page.index)
    .map(([path]) => ({ url: new URL(path, SITE_URL).href }));
}
