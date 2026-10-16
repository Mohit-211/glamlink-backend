# Progress

Newest first. Each phase lists its commits; branches chain from `main` (old code) to the current one.

## Go-live preparation (Oct 16, branch `phase5/security`; current)

Mohit (Oct 16): security is fixed, so the first version goes live next; the remaining frontend takeovers come
after it. The server runbook is deploy.md.

| Item | Status |
| --- | --- |
| Stripe on the newest package | Done: `stripe` 23.0.0 is the only Stripe package (the `stripe-current` alias and stripe-node 12 are gone). The app and CRM keep API version 2022-11-15 on their own clients; no app or CRM file changed (`568ffc7`) |
| Admin sign-in (the admin panel's security questions, answered in that doc) | Done: one 401 `INVALID_CREDENTIALS` answer for every failed login; 12-hour tokens with a `token_version` (migration `20261016-0900`); `POST /admin/auth/logout` and a new password end every session; the app's admin screens on the same check (401, never 500); the OTP request answers the same for any email (`d4900c0`) |
| For the admin panel as it is | Done: double slashes collapsed, `department_id` optional, up to 20 photos on a card from an admin, 20 `images` per upload (`d4900c0`) |
| File links on the API host | Done: migration `20261016-0800` (2,584 values in 28 columns on the local copy; analytics, Stripe events and backups keep theirs; originals in `file_url_backup`) (`d4900c0`) |
| Testing mode, pm2, production settings, `check:server` | Done: `JOBS_ENABLED`; emails logged with their links under `MAIL_TRANSPORT=log`; pm2 `glamlink-api` in `/var/www/api` (the old process is `glamlink-backend` in `/var/www/backend`); production refuses a weak `JWT_SECRET` or a missing `API_BASE_URL`/`ACCESSDOMAINS`, and sign-ups without a Turnstile secret; 10 guest cards an hour per address; `STORAGE_DIR` in `.env` now read; `npm run check:server` (`d4900c0`) |
| No template names left (Mohit: "no counselor baggage in any form") | Done: migration `20261016-1000` renames the four indexes still called `counselor_id` (appointments, cases, reviews, slots), the five admin permissions called "Esthetician" and two GlamCoin rule titles saying "Beautician"; `test/templateNames.test.js` fails if a template name comes back into the schema. No route, response field, column, table, enum, email or setting carries one. The one app review that said "Counsellor" is removed (migration `20261016-1100`, Mohit's go-ahead); AI skin-analysis text that says "beautician" stays as written. A professional account made without a profession now has none (it was "Esthetician"; the website never reads it). Records that must name them stay: the migrations that rename or drop them, the old database's baseline schema, the docs. App phase: the app's appointment, case and scheduler code |
| Mohit's decisions | Drafts 14 and 59: fine. 23 complimentary seats: keep. Kate Sibley: keep "Kate Sibley", delete card 21 (soft, migration `20261016-1100`). The review: removed. Default profession: empty. The code that deploys is on `master` |
| Runbook and notes | Done: deploy.md; both handoff notes (Turnstile site key, the directory form's fields, admin sign-in and sign-out, the 20-photo gallery); the admin security questions answered; audit and plan updated. Tests 132; contract identical apart from the moved file links (baseline `go-live-baseline.json`) |

## Phase 2b: Access (done Oct 16, branch `phase5/security`); frontend takeovers after the first deploy

Access design: access.md (Oct 16). Build order and status:

| Step | Status |
| --- | --- |
| 1. The card's fields (one create and one edit path, the website's checks, media limits, phone privacy) | Done: `cardFields.js` (the form's fields and checks, `INVALID_CARD` with the field), `cardMedia.js` (4 photos, 1 video, thumbnails, captions), `cardWriter.js` (one transaction for card, locations, hours, media; links of deleted cards stay reserved), `cardPublic.js` (no account, plan or hidden phone in public responses); the three create functions and the edit (2,460 lines) replaced. Contract: only the four public card reads change, as intended. Tests: `test/cardFields.test.js` |
| 2. Drafts, one card per person, claim, owner delete and re-create on the same link | Done: guest cards are drafts (`status` gains `draft`, migration `20261016-0300`: on the local copy cards 14 and 59, unowned and never paid, became drafts; their status is kept in `business_card_status_backup`); a guest is never attached to an existing account (`ACCOUNT_EXISTS`, then `POST /access/cards/:id/claim`); one live card per person (`CARD_EXISTS`, `replace`) for website and admin creates; `DELETE /access/cards/:id` for owners; the next card takes the person's link, QR, keychain and plan; verified emails get only non-draft cards. Tests: `test/cardOwnership.test.js` |
| 3. Plans, products, prices, discounts, personal prices, settings | Done: migration `20261016-0400` (products at $4.99/month and $39.99, the four website plans, settings), `catalog.js` (prices for a person: personal price, else the list price less the running sale; one sale at a time), `GET /access/plans`, admin endpoints under `/access/admin` (plans, price with history, discounts, personal prices, settings). Moving subscribers to a new price comes with step 4. Tests: `test/catalog.test.js` |
| 4. Stripe: stripe-node 23, checkouts, seats, webhook handlers, setup and reconcile scripts | Done: `integrations/stripe.js` (stripe-node 23 as `stripe-current`; the app and CRM keep stripe-node 12); migration `20261016-0500` (seats: 6 with Stripe, 23 complimentary on the local copy; checkouts; a Shipping product); `checkout.js` (quote stored first, a Subscription for Pro with the keychain and shipping on its first invoice, a PaymentIntent for the keychain alone; idempotent), `payments.js` (invoice.paid, subscription updates and endings, payment_intent.succeeded: account, seat, live card, payment, order, emails), `subscriptions.js` (cancel at period end, resume, complimentary seats, moving subscribers to a new price), the old purchase calls on top; shared billing runs handlers products register (its Access code and models removed); `npm run stripe:setup`, `npm run stripe:reconcile`; the admin order email links to the order. Tests: `test/accessPayments.test.js` with a fake Stripe |
| 5. Shippo: address check, rates, labels, tracking webhook | Done: `integrations/shippoApi.js` (API 2018-02-08: one-call address check, newer v2 check when enabled, rates, customs, labels, refunds, tracking); `shared/users/shippingAddress.js` (every delivery address checked and saved as Shippo corrected it, second street line, recipient, phone; the old two-call check and its database code left the integration, removing a boundary exception); `editAddress` only for the owner's addresses (it edited any address); shipping addresses are no longer served as business addresses (`getBuinessAddressById` was public); `fulfillment.js` (labels: rate from checkout or today's, void; tracking webhook with the URL token and Shippo's HMAC); migration `20261016-0600` (52 card addresses marked as shipping on the local copy). Tests: `test/shipping.test.js` with a fake Shippo |
| 6. Entitlements and the edit rules | Done: `entitlements.js` (the settings' Free and Pro rights; an owner's edit of a live card is checked by what really changes, so the whole form sent back passes; photos and offers need Pro by default; details too if an admin turns Free editing off; new cards' photo limits and offers; offers hidden on public cards whose owner is not Pro); admins and drafts are not limited. Tests: `test/entitlements.test.js` |
| 7. Handoff notes, runbook steps | Done: each step in both handoff notes' changelogs and sections (website 9.1–9.6, admin 7.1–7.3); the setup steps for the runbook in access.md section 11; contract baseline `phase2b-access-baseline.json` |

## Phase 2a: security (done Oct 16, branch `phase5/security`)

Items and their status: plan.md (Phase 2a) and audit.md. Contract baseline after these fixes:
`C:/Users/mohit/mysql/snapshots/phase5-security-baseline.json`.

| Item | Status |
| --- | --- |
| 1. Card token for the logged-out purchase | Done: `POST /businessCard` returns a 24-hour `card_token`; the six purchase calls and edits of an unowned card require it (or the owner, or an admin); `editAddress-public` edits only the card's own address. Tests: `test/cardAccess.test.js` (`cc2a641`) |
| 2. One admin guard | Done: `requireAdmin` on every website and shared admin route (blog, blog categories, professions, admin change-password; the redundant old check on `/admin/*` removed, so Bearer tokens work there); admin sign-in and admin OTP verification refuse deactivated admins. Tests: `test/adminGuard.test.js` (`0a51572`) |
| 3. Error handling | Done in shared and website code: 199 catch-and-rethrow wrappers removed (whitespace aside, only the wrapper lines change), so unexpected errors reach the error handler, are logged with their stack and answer a generic 500; Stripe payment errors keep their status and message (`PAYMENT_FAILED`); codes added to the address, NFC and admin-guard errors, messages unchanged. The old admin check (app routes only) is left as it is. Tests: `test/errorHandling.test.js` (`f2edce0`) |
| 4. Topic page emails | Done: `GET /journal/topic/:id` leaves professionals' emails out unless the caller is an admin. Tests: `test/topicPrivacy.test.js` (`80495eb`) |
| 6. Google key | Done: read from `GOOGLE_API_KEY`; Mohit rotated the key (Oct 16). The new key goes in the server `.env` at deploy |
| 7. Stripe webhook idempotency | Done: each event is claimed in `stripe_events` after its signature is verified; a repeat delivery answers 200 `duplicate: true` without processing; a delivery that does not succeed releases its claim so Stripe's retry is processed. Migration `20261016-0100-stripe-events`. Tests: `test/stripeWebhook.test.js` |
| 8. CORS | Done: no `Access-Control-Allow-Origin: *` on every response; only the origins in `ACCESSDOMAINS` get CORS headers; another origin is refused with 403 `ORIGIN_NOT_ALLOWED` before the request runs (was a 500). Tests: `test/cors.test.js` |
| 9. `PUT /ads/sort-order` | Done: registered before `PUT /ads/:id`, which used to catch it (`edea8ca`, with item 8) |
| 5. Card bio | Done: every save cleans the bio with `sanitize-html` and an allow-list matching the website's bio editor (paragraphs, bold, italic, underline, strike, h3, lists, quotes, links over http, https, mailto and tel). Migration `20261016-0200` cleans stored bios that would lose markup and keeps the originals in `business_card_bio_backup`: 0 of 293 on the local copy. Data migrations may now use a module through its index.js. Tests: `test/cardBio.test.js` (`d0dca4f`) |
| 10. Directory filter | Done: `GET /businessCard/filter?location=` wrote the location into the SQL (an injection on a public route); it is compared as a value now. Test in `test/cardBio.test.js` (`d0dca4f`) |

## Phase 1: restructure into products (Oct 16, branch `phase4/structure`)

No behaviour change: every route's handlers and guards, the model table and the 67-endpoint contract stayed
identical throughout (20 app admin routes now run the admin check twice; same result).

| Commit | What |
| --- | --- |
| `899f4f3` | Consistent model file names; misspelt function names fixed; `npm run check:models` |
| `d335fda` | Catch-all files split by product (users, adminOp, orders/addresses, the Stripe controller, validators) |
| `6629fca` | Code grouped into `shared/`, `website/`, `mobile/`, `crm/` (227 git renames) |
| `5b908d1` | Every model moved into the module that owns its table |
| `9e98997` | Each module defines its own associations |
| `67f1cc2` | An index.js per module; `scripts/check-boundaries.js` in `npm run lint` |
| `cbc20dc` | One CORS file |
| `478f0e6` | Template `@format` headers dropped |
| `6416b02` | docs/architecture.md |

## Clean-up and seeds (Oct 15, branch `phase3/identity`)

| Commit | What |
| --- | --- |
| `5018d29` | Unused files removed |
| `81323c8` | Firebase credentials from environment variables (no key file in the repo) |
| `1df712d`, `e790489` | `npm run seed` with production reference data; countries, states, cities and timezones cut to the US and Canada |

## Phase 3: identity (Oct 14, branch `phase3/identity`)

One account per email (`account_type`, `professional_type`), duplicate accounts merged (professional wins),
email-link verification and password reset, rotating sessions with a refresh cookie for the website, explicit
sign-in rules on every route, the `role_id` header ignored, counselling-template tables dropped.
Commits `01c3581` … `a8f593f` (migrations, tests, identity model, account merge, sessions, cookie, sign-in rules,
handoff notes).

## Phase 2: modules and packages (Oct 14)

Modular layout (`11d2b3e`), counselling-template features removed and the CRM parked (`a2e5038`), dependencies
updated and trimmed (2a, `f489d3f`), oxlint with every error fixed (2b, `2b21210`), runtime storage outside the
repo (`b61b0c6`), Express 5 (`022dfb8`), Luxon instead of moment (`0f0a5c6`), axios/joi/winston/morgan/openai
replaced by small local code, "counselor" and "beautician" renamed to "professional" (2d, `82eb8ed`, `f50aee6`).

## Phase 1 (foundations) and Phase 0 (critical security) (Oct 14)

Phase 0 (`0e4bd78`): admin guard on 201 back-office routes, admin register closed, SSO switched off,
SQL injections fixed, rate limiter on the real auth paths and OTP attempt caps, USD forced and webhook amount
checks, logs endpoint removed, secrets no longer logged, upload size limits.
Phase 1: local MariaDB copy of production, contract check (`b10fa6f`), app starts without Firebase (`09f8a54`).

## Before

Oct 7: backend audit; dead-code clean-up (`4b1679c` on `main`, 8,212 lines removed).
