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
        // Every route: never inside a frame, no type sniffing, a short Referer
        // and out of search engines. First, because the last matching rule
        // wins and the two below are more specific (spec 023 RF-4, RF-5).
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
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
