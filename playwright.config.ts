import { defineConfig, devices } from "@playwright/test";

import emulatorEnv from "./tests/e2e/emulator-env.json";

/**
 * End-to-end tests against the Firebase emulators with a demo project (no real
 * credentials needed). Run with `npm run test:e2e`, which starts the emulators.
 */
const PORT = 3100;
/**
 * E2E_PROD=1 (set by scripts/e2e-prod.mjs) runs against the static production build served by the
 * Hosting emulator — CSP, security headers, redirects and the service worker are all live.
 */
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
  webServer: PROD
    ? undefined
    : {
        command: `npx next dev --port ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: emulatorEnv,
      },
});
