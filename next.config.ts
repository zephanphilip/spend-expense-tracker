import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Production builds are a static export (`out/`) served by Firebase Hosting, which also sets
 * the security headers + CSP (see firebase.json). These headers only cover `next dev`.
 */
const devHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  output: isProd ? "export" : undefined,
  // The default bottom-left badge covers the mobile tab bar; hide it entirely in E2E runs.
  devIndicators: process.env.E2E === "true" ? false : { position: "top-right" },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Tree-shake icon and chart libraries to what each page actually uses.
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  ...(isProd ? {} : { headers: async () => [{ source: "/:path*", headers: devHeaders }] }),
};

export default nextConfig;
