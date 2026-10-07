// Fails a production build early when required public Firebase config is missing,
// or when a production build accidentally points at the emulators.
const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];
const nextEnv = await import("@next/env");
const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig;
loadEnvConfig(process.cwd(), false);
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`✖ Missing environment variables: ${missing.join(", ")}\n  Copy .env.example to .env.local (or .env.production) and fill them in.`);
  process.exit(1);
}
const env = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
if (env === "production" && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
  console.error("✖ NEXT_PUBLIC_APP_ENV=production but emulators are enabled.");
  process.exit(1);
}
if (env === "production" && !process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY) {
  console.warn("⚠ App Check site key not set — production requests won't be attested.");
}
console.log(`✓ Environment OK (${env}, project ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID})`);
