import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LOYVANCE",
    short_name: "LOYVANCE",
    description: "Your loyalty cards, stamps and rewards, everywhere.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080907",
    theme_color: "#080907",
    icons: [192, 512].map(size => ({
      src: `/pwa/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
}
