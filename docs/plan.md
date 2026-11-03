# Go-live plan: the new backend on api.glamlink.net

Approved Oct 16, 2026; statuses updated Oct 30 and Nov 2, 2026. Progress is in progress.md; finding-by-finding status
in audit.md.

## The setup

- This backend deploys as a **separate folder** on the VPS (`/var/www/api`), behind **api.glamlink.net**, with a
  **new database**: a copy of the live database with this repo's migrations applied. As deployed (Mohit's report),
  pm2 `glamlink-api` runs from `/var/www/backend` on port 5500 with database `glamlinkdb`; deploy.md still describes
  `/var/www/api`.
- The old backend (node.glamlink.net), the old database and the server are never touched by this work. The server
  steps are written as a runbook (`docs/deploy.md`, Phase 3) that Mohit runs.
- The website (glamlink.net) and the admin panel (admin.glamlink.net) run on the same VPS. The admin panel's TS/Vite
  refactor already runs on api.glamlink.net (pass 10, built Oct 27); the website changes its base URL at the switch,
  plus the changes in its handoff note.
- API paths stay the same.

## Rules for the work

- **Website first.** The mobile app comes in about three months and the CRM in about six. Until their phases,
  nothing under `src/mobile/` or `src/crm/` changes.
- **Frontends are frozen** until the backend is ready (READY below). Every backend change that affects a frontend is
  logged in its handoff note with what the frontend must or can do, including logic the backend takes over.
- Each change is verified: route table and route chains, model table, the 67-endpoint contract check against the
  local copy of production, the test suite, and `npm run lint` (with the module-boundary check).
- `master` holds the code that deploys (made from `phase5/security`, which holds every earlier phase, on Oct 16);
  new work branches from it. `main` and older commits stay as they are.

## Phases

```
1 Structure (done) -> 2a Security (done) -> 2b Backend takes over frontend logic (done) -> 3 New database + go-live
readiness (done) -> 4 Rehearsal on a fresh live dump = READY (folded into 5) -> 5 Mohit deploys the API (testing
mode; done) -> 6 Website and admin panel adapt from the handoff notes (website done, admin panel live) -> 7 Switch (next)
```

### 1. Structure (done)

Code grouped by product (shared, website, mobile, crm), models and associations in their modules, an index.js
per module, boundaries checked by `npm run lint`. No behaviour change. See architecture.md.

### 2a. Security (done)

Only shared, website and core code changes.

1. **Card token for the logged-out purchase flow.** `POST /businessCard` returns a `card_token` (signed, 24 h).
   It is required, unless the caller is the signed-in owner or an admin, on `select-plan`, the public shipping,
   subscription and address calls, `getAddressByBusinessCardId`, and edits of a card nobody owns yet.
2. **One admin guard.** `requireAdmin` replaces the old `validateJWTtoken` on the website and shared routes;
   admin login refuses deactivated admins. (Since the go-live fixes, the app's back-office routes get the same
   check through the shared guard.)
3. **Error handling.** Unexpected errors are logged with their stack and answer a generic 500 instead of the raw
   database message, in shared and website code. Stripe card errors keep their message; the messages the website
   matches on stay, with stable codes added.
4. **Topic page** stops returning professionals' emails, except to admins.
5. **Card bio** cleaned on save with an allow-list matching the website's bio editor (`sanitize-html`), plus a
   migration that cleans stored bios and keeps the originals.
6. **Google Maps key** read from `.env` (Mohit rotated the key on Oct 16; the old one is in git history).
7. **Stripe webhook** processes each event once (`stripe_events` table), so resending events after the switch is safe.
8. **CORS**: no `Access-Control-Allow-Origin: *` on every response; a disallowed origin is refused with 403, not 500.
9. **`PUT /ads/sort-order`** made reachable.
10. **Directory filter** (`GET /businessCard/filter`) wrote its `location` into the SQL; it is now a value.

### 2b. Access (done), and the backend takes over frontend logic (done in phase 6)

**Access** (designed in access.md, added Oct 16): the card takes precisely the website form's fields (the admin
panel matches them); plans, features and prices are stored and served by the API; admins change prices, give one
client a personal price and run site-wide discounts; one card per person, with the subscription as a seat the
person keeps when they delete and re-create their card; guests build a draft card and pay, with every situation
covered (signed in or not, email with an existing account, existing card); the keychain is a shipped one-time
product; Stripe moves to stripe-node 23 (API `2026-09-30.endive`) and Shippo to its current address check, rates,
labels and tracking; the plan features (pricing page) are enforced on the server, which settles the edit lock.
Mohit's decisions of Nov 1 extend it (built Nov 1–2, not deployed; progress.md): Access Pro at $9.99 with the new plan
copy, offers retired, analytics for Pro, the purchase following Stripe itself, no refunds by the API with an admin's
Cancel order, app accounts converted, professional or brand on the card, optional locations, one form with Google
listing claims verified by an admin.

**Takeovers:** each adds an endpoint or an optional parameter, so nothing that works today breaks. Done: the
helpers for the admin panel (double slashes collapsed, optional `department_id`, 20 gallery photos for admins)
and the access-order admin link. After the first deploy (Mohit, Oct 16: the first version goes live first; the
website works today without them): live ads and ad tracking, journal paging and search, real directory search
with geocoding, podcast episodes from the server, the newsletter and "get featured" forms, analytics
de-duplication. All but analytics de-duplication were built in phase 6 (Oct 23, now on `master`); see progress.md.

### 3. New database and go-live readiness (done)

Done (the go-live fixes): stored file URLs moved from node.glamlink.net to `API_BASE_URL` (migration
`20261016-0800`), pm2 name `glamlink-api` and folder `/var/www/api`, a testing mode (`JOBS_ENABLED=false`,
`MAIL_TRANSPORT=log`, no push, Stripe and Shippo test keys), CORS origins, production settings refused when weak or
missing, `npm run check:server`, and the runbook `docs/deploy.md`. Left for later, as nothing depends on them:
dropping the token and OTP leftover tables, trimming reference data to the US and Canada, the row-count and
frontend-call scripts (`check:server`, the migration report and the smoke checks in deploy.md cover the deploy).

### 4. Rehearsal (READY gate)

Folded into the testing-mode deploy (deploy.md sections 1 to 7): the server run on a fresh copy of the live data is
the rehearsal; the migration report, `check:server`, the smoke checks and a test purchase are its checks. Locally:
contract check, tests and lint pass on the Oct 14 copy. Still open (Oct 30): a real test purchase (card, wallet,
keychain). Still open on Nov 2, and wider: the Nov 1–2 Stripe work has run only against the tests' fake Stripe
(progress.md lists the purchases to try in test mode).

### 5–7. Deploy, frontends, switch

Mohit deploys the API in testing mode on a copy of live data; the website and admin panel change from their
handoff notes and are tested; at the switch the database is rebuilt from a fresh dump, Stripe and Shippo webhooks
point at the new API, and the frontends are rebuilt with the new base URL. Rollback: point them back at
node.glamlink.net.

State on Oct 30:

- **5. Deploy: done.** api.glamlink.net runs in testing mode (deployed Oct 17, phase 6 later); details and server
  checks in progress.md ("On the server").
- **6. Frontends: done for the website, live for the admin panel.** The website's `master` (191e275) runs on
  test.glamlink.net against the new API; the admin panel's pass 10 runs on admin.glamlink.net, with no browser QA
  recorded.
- **7. Switch: next, not started.** glamlink.net still serves the old build on node.glamlink.net. It waits on the
  client's approval of the website preview, the fixes in "Next" below, Stripe live keys and real test payments, and
  a backup.

On Nov 2: the Access fixes, one form, brands and Stripe work (Mohit's decisions of Nov 1) is built and tested in all
three repos, committed on Nov 4 (backend and website `master`, admin `main`) and not deployed (progress.md). The API deploys first, then the website and the admin panel.
Before the switch it also needs Stripe's dashboard steps in both modes (deploy.md section 5) and the test-mode
purchases in progress.md.

## Next (Oct 30)

From the Oct 30 audit, in this order; tracked in the website's list and the admin panel's list (Claude Docs).

1. **A-CNT-1:** saving an article with topics answers 500 and soft-deletes its topic links (`journal.service.js:1785`,
   `:1798`, the same at `:681`); live, all 6 topics list 0 articles. Hard-delete in one transaction, then restore the
   links.
2. **For the admin panel's two urgent bugs:** accept only http(s) URLs on the public forms and the card's social
   fields (admin X-01); save `ip_address` on login records (A-OTH-1, `shared/identity/auth.service.js:35-42`).
3. **SEC-02:** remove the public `GET /order/getBuinessAddressById/:id` (`shared/users/address.route.js:11`), which
   returns names, phones and addresses by sequential id.
4. **W-1:** allow-list the card fields that `GET /journal/topic/:id` returns (`journal.service.js:1378-1426`).
5. **SEC-01:** remove the admin OTP routes (`shared/admin/adminAuth.route.js:14-16`).
6. **A-CNT-3:** published content only on public topic pages.
7. **OPS-01 to OPS-03:** `NODE_ENV=production` in the server `.env`; the SQL dumps off the server and a tested
   backup; catch the CRM job's errors or stop it (`src/crm/index.js:15-17`).
8. **Before the switch:** SEC-03 (uploads parsed only on the routes that take files, after auth), SEC-04 (remove the
   legacy Google calls), Contact Us (email support on each message), and the admin panel's requests (BA1 first).
   BA1, the access-orders list's paging (A-ACC-1): built Nov 1, not deployed.
9. **After the switch:** the new plans and Stripe (the website's list, "Plans and Stripe"), none started. Nov 2: built
   Nov 1–2, before the switch at Mohit's request, not deployed (progress.md, "Access fixes, one form, brands and
   Stripe"); what is left is the deploy, Stripe's dashboard steps and test-mode purchases.

## Later

Website polish from the website audit; cleaner response shapes (with both frontends); admin email links instead
of OTP; the misspelt admin URLs. Month 3: the mobile app. Month 6: the CRM.
