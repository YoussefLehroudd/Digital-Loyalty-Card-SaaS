import type { MetadataRoute } from "next";
import { marketingLanguages, siteUrl } from "@/lib/marketing-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/fr", "/ar"].map((path) => ({
    url: siteUrl + path,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.9,
    alternates: { languages: marketingLanguages },
  }));
}
