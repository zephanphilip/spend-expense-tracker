// Writes firebase.e2e.json: the production Hosting config, relaxed only so the static build
// served by the Hosting emulator (plain http) can reach the Auth/Firestore emulators.
import { readFileSync, writeFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync("firebase.json", "utf8"));
const local = "http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*";
for (const rule of cfg.hosting.headers) {
  rule.headers = rule.headers
    .filter((h) => h.key !== "Strict-Transport-Security")
    .map((h) =>
      h.key !== "Content-Security-Policy"
        ? h
        : {
            ...h,
            value: h.value
              .split("; ")
              .filter((d) => d !== "upgrade-insecure-requests")
              .map((d) => (d.startsWith("connect-src ") ? `${d} ${local}` : d))
              .join("; "),
          },
    );
}
cfg.emulators.hosting = { port: Number(process.env.E2E_PORT ?? 3100) };
writeFileSync("firebase.e2e.json", JSON.stringify(cfg, null, 2) + "\n");
console.log("✓ firebase.e2e.json written");
