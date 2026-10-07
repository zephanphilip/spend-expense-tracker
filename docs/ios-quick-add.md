# Quick Add on iPhone — PWA first

`/quick-add` is a dedicated, minimal screen for logging an expense in a few taps:

```
Amount → Category → Note (optional) → Payment → Confirm → Added + budget left
```

It is part of the same Next.js PWA (static export on Firebase Hosting). Nothing in it needs
native code, and nothing native is faked.

---

## 1. What iOS allows a web app (and what it doesn't)

| Capability | iOS / iPadOS (Safari, Home Screen web apps) | How Spend uses it |
| --- | --- | --- |
| Install to Home Screen, standalone window | ✅ (Share → Add to Home Screen) | Manifest + `apple-mobile-web-app-*` meta, splash screens, safe-area aware UI |
| Manifest `shortcuts` (long-press icon menu) | ❌ ignored on iOS (works on Android / desktop Chrome & Edge) | "Quick Add expense" is the first manifest shortcut for those platforms |
| Apple **Shortcuts** → *Open URLs* | ✅ opens the URL — **in Safari**, not in the Home Screen app | `https://spend-9273d.web.app/quick-add?...` deep links |
| `webapp://<host>` to open the installed web app | ✅ iOS 16.4+ (undocumented by Apple): opens the **Home Screen app**, not Safari — but **ignores the path and query** | Recommended Back Tap route, paired with *Open the app into Quick Add*, which routes both cold launches and resumes to Quick Add (§3) |
| **Back Tap** (Settings → Accessibility → Touch) | ✅ can run any Shortcut | Back Tap → Shortcut → Quick Add URL |
| Web pages detecting Back Tap | ❌ no API | Not attempted |
| Auto-showing the keyboard on load | ⚠️ iOS only opens the keyboard from a user tap | Amount is focused (desktop/Android get the keyboard); the whole amount area is one big tap target. Fastest iPhone route: let the Shortcut ask for the number natively (§3, recipe B) |
| Haptics | ❌ the Vibration API isn't available on iOS | Visual press feedback; vibration on Android only |
| Web Push, App Badge | ✅ iOS 16.4+, installed web apps only | Used by reminders, not by Quick Add |
| **Live Activities / Dynamic Island** | ❌ **No web API.** Requires a native app with ActivityKit (Swift/SwiftUI widget extension) | Not implemented. A versioned bridge is ready for a future native wrapper (§5) |
| Storage shared between Safari and the Home Screen app | ❌ separate storage | Sign in once in Safari too if your Shortcut opens Quick Add there |
| EU (DMA) | Home Screen web apps have, at times, opened as Safari tabs | Everything above still works in a tab |

Sources: Apple's Shortcuts user guide (URL actions), firt.dev's iOS PWA compatibility notes,
MagicBell/MobiLoud iOS PWA limitation guides (2026), and community reports on `webapp://`.
Re-check on each major iOS release — this area changes.

**Bottom line:** a browser cannot put anything in the Dynamic Island. The PWA gives you the
fastest *web* path: Back Tap → Shortcut → Quick Add, with the expense saved and the budget
shown in about 4 taps.

---

## 2. Using Quick Add

* **In the app:** Settings → Quick Add → *Open Quick Add*, or go to `/quick-add`.
* **Steps:** amount (decimal keypad) → category (recent first, then most used, searchable,
  each tile shows "₹x left" when budgeted) → note (Skip is the default action) → payment
  method (most used first) → confirm (tap any row to change it) → **Added**, with the
  category budget for the expense's month: remaining + % used, *exceeded by*, or *no
  budget → Set budget*.
* **Settings → Quick Add:**
  * *Open the app into Quick Add* — launching the installed app starts on Quick Add.
  * *Ask for a note* — off removes the note step.
  * *One-tap save* — picking the payment method saves (no confirm screen). Never applies
    to deep links (below), and not when you're only changing the method from Confirm.

---

## 3. Back Tap / Shortcuts recipes

**A. In the Home Screen app (recommended)**
1. In Spend: *Settings → Quick Add → Open the app into Quick Add* — on.
2. Shortcuts app → new shortcut → *Open URLs* → `webapp://spend-9273d.web.app`

iOS opens the installed app (your normal sign-in, standalone, no Safari UI). Because iOS drops
the path, the app does the routing:
* **Launch** — lands on the start URL (`/dashboard`) and goes straight to Quick Add. This
  includes iOS reloading the start page while the app is still in memory (each page load
  counts; `sessionStorage` survives such reloads, so it isn't used to detect launches).
* **Resume** — if iOS just brings the app back (or restores it from the back/forward cache)
  after ≥ 3 s away, it switches to Quick Add — unless a sheet/dialog is open or a field is
  focused, so nothing in progress is lost.
* The setting is stored **per app**: turn it on inside the Home Screen app, not in Safari
  (they don't share storage).

The amount can't be passed this way (no query string), so you type it in Quick Add.

**B. In Safari, amount pre-filled (native number pad)**
1. *Ask for Input* → Input Type: **Number**, Prompt: "Amount"
2. *Text*: `https://spend-9273d.web.app/quick-add?amount=` + *Provided Input*
3. *Open URLs* (the Text)

Opens in **Safari** (Safari has its own sign-in) on the category step with the amount filled in.

**C. Fixed expense in Safari** (e.g. daily metro) —
`…/quick-add?amount=40&category=transport&method=upi` opens on Confirm: one tap to save.

Then: Settings → Accessibility → Touch → **Back Tap** → Double Tap → your shortcut.

### URL parameters

| Param | Accepts | Invalid values |
| --- | --- | --- |
| `amount` | `500`, `249.5`, `1,250.50`, `12,5` (decimal comma) | Dropped; sign stripped |
| `category` | id (`food`) or name (`Food`, `Fun`), case-insensitive; custom categories too | Dropped |
| `method` | `upi`, `credit`, `debit`, `cash` or their labels | Dropped |
| `note` | text (max 280 chars) | Truncated |

A link only **pre-fills**; Quick Add starts at the first missing step and never saves on its
own. Signed out? You're sent to sign in and returned to the same link. The query is removed
after it's applied, so a reload resumes the draft instead of re-applying the link.

---

## 4. Architecture

```
                 Personal Finance App
                         │
                  ┌──────┴──────┐
                PWA          Future iOS companion (optional)
   /quick-add, dashboard,       WKWebView wrapper + ActivityKit
   Add sheet                    (Live Activity / Dynamic Island)
                  └──────┬──────┘
                 Shared web domain layer
   expense.service · calculateCategoryBudgetStatus · expense-preferences
   quick-add state machine · QuickExpenseLauncher
                         │
                 Firebase (Auth + Firestore, offline cache, security rules)
              ┌──────────┴──────────┐
          Expenses               Budgets  (+ accounts, monthly stats, analytics)
```

| Piece | File | Notes |
| --- | --- | --- |
| Route | `src/app/(quick)/quick-add/page.tsx` | Own route group: **no** app shell, nav, finance listeners, reminders or charts |
| Layout | `src/app/(quick)/layout.tsx` | `AuthGuard` + `CategoriesProvider` only |
| Screen | `src/components/quick-add/quick-add-screen.tsx` | Drives the machine; side effects; focus; keyboard-aware layout |
| Steps UI | `src/components/quick-add/quick-add-steps.tsx` | Large targets, safe areas, landscape grid |
| Data | `src/components/quick-add/use-quick-add-data.ts` | 3 small listeners: accounts, budgets, this month's stats (cache-first) |
| State machine | `src/lib/quick-add/machine.ts` | Pure reducer, unit-tested |
| Deep links | `src/lib/quick-add/deep-link.ts` | Parse/validate/build `/quick-add` URLs |
| Launcher boundary | `src/lib/quick-add/launcher.ts` | PWA default; native bridge only if a host registers it |
| Preferences | `src/lib/quick-add/preferences.ts`, `src/lib/expense-preferences.ts` | Device-local settings; usage ranking shared with the Add sheet |
| Expense writes | `src/lib/services/expense.service.ts` | `createExpense` / `updateExpense` / `deleteExpense` — the **same** functions the Add sheet uses (balances + monthly stats in one batch) |
| Budget status | `calculateCategoryBudgetStatus` in `expense.service.ts`; pure maths in `src/lib/finance/budget.ts` | See below |

### State machine

```
AMOUNT ─▶ CATEGORY ─▶ NOTE ─▶ PAYMENT ─▶ CONFIRM ─▶ SAVING ─▶ SAVED ─▶ BUDGET_RESULT
   ◀──── BACK ────◀──── BACK ───◀── BACK ──┘ ▲  EDIT(step) returns to CONFIRM
                    (askNote=false skips NOTE; oneTapSave: PAYMENT ─▶ SAVING)
```

* Explicit `step` + `draft` + `submissionId` — no loose booleans.
* While `SAVING`, every event except that submission's own result is ignored: a double tap,
  a replayed event or a re-render can't create a second expense. The effect that writes also
  remembers submission ids, and the button is disabled.
* The draft persists in `sessionStorage` (30 min) and is restored after a reload or iOS
  evicting the page — but never once saving started, so a reload mid-save can't re-save.

### Budget calculation

`remaining = monthlyCategoryLimit − totalCategoryExpensesForThatMonth`

* Month = the **expense's** month (`occurredAt`), not blindly the current one.
* Read from Firestore after the write: the category's expenses in that month (index
  `categoryId + occurredAt`) and the budget document that applies (budgets roll forward:
  latest `month ≤ target`).
* Server first (4 s timeout), else the offline cache — which includes this device's pending
  write. The UI says when the figure came from the cache.
* The new expense is counted exactly once, even if the read missed it.
* Because it re-reads stored data, edits, deletions and category changes are reflected
  automatically. Limit `0` = a budget (any spend is over); missing limit = no budget.
* The "₹x left" hints on category tiles come from the monthly aggregate (fast); the number
  after saving is always the recomputed one.

### Speed

* No dashboard/analytics/charts code in the route (verified in the build: no Recharts).
* Shell pre-cached by the service worker; `/quick-add` navigations use the cached shell if
  the network hasn't answered within 800 ms. Hashed JS is cache-first, so repeat launches
  download nothing.
* Data comes from Firestore's persistent cache first; no blocking requests before the
  amount field renders.
* Remaining weight is Firebase Auth/Firestore and the shared validation (zod) — kept on
  purpose so every expense goes through the same validated service.

### Offline & errors

* Offline: Confirm says it will be saved on the device; after saving the result shows
  "Saved on this device — will sync". A later sync failure raises a toast.
* Write errors return to Confirm with the message; the draft is intact and Save retries.
* Budget read failure doesn't affect the saved expense ("Couldn't check the budget").

### Accessibility

Real buttons/inputs with labels; step heading focused on every step (VoiceOver announces
it); progress exposed as "Step n of m"; result announced via `aria-live`; recent chips
labelled "…, recent" to distinguish them from tiles; reduced motion disables transitions
globally; all controls ≥ 44 pt; light and dark themes.

---

## 5. Optional native companion (future)

Native-only features are **not** required by the PWA and are isolated behind
`QuickExpenseLauncher` (`src/lib/quick-add/launcher.ts`):

```
QuickExpenseLauncher
  ├── PWA implementation      (default — supportsLiveActivities: false)
  └── Native bridge           (used only if window.webkit.messageHandlers.ledgerQuickExpense exists)
```

A companion app would be a small Swift target that:

1. Hosts `https://spend-9273d.web.app/quick-add` in a `WKWebView` (same auth, same Firestore,
   same business logic — no rewrite), registering a `WKScriptMessageHandler` named
   `ledgerQuickExpense`.
2. Receives these messages (versioned contract):
   * `{ type: "expense.saved", summary: QuickExpenseSummary }` — amount, formatted label,
     category, method, `budget { limit, spent, remaining, percent, month } | null`, `pending`.
     → start/update a **Live Activity** (ActivityKit) shown in the Dynamic Island.
   * `{ type: "feedback", kind: "tap" | "success" | "warning" }` → `UIImpactFeedbackGenerator`.
   * `{ type: "quickAdd.finish" }` → dismiss the native sheet.
3. Optionally exposes an **App Intent** so Shortcuts / the Action button / Back Tap can open
   Quick Add natively, passing the same URL parameters as §3.

Until such an app exists, nothing in the web app changes behaviour: the bridge is simply
absent and the PWA implementation is used.

---

## 6. Tests

* Unit (`tests/unit/quick-add.test.ts`): every machine transition incl. duplicate-save
  guard, one-tap save, edit-from-confirm, back navigation; deep-link parsing; budget maths
  (₹8,000 / ₹5,500 + ₹500 → ₹2,000 left; zero, none, exceeded); usage ranking; launcher.
* E2E (`tests/e2e/quick-add.spec.ts`, iPhone viewport + `desktop.spec.ts`): full flow with
  remaining/exceeded/no budget; back keeps data; search; one-tap; deep link through sign-in
  and reload; double tap → one expense; validation; offline save with cached budget; settings
  toggles; launch-into-Quick-Add only for standalone launches; budget after edit/delete/
  category change; desktop flow and dashboard afterwards.
