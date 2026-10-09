import type { NextConfig } from "next";

import { buildContentSecurityPolicy, cspHeaderFor, cspModeFrom } from "./src/lib/contentSecurityPolicy";

const cspHeader = cspHeaderFor(
  cspModeFrom(process.env.CSP_MODE),
  buildContentSecurityPolicy({ isDev: process.env.NODE_ENV !== "production", reportUri: "/api/csp-report" }),
);

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Switches off browser features this app never uses (payment is left alone for Razorpay).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), bluetooth=(), serial=(), midi=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // The admin panel must never appear in search results.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ...(cspHeader ? [cspHeader] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
