# Progress

Newest first. Each phase lists its commits; branches chain from `main` (old code) to the current one.

## Phase 2a: security (current, branch `phase5/security`)

In progress. Items and their status: plan.md (Phase 2a) and audit.md.

| Item | Status |
| --- | --- |
| 1. Card token for the logged-out purchase | Done: `POST /businessCard` returns a 24-hour `card_token`; the six purchase calls and edits of an unowned card require it (or the owner, or an admin); `editAddress-public` edits only the card's own address. Tests: `test/cardAccess.test.js` (`cc2a641`) |
| 2. One admin guard | Done: `requireAdmin` on every website and shared admin route (blog, blog categories, professions, admin change-password; the redundant old check on `/admin/*` removed, so Bearer tokens work there); admin sign-in and admin OTP verification refuse deactivated admins. Tests: `test/adminGuard.test.js` (`0a51572`) |
| 3. Error handling | Done in shared and website code: 199 catch-and-rethrow wrappers removed (whitespace aside, only the wrapper lines change), so unexpected errors reach the error handler, are logged with their stack and answer a generic 500; Stripe payment errors keep their status and message (`PAYMENT_FAILED`); codes added to the address, NFC and admin-guard errors, messages unchanged. The old admin check (app routes only) is left as it is. Tests: `test/errorHandling.test.js` (`f2edce0`) |
| 4. Topic page emails | Done: `GET /journal/topic/:id` leaves professionals' emails out unless the caller is an admin. Tests: `test/topicPrivacy.test.js` (`80495eb`) |
| 6. Google key | Done: read from `GOOGLE_API_KEY`; still to do by Mohit: rotate the key, set it in the server `.env` |

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
