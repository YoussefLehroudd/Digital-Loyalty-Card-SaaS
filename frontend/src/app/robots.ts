import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/marketing-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/r/", "/api/", "/admin", "/dashboard", "/user/", "/card/", "/wallet/", "/reset-password", "/forgot-password"] },
    sitemap: siteUrl + "/sitemap.xml",
  };
}
