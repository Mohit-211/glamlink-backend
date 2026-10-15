# Go-live plan: the new backend on api.glamlink.net

Approved Oct 16, 2026. Progress is in progress.md; finding-by-finding status in audit.md.

## The setup

- This backend deploys as a **separate folder** on the VPS (`/var/www/api`), behind **api.glamlink.net**, with a
  **new database**: a copy of the live database with this repo's migrations applied.
- The old backend (node.glamlink.net), the old database and the server are never touched by this work. The server
  steps are written as a runbook (`docs/deploy.md`, Phase 3) that Mohit runs.
- The website (glamlink.net) and the admin panel (admin.glamlink.net, the local TS/Vite refactor) run on the same
  VPS. At the switch they change their base URL to api.glamlink.net, plus the changes in their handoff notes.
- API paths stay the same.

## Rules for the work

- **Website first.** The mobile app comes in about three months and the CRM in about six. Until their phases,
  nothing under `src/mobile/` or `src/crm/` changes.
- **Frontends are frozen** until the backend is ready (READY below). Every backend change that affects a frontend is
  logged in its handoff note with what the frontend must or can do, including logic the backend takes over.
- Each change is verified: route table and route chains, model table, the 67-endpoint contract check against the
  local copy of production, the test suite, and `npm run lint` (with the module-boundary check).
- New work continues on new branches from `phase3/identity`; `main` and older commits stay as they are.

## Phases

```
1 Structure (done) -> 2a Security -> 2b Backend takes over frontend logic -> 3 New database + go-live readiness
-> 4 Rehearsal on a fresh live dump = READY -> 5 Mohit deploys the API (testing mode)
-> 6 Website and admin panel adapt from the handoff notes -> 7 Switch
```

### 1. Structure (done)

Code grouped by product (shared, website, mobile, crm), models and associations in their modules, an index.js
per module, boundaries checked by `npm run lint`. No behaviour change. See architecture.md.

### 2a. Security (current)

Only shared, website and core code changes.

1. **Card token for the logged-out purchase flow.** `POST /businessCard` returns a `card_token` (signed, 24 h).
   It is required, unless the caller is the signed-in owner or an admin, on `select-plan`, the public shipping,
   subscription and address calls, `getAddressByBusinessCardId`, and edits of a card nobody owns yet.
2. **One admin guard.** `requireAdmin` replaces the old `validateJWTtoken` on the website and shared routes;
   admin login refuses deactivated admins. (App back-office routes keep the old check until the app phase.)
3. **Error handling.** Unexpected errors are logged with their stack and answer a generic 500 instead of the raw
   database message, in shared and website code. Stripe card errors keep their message; the messages the website
   matches on stay, with stable codes added.
4. **Topic page** stops returning professionals' emails, except to admins.
5. **Card bio** cleaned of unsafe HTML on save, plus a one-time clean-up of stored bios (needs the `sanitize-html`
   package: to be confirmed).
6. **Google Maps key** read from `.env` (Mohit rotates the key: the old one is in git history).
7. **Stripe webhook** processes each event once (`stripe_events` table), so resending events after the switch is safe.
8. **CORS**: no `Access-Control-Allow-Origin: *` on every response; a disallowed origin is refused with 403, not 500.
9. **`PUT /ads/sort-order`** made reachable.

### 2b. Backend takes over frontend logic

Each item adds an endpoint or an optional parameter, so nothing that works today breaks: plans and prices from
Stripe, live ads and ad tracking, journal paging and search, real directory search with geocoding, podcast episodes
from the server, the newsletter and "get featured" forms, analytics de-duplication, the edit lock on the server
(to be confirmed), helpers for the admin panel (collapse double slashes, optional `department_id`, 20 gallery
images), the access-order admin link.

### 3. New database and go-live readiness

Migrations: stored file URLs moved from node.glamlink.net to api.glamlink.net, token and OTP leftovers dropped,
reference data trimmed to the US and Canada (only if unreferenced), the Phase 2 tables. Readiness: pm2 name
`glamlink-api` and folder `/var/www/api`, a testing mode (no cron jobs, no emails, no push, Stripe test keys),
CORS origins, row-count and frontend-call check scripts, and `docs/deploy.md`.

### 4. Rehearsal (READY gate)

On a fresh dump of the live database: restore, migrate, compare row counts, review the account-merge report,
contract check, tests, every website and admin call, a test purchase.

### 5–7. Deploy, frontends, switch

Mohit deploys the API in testing mode on a copy of live data; the website and admin panel change from their
handoff notes and are tested; at the switch the database is rebuilt from a fresh dump, Stripe and Shippo webhooks
point at the new API, and the frontends are rebuilt with the new base URL. Rollback: point them back at
node.glamlink.net.

## Later

Website polish from the website audit; cleaner response shapes (with both frontends); admin email links instead
of OTP; the misspelt admin URLs. Month 3: the mobile app. Month 6: the CRM.
