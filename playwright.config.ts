import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the Firebase emulators with a demo project (no real
 * credentials needed). Run with `npm run test:e2e`, which starts the emulators.
 */
const PORT = 3100;
/** E2E_PROD=1 runs against a production build (CSP, security headers, service worker active). */
const PROD = process.env.E2E_PROD === "1";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "iphone",
      use: { ...devices["iPhone 14 Pro"], browserName: "chromium", channel: "chrome" },
      testIgnore: /desktop\.spec\.ts/,
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testMatch: /(desktop|screenshots|phase5)\.spec\.ts/ },
  ],
  webServer: {
    command: PROD ? `npx next build && npx next start --port ${PORT}` : `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: PROD ? 300_000 : 120_000,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-ledger.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-ledger",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:demo",
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
      E2E: "true",
    },
  },
});
