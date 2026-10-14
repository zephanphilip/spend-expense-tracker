# Activity Tracker (formerly Fitness)

The Fitness tracker became a general-purpose **Activity Tracker** — learning, coding,
freelance work, personal projects, reading, fitness, any habit — **without migrating or
rewriting any stored data**.

## 1. What was there (inspected before changing anything)

| Piece | Where | Fitness-specific? |
| --- | --- | --- |
| Activities | `users/{uid}/fitnessActivities/{activityId}` | Only the collection name. Fields are generic: name, description, icon, color, startDate/endDate, versioned `schedules`, reminderEnabled/reminderTime, targetDuration (min), targetQuantity + unit, multipleEntries, status (active/paused/archived), createdAt/updatedAt |
| Completion logs | `users/{uid}/fitnessLogs/{logId}` | Only the name. Fields: activityId, date (local day), completedAt, durationMin, quantity, note, createdAt/updatedAt. Daily check-ins use id `<activityId>_<date>`; multi-session activities use random ids |
| Security rules | `firestore.rules` (Fitness section) | Owner-only; strict schema with `keys().hasOnly([...])` and a hard-coded icon list |
| Indexes | `fitnessLogs (activityId ASC, date DESC)` | No |
| Scheduled jobs | None — reminders are computed on the device while the app is open (no Cloud Functions, no push server) | — |
| Reminder prefs | localStorage `spend:fitness-notifications`, `spend:fitness-notified`; per-activity `reminderEnabled`/`reminderTime` in Firestore | Key names only |
| Stats / analytics / insights | `src/lib/fitness/*` (pure, derived from logs on demand; nothing persisted) | Wording only |
| UI | `/fitness`, `/fitness/analytics`, `/fitness/activity?id=` ; "Fitness" nav tab; fitness templates & icons; reminder copy | Yes |
| Backup | **Not** included in the JSON backup (only money collections) | — |

**Conclusion:** the schema already supports general activities. The only missing concept was an
optional **category**. Everything else is naming, UI, templates, icons, copy and analytics.

## 2. Preservation strategy — no migration

* **No collection is renamed, copied or deleted.** `fitnessActivities` / `fitnessLogs` keep their
  names (renaming would require copying every record for no functional gain). The code that
  touches them (`paths.ts`, converters, rules) keeps the `fitness*` identifiers on purpose.
* **No document is rewritten.** Ids, log ids (`<activityId>_<date>`), dates, timestamps,
  durations, quantities, notes, statuses, schedules and reminder settings are untouched.
* **Additive schema only:**
  * `category` — optional string (≤ 24 chars) or null. Absent on existing documents; read as
    "no category". Only written when the user edits/creates an activity.
  * New icon keys (`code`, `laptop`, `book`, `study`, `briefcase`, `project`, `pen`, `brush`,
    `idea`, `language`, `rocket`, `coffee`, `calendar`, `check`). Existing keys unchanged.
* **Rules** accept documents with or without `category`; existing documents remain valid for
  reads, updates (e.g. pause/edit) and log writes. The log rules are unchanged.
* **localStorage keys and notification tags** keep their `fitness` names, so reminder
  preferences and "already notified today" state carry over and nothing double-notifies.
* **Old URLs keep working**: `/fitness`, `/fitness/analytics`, `/fitness/activity?id=…` are kept
  as redirect pages (query string preserved — reminder notifications already on a device point
  at `/fitness?check=…`).

Because nothing is migrated there are no before/after counts to reconcile: every record is
read exactly as before. The new **Import & export → Activity data** export (JSON, read-only)
downloads every activity and log with its original id and raw fields, with counts — a
recovery copy and a way to verify. Restoring from it is not automated (see limitations).

### Rollback

Redeploy the previous hosting build and rules. Documents created with a `category` would then
fail the old rules' `hasOnly` check **on update** (reads are unaffected); removing the field
(or keeping the new rules) resolves it. No data needs to be restored.

## 3. Behaviour

* **Habit tracking** (default): one check-in per scheduled day (`<activityId>_<date>` id).
* **Session tracking** (`Several sessions a day`): each session is its own record with optional
  duration / quantity / note; a day counts as done when it has ≥ 1 session.
* **Reminders** fire when the activity is active, scheduled that day, reminder enabled and the
  day has **no** completion yet (any session satisfies it). Copy uses the activity name.
* **Metrics are kept separate**: completed scheduled days, completion rate, sessions, time
  invested (only from records with a duration), quantity (only from records with a quantity,
  shown with the activity's unit — never summed across different units). Records without a
  duration/quantity are never given invented values.

## 4. Limitations

* No server push: reminders appear while the app is open/foregrounded (iOS PWA limit).
* The activity export is download-only; there is no one-click restore for activity data.
* Quantity totals are per activity/unit only (12 problems and 20 pages are not added up).
