import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // A 2 MB .ics plus the multipart overhead (spec 004 RF-26, plan D7); the
      // action itself answers with the clear message for 2 to 3 MB.
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [
      {
        // The invite token is in the URL: keep it out of the Referer and out of
        // search engines (plan D12).
        source: "/invite/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      {
        // The browser must always fetch the latest service worker (plan R5).
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
