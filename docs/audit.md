# Audit findings and their status

Two audits found these issues: the backend audit of Oct 7 (all 424 files of the old backend) and the website audit
of Oct 15 (its backend-related items). Full reports: see README.md. Status is updated as fixes land.

Status: **Fixed** (commit) · **Partly** (what is left) · **Open** (where it is planned) · **App / CRM** (in code we
do not touch until the app or CRM phase).

## Security (backend audit: 23 findings)

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | Critical | SSO trusted the email: a token for any account | Fixed by switching it off: `POST /user/auth/sso` answers 501 (Phase 0, `0e4bd78`). Verified Google/Apple sign-in comes with the app phase |
| 2 | Critical | Public admin sign-up; `"role_id": 1` as a number made a Super Admin | Fixed: admin register needs an admin (Phase 0) |
| 3 | Critical | Open payout: any professional_id and amount | Fixed: admin only (Phase 0) |
| 4 | Critical | CRM premium price chosen by the client | Fixed: CRM premium purchase removed (Phase 0) |
| 5 | Critical | Client chose the currency; webhook checked no amount | Fixed: USD forced; the webhook checks amounts and activates only paid promotions (Phase 0) |
| 6 | Critical | SQL injection through the `fcm_token` header | Fixed: parameterized (Phase 0); the token table is no longer written (sessions, Phase 3) |
| 7 | Critical | SQL injection in `POST /user/search` | Fixed: LIKE terms escaped (Phase 0) |
| 8 | Critical | OTP brute force, rate limiter on a dead path | Fixed: limiter on the real auth paths, 5 wrong codes burn an OTP (Phase 0); user OTPs replaced by email links (Phase 3) |
| 9 | High | About 100 data-changing routes without auth | Fixed: admin guard on 201 back-office routes (Phase 0), explicit sign-in rules on every route (Phase 3, `6714501`). Website and shared routes all use `requireAdmin` (Phase 2a). App: the app back-office routes and the app service categories still use the old check, until the app phase |
| 10 | High | Personal data readable without login | Fixed: admin lists (Phase 0); the logged-out card purchase now needs the card token, the owner or an admin (Phase 2a) |
| 11 | High | Shipping labels and push notifications without login | Fixed: owner-or-admin and admin only (Phase 0) |
| 12 | High | Server logs public at `/api/v1/logs` | Fixed: removed (Phase 0) |
| 13 | High | Admin tokens never re-checked; deactivated admins keep access; admin login ignores `is_active` | Fixed: `requireAdmin` re-checks the admin is active (Phase 0) and is the only admin check on website and shared routes; admin sign-in and admin OTP verification refuse deactivated admins (Phase 2a); the app's admin screens use the same check, tokens last 12 hours and end on sign-out or a new password (go-live fixes). Open: admin roles are never enforced (all admin roles have the same power) |
| 14 | High | Promotion webhook activated unpaid promotions | Fixed (Phase 0) |
| 15 | Medium | "Login required" let guests through on 187 routes | Fixed: `authenticate` / `optionalAuth` / `requireProfessional` (Phase 3) |
| 16 | Medium | Passwords and tokens written to logs | Fixed (Phase 0) |
| 17 | Medium | Uploads accepted on every route, no size limit | Partly: 50 MB per file, files removed when a request fails (Phase 0). Upload parsing still runs on every `/api/v1` request because the admin panel sends multipart bodies to plain endpoints |
| 18 | Medium | Shippo webhook not verified | Website: the new keychain tracking webhook checks the secret token in its URL and Shippo's HMAC once set up (Phase 2b). App: its order shipping is unchanged (`src/mobile/commerce`) |
| 19 | Medium | Admin tokens signed with `Buffer.from(JWT_SECRET, "hex")` | Fixed: production refuses to start unless `JWT_SECRET` is at least 64 hex characters (go-live fixes). User tokens use a derived key (Phase 3) |
| 20 | Medium | Google Maps key hard-coded in source | Fixed: read from `GOOGLE_API_KEY` (Phase 2a); Mohit rotated the key (Oct 16). The new key goes in the server `.env` |
| 21 | Low | `.env.example` held real-looking credentials | Fixed: placeholders only (Phase 2b, `73092bc`) |
| 22 | Low | Login reveals whether an email exists | Fixed: one `INVALID_CREDENTIALS` answer for users (Phase 3) and admins (go-live fixes); the admin OTP request answers the same for any email |
| 23 | Low | CORS configured three ways; `Access-Control-Allow-Origin: *` on every response | Fixed: one CORS file (`cbc20dc`); no wildcard; only `ACCESSDOMAINS` origins get CORS headers; others are refused with 403 (Phase 2a) |

## Bugs (backend audit: 32 findings)

Website and shared:

| Finding | Status |
| --- | --- |
| Error handler called `next(err)`, every error logged twice | Fixed (Phase 1) |
| Missing imports turned handled errors into crashes (token.service, discover and shippo controllers, professionalForm.service) | Fixed: oxlint with undefined-name errors (Phase 2b, `2b21210`) |
| Login crashed without a `timezone` header | Fixed: login history never blocks a sign-in (Phase 3) |
| Expired tokens answered 500 | Fixed: 401 `SESSION_EXPIRED` (Phase 3) |
| Token lifetime read an unvalidated variable as days | Fixed: `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` (Phase 3) |
| `/user/auth/reset-password` skipped validation; reset tokens never expired; OTP compared as string | Fixed: email-link reset with expiry (Phase 3) |
| `roles.sql` missing a comma | Fixed: seeds regenerated from production (`1df712d`) |
| Account deletion crashed on an undefined `Post_Tag`, no transaction | Partly: the crash is fixed (Phase 2b); still no transaction |
| Access-order admin email links to `config.ADMIN_URL`, which does not exist | Fixed: `ADMIN_URL` (default `https://admin.glamlink.net`), and the email now shows the link (it was never rendered) (Phase 2b) |
| `GET /payment/sum` adds DECIMAL strings | Open (Phase 2b, check) |
| SMTP `secure: true` hard-coded | Partly: `.env.example` documents port 465 |
| Controllers assigned undeclared globals | Fixed (Phase 2b lint) |

App and CRM (not touched until their phases): checkout rounding, tax lines, stock, payout sums, Shippo order lookup,
order notification, appointment detail and seats, review counts, admin delete-service crash, the `BAD_Request`
typo, the ServiceLocation hook, the per-minute CRM cron that restarts the server on a database error. The legacy
`createOrder` route and the counsellor endpoints were removed (Phase 2, `a2e5038`).

## Roles and naming (backend audit)

| Finding | Status |
| --- | --- |
| Three end-user types under role ids 6, 7, 8 (+ 9 CRM staff); the client chose its role through a `role_id` header | Fixed: one account per email, `account_type` and `professional_type`; the header is ignored (Phase 3) |
| "Counselor" naming everywhere | Fixed in code and routes (Phase 2d); database columns renamed by migration (Phase 3); the last index names, admin permission labels and GlamCoin titles renamed, with a test that keeps the schema clean (go-live fixes). Left as written: text people wrote (one app review says "Counsellor") and AI skin-analysis output that says "beautician" |
| Counselling-template features (fees, prices, trials, keywords admin, video calls) | Removed (Phase 2). App phase: the app's appointment, case and scheduler code (`src/mobile/bookings`; `appointments` and `slots` are empty, `cases` has 14 rows with statuses such as TRIAL) |
| Three error formats; status codes vary | Partly: errors carry `success: false`; auth, card, address, payment and admin-guard errors carry a `code`; website and shared code no longer sends raw database or library messages (Phase 2a: 199 catch-and-rethrow wrappers removed, unexpected errors logged with their stack). Open: validation errors from `responseWrapper` still say `success: true` (changes with both frontends) |
| Typos in file and function names | Fixed (`899f4f3`); misspelt admin URLs kept because the admin panel calls them |

## Website audit (Oct 15): items the backend owns

| Item | Status |
| --- | --- |
| Topic page returns users' private fields | Fixed: only the id (and the profile name) is public; emails only for admins (Phase 2a) |
| Card `bio` stored and shown as raw HTML (stored XSS) | Fixed: cleaned on save with an allow-list; stored bios checked by a migration (Phase 2a, `d0dca4f`) |
| Purchase, plan, address and shipping calls take a bare card id with no auth | Fixed: card token (Phase 2a) |
| `role_id: 7` header trusted | Fixed: ignored (Phase 3) |
| Tokens in localStorage | Fixed on the backend: refresh token in an httpOnly cookie (Phase 3); the website must adopt it |
| Auth errors answered 200 | Fixed: real statuses and codes (Phase 3) |
| Captcha skipped when the key is missing | Fixed: the API checks the Turnstile token (Phase 3), and production refuses sign-ups while its secret is missing (go-live fixes; before, a missing key let them through) |
| Hard-coded prices, edit lock only in the UI | Fixed: plans and prices from `GET /access/plans`, plan features enforced by the API (Phase 2b, access.md) |
| Ad selection in the browser, ad tracking 404, journal paging in the browser, mock directory, YouTube key in the browser, four forms that send nothing, analytics counts easy to inflate | Open (Phase 2b) |
| Password rules differ between sign-up and reset | Fixed: one rule (Phase 3) |

Found during the work (not in the audits):

| Item | Status |
| --- | --- |
| `PUT /ads/sort-order` unreachable: `PUT /ads/:id` is registered first | Fixed (Phase 2a) |
| A disallowed CORS origin gets a 500 | Fixed: 403 `ORIGIN_NOT_ALLOWED` (Phase 2a) |
| `PUT /order/editAddress-public/:id` edited any address by id and re-pointed the card at it | Fixed: only the card's own address (Phase 2a) |
| A card nobody owned could be edited by anyone (`updateBusinessCard`, featured-link reorder) | Fixed: card token or an admin (Phase 2a) |
| SQL injection in `GET /businessCard/filter?location=` (public) | Fixed: compared as a value (Phase 2a, `d0dca4f`) |
| A guest card is attached to any existing account whose email it uses (`POST /businessCard`) | Fixed: drafts, sign in and claim (Phase 2b step 2) |
| `getAllProfiles` and the public card return the owner's subscription fields, and the phone even when hidden | Fixed (Phase 2b step 1) |
| A subscription-only purchase could not make its access order (the model refused an empty fulfillment status) | Fixed (Phase 2b step 4) |
| `PUT /order/editAddress/:id` edited any address by its id (any signed-in account) | Fixed: own addresses only (Phase 2b step 5) |
| `GET /order/getBuinessAddressById/:id` (no sign-in) served any address, including Access card buyers' delivery addresses | Partly: delivery addresses are no longer served (Phase 2b step 5); the route stays public for the app's business addresses until the app phase |
| The renewal webhook read `invoice.subscription` and the period fields Stripe moved (API 2025-03-31 onwards) | Fixed: Access payments rebuilt on API 2026-09-30 (Phase 2b step 4) |
| The pm2 config named the app `glamlink-backend` in `/var/www/backend`, the old backend's name and folder on the same server | Fixed: `glamlink-api` in `/var/www/api` (go-live fixes) |
| A `STORAGE_DIR` set in `.env` was ignored (the storage path was read before `.env` loaded) | Fixed (go-live fixes) |
| The app's admin screens (`validateJWTtoken`) let deactivated admins in and answered an expired token with 500 | Fixed: the same check as every admin route (go-live fixes) |
| Admin tokens lasted 5 days and could not be ended (sign-out only deleted the browser's copy) | Fixed: 12 hours, ended on sign-out or a new password (go-live fixes) |
| Guest cards (`POST /businessCard`) had no rate limit; each can become an account and a live card | Fixed: 10 an hour per address in production (go-live fixes) |
