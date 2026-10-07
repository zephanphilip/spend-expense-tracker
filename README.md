# Ledger — personal finance tracker

Mobile-first expense tracker: Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui · Firebase Auth · Cloud Firestore.
Architecture, data model, indexes and rules rationale: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Phase 1:** fast expense entry, categories, history/search/filters, dashboard, PWA.
**Phase 2:** monthly & category budgets (rolling forward, history), income (one-time + recurring),
salary tracker (expected vs received, growth, average), EMI tracker (amortisation, payments, undo),
wishlist savings (contributions/withdrawals), monthly summary (savings rate, EMI obligations,
budget utilisation) — all reachable from the **Plan** tab.
**Phase 3:** bank/cash/wallet accounts and credit cards with live balances, transfers and card
payments (never counted as spending), explicit transaction types (EXPENSE, INCOME, TRANSFER,
INVESTMENT, DEBT_PAYMENT), investments with returns, recurring payments, an upcoming-payments
view and net worth.
**Phase 4:** analytics dashboard (periods, filters, comparisons, 20+ charts and breakdowns,
heatmap), rule-based insights, monthly aggregate documents for fast analytics, and CSV
export of everything plus validated, previewed, undoable CSV import.
**Phase 5:** installable offline PWA (iOS splash screens, shortcuts, offline shell), JSON
backup/restore, reminders, idempotent recurring automation, App Check, security headers,
staging/production configs and a full review pass.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web-app config
npm run dev                  # http://localhost:3000
```

Without Firebase config the app shows a setup screen listing the missing variables.

### Firebase setup (one time)

1. Create a Firebase project and add a **Web app**; copy its config into `.env.local`.
2. **Authentication → Sign-in method**: enable **Google** and **Email/Password**.
   Add your deployed domain under *Authorized domains*.
3. **Firestore**: create a database (production mode).
4. Deploy rules + indexes (re-run after every upgrade — each phase adds rules and indexes):
   ```bash
   cp .firebaserc.example .firebaserc   # set your project id
   npx firebase login
   npm run deploy:rules
   ```

### Run fully offline against emulators (no Firebase project needed)

Requires Java 11+ for the Firestore emulator.

```bash
npm run emulators            # terminal 1 (demo-ledger project)
# terminal 2 — .env.local:
#   NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
#   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-ledger.firebaseapp.com
#   NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-ledger
#   NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:demo
#   NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
npm run dev
```

## Deployment — https://spend-9273d.web.app

Production is a **static export** (`next build` → `out/`) served by **Firebase Hosting**;
`firebase.json` sets the security headers + CSP, caching and the `/` → `/dashboard` redirect.
Detail screens use `?id=` URLs (`/emis/detail?id=…`, see `src/lib/routes.ts`) because a static
export can't pre-render runtime ids. The public web config for builds lives in `.env.production`
(committed — those values ship to every browser anyway; data is protected by Firestore rules).

### Continuous deployment (GitHub Actions)

`.github/workflows/ci-cd.yml` runs on every push and PR: lint, typecheck, unit tests, Security
Rules tests, a production build, and the Playwright suite against that build on the Hosting
emulator. Pushes to `main` that pass are deployed (`hosting`, `firestore:rules`,
`firestore:indexes`). One-time setup:

1. Google Cloud console → *IAM & Admin → Service accounts* (project `spend-9273d`) → **Create
   service account** (e.g. `github-deploy`) with roles **Firebase Admin**, **Service Usage
   Consumer** and **Service Account User** → *Keys → Add key → JSON*.
2. GitHub repo → *Settings → Secrets and variables → Actions* → **New repository secret**
   `FIREBASE_SERVICE_ACCOUNT_SPEND_9273D` = the whole JSON file. Delete the local key file afterwards.

Manual deploy from a logged-in machine: `npm run deploy`.

### Firebase console checklist

1. Authentication → enable **Google** + **Email/Password**; `spend-9273d.web.app` and
   `spend-9273d.firebaseapp.com` are authorized by default (add any custom domain).
2. App Check → register the web app with **reCAPTCHA v3**, set
   `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` in `.env.production`, watch metrics, then **Enforce**.
3. Optional: `NEXT_PUBLIC_FIREBASE_PERFORMANCE=true` for Performance Monitoring.
4. Staging: add a `staging` alias to `.firebaserc` and use `npm run deploy:rules:staging`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` · `npm run build` | Next.js dev server · static export to `out/` |
| `npm start` | Serve `out/` with the Hosting emulator (real headers/redirects) |
| `npm run deploy` | Build + deploy hosting, rules and indexes |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm test` | Unit tests (money, dates, analytics, search, validation, EMI/budget/salary/goal/summary maths, ledger effects, cards, investments, recurrence, net worth, upcoming, monthly aggregates, analytics, insights, CSV, rules ↔ constants sync) |
| `npm run test:rules` | Firestore Security Rules tests in the emulator (needs Java) |
| `npm run test:e2e` | Playwright flows (iPhone + desktop) in installed Chrome against Auth/Firestore emulators (needs Java) |
| `npm run test:e2e:prod` | The same against the **static production build** on the Hosting emulator (CSP, headers, service worker, offline shell) |
| `npm run verify` | lint + typecheck + unit tests + production build |
| `npm run splash` | Regenerate iOS launch screens |
| `npm run icons` | Regenerate PWA icons |
| `npm run deploy:rules` | Deploy `firestore.rules` + `firestore.indexes.json` |

## Notes

- Amounts are stored as integer minor units (paise/cents).
- Route protection is client-side; **Firestore Security Rules are the real access boundary**.
- Firestore uses a persistent on-device cache: the app opens instantly and adding expenses works offline.
  Sign-out clears that cache.
- The service worker registers in production builds only (`npm run build && npm start`, or the deployed site).
- Google sign-in uses a popup and falls back to redirect where popups are blocked (some in-app browsers / installed PWAs).
  The app is hosted on the same domain family as `authDomain` (Firebase Hosting), which keeps the iOS Safari redirect flow reliable.
