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

## Production deployment checklist

1. Create **separate Firebase projects** for staging and production; add their ids to
   `.firebaserc` (see `.firebaserc.example`).
2. Fill `.env.production.local` / `.env.staging.local` (or your host's env vars) from the
   `*.example` files. `npm run build` refuses to build with missing config.
3. Authentication → enable Google + Email/Password; add your domain to *Authorized domains*.
4. App Check → register the web app with **reCAPTCHA v3**, set
   `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`, watch metrics, then **Enforce** for Firestore.
5. `npm run deploy:rules:staging` / `npm run deploy:rules:production` (rules + indexes).
6. Optional: `NEXT_PUBLIC_FIREBASE_PERFORMANCE=true` for Performance Monitoring.
7. Deploy the Next.js app (e.g. Firebase App Hosting / Vercel). Security headers + CSP are
   set in `next.config.ts`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm test` | Unit tests (money, dates, analytics, search, validation, EMI/budget/salary/goal/summary maths, ledger effects, cards, investments, recurrence, net worth, upcoming, monthly aggregates, analytics, insights, CSV, rules ↔ constants sync) |
| `npm run test:rules` | Firestore Security Rules tests in the emulator (needs Java) |
| `npm run test:e2e` | Playwright flows (iPhone + desktop) in installed Chrome against Auth/Firestore emulators (needs Java) |
| `npm run test:e2e:prod` | The same against a **production build** (CSP, headers, service worker, offline shell) |
| `npm run verify` | lint + typecheck + unit tests + production build |
| `npm run splash` | Regenerate iOS launch screens |
| `npm run icons` | Regenerate PWA icons |
| `npm run deploy:rules` | Deploy `firestore.rules` + `firestore.indexes.json` |

## Notes

- Amounts are stored as integer minor units (paise/cents).
- Route protection is client-side; **Firestore Security Rules are the real access boundary**.
- Firestore uses a persistent on-device cache: the app opens instantly and adding expenses works offline.
  Sign-out clears that cache.
- The service worker registers in production builds only (`npm run build && npm start`).
- Google sign-in uses a popup and falls back to redirect where popups are blocked (some in-app browsers / installed PWAs).
  For the most reliable redirect flow on iOS Safari, host the app on the same domain as `authDomain` (e.g. Firebase Hosting).
