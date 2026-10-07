import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const emulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/**
 * Content-Security-Policy for production. Next.js' static pages need inline bootstrap
 * scripts ('unsafe-inline'; nonces would force dynamic rendering). React escapes all
 * rendered data and the app never injects raw HTML, so the CSP mainly limits where code,
 * frames and connections can come from.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
    "https://www.google.com https://www.recaptcha.net",
    emulators ? "http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*" : "",
  ].join(" "),
  `frame-src https://*.firebaseapp.com ${authDomain ? `https://${authDomain}` : ""} https://accounts.google.com https://www.google.com https://www.recaptcha.net`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  emulators ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Google sign-in popups must be able to talk back to the opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: csp },
        ...(emulators ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
      ]
    : []),
];

const nextConfig: NextConfig = {
  // The default bottom-left badge covers the mobile tab bar; hide it entirely in E2E runs.
  devIndicators: process.env.E2E === "true" ? false : { position: "top-right" },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Tree-shake icon and chart libraries to what each page actually uses.
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be served stale.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
