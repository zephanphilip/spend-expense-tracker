// Production E2E: static build wired to the emulators, served by the Hosting emulator with the
// real firebase.json headers/redirects (see e2e-hosting-config.mjs), then Playwright.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const env = { ...process.env, ...JSON.parse(readFileSync("tests/e2e/emulator-env.json", "utf8")), E2E_PROD: "1" };
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });
const specs = process.argv.slice(2).join(" ") || "critical-flows phase3 phase4 phase5";

run("npx next build");
run("node scripts/e2e-hosting-config.mjs");
run(`npx firebase emulators:exec --config firebase.e2e.json --only auth,firestore,hosting --project demo-ledger 'npx playwright test ${specs}'`);
