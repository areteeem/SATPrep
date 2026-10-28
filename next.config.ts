import type { NextConfig } from "next";

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/api/lookup",
        headers: [
          {
            key: "Cache-Control",
            value: "s-maxage=3600, stale-while-revalidate=59",
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      new URL("https://originui.com/**"),
      new URL("https://upload.wikimedia.org/**"),
      new URL("https://vectorseek.com/**"),
      new URL("https://assets.dub.co/**"),
      new URL("https://support.khanacademy.org/**"),
    ],
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
