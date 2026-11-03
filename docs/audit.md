# Audit findings and their status

Three audits found these issues: the backend audit of Oct 7 (all 424 files of the old backend), the website audit
of Oct 15 (its backend-related items), and the audit of Oct 30 (the website and admin side of this backend, with the
API contract of both clients). Full reports: see README.md. Status is updated as fixes land; the whole file was
checked against the code (`aadb56a`) on Oct 30. On Nov 2 the findings that the Nov 1–2 work (Access fixes, one form,
brands, Stripe; progress.md) fixes were checked against that code and marked "Fixed (Nov 1, not deployed)" with the
file: it is built and tested, committed on Nov 4, and not deployed.

Status: **Fixed** (commit) · **Partly** (what is left) · **Open** (where it is planned) · **App / CRM** (in code we
do not touch until the app or CRM phase).

## Audit of Oct 30 (website and admin scope)

Read-only, at `aadb56a`: `src/website`, `src/shared`, `src/core`, `src/integrations`, and every call the website and
the admin panel make. No critical finding in the backend's own code; two critical contract bugs. Below: every
critical, high and medium finding the backend owns (P0 Critical, P1 High, P2 Medium). "Next N" is the step in
plan.md, "Next (Oct 30)". IDs: SEC, OPS, FEAT, DATA, TEST, DEAD, STR from the backend review; W, X and A- from the
contract review (X-01 from the admin panel review).

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| A-CNT-1 | Critical | Saving an article with topics soft-deletes its topic links, then the re-insert hits the unique key: 500. Live, all 6 topics list 0 articles (`website/content/journal.service.js:681, 1785, 1798`) | Open (Next 1): `force: true` in one transaction, then restore the links |
| A-OTH-1 | Critical | Login records store no `ip_address`, and the admin panel's Login History crashes on it (`shared/identity/auth.service.js:35-42`) | Open (Next 2), with the panel's null-safe cell |
| X-01 | Critical | Public forms and card social fields accept any URL, `javascript:` included; the admin panel opens them (`partnershipInquiry.service.js:101`, `access-card/cardFields.js:152-160`) | Open (Next 2): accept only http(s) |
| SEC-02 | High | `GET /order/getBuinessAddressById/:id` is public, with sequential ids, and returns names, phones and addresses (verified live); no client calls it (`shared/users/address.route.js:11`) | Open (Next 3): remove |
| W-1 | High | The public `GET /journal/topic/:id` includes featured professionals' whole cards: hidden phone, plan, subscription status, cards of any status (`journal.service.js:1378-1426`) | Open (Next 4): allow-list the fields |
| SEC-01 | High | The admin OTP flow gives a 24-hour admin token for a plain-text 6-digit code that never expires; no UI uses it (`shared/admin/adminAuth.route.js:14-16`) | Open (Next 5): remove the three routes |
| A-CNT-3 | High | Public topic pages list draft articles, draft products and paragraphs from drafts (`journal.service.js:1329-1331, 1439-1441, 1824-1828`) | Open (Next 6) |
| OPS-01 | High | The server `.env` says `NODE_ENV=test`; only pm2's env makes the API production. A restart without it turns off rate limits, email, jobs and the secret checks | Open (Next 7): `production` in `.env` (deploy.md, "As deployed") |
| OPS-02 | High | SQL dumps with personal data in the server's root folder; no verified backup | Open (Next 7) |
| OPS-03 | High | The CRM's per-minute job is neither awaited nor caught; a database error exits the API (`src/crm/index.js:15-17`, `index.js:39`) | Open (Next 7) |
| SEC-03 | High | Uploads are parsed before auth on every request and kept on any 2xx answer, so anyone can host files on api.glamlink.net (`app.js:121`, `core/http/uploads.js:138-168`) | Open (Next 8). Was #17 below |
| SEC-04 | High | The legacy Google list and details endpoints are public, uncached and unlimited; the website's `/journal/directory` calls details for every result (`shared/users/user.route.js:24-25`) | Open (Next 8): remove with that page |
| FEAT-01 | High | Contact Us stores messages but emails no one and has no admin screen; the website sends account-deletion requests there (`website/inquiries/contactUs.service.js:7-21`). Contract X-1 | Open (Next 8) |
| A-ACC-1 | High | The access-orders list reads paging and filters from `req.body` on a GET, so it always shows the newest 10 (`access-card/businessCard.controller.js:303`) | Fixed (Nov 1, not deployed): read from the query string (`access-card/businessCard.controller.js` `getAllAccessOrders`), filters checked, `cancelled` added (`businessCard.service.js`) |
| A-CNT-4 | High | Products and podcasts still list deleted topics, whose GET answers 404, so their later saves fail (`discover.service.js:273-283`, `podcastSchedule.service.js:73-83`) | Open (Next 8) |
| A-CNT-5 | High | CSV upload refuses files typed `application/vnd.ms-excel` (Windows with Excel) (`core/http/uploads.js:91-99`) | Open (Next 8) |
| A-CNT-6 | High | CSV import downloads every row's image inside the request; large files time out and a retry duplicates products (`discover.service.js:540-553`) | Open (Next 8) |
| A-OTH-3 | High | Ads write the string `"null"` into the INT `height` column: 500 under strict SQL mode (`content/ad.service.js:53, 163-165`) | Open (Next 8) |
| W-ACC-3 | High | A guest whose email has an app account cannot buy: `ACCOUNT_EXISTS` on every purchase call, and website sign-in refuses the account (`access-card/cardOwnership.js:55-60`) | Fixed (Nov 1, not deployed), by Mohit's decision that an app account must not block a website purchase: its email counts as new (`access-card/cardOwnership.js` `websiteAccountFor`), and the card going live converts the account to a professional one of the card's type (`shared/identity/account.service.js` `accessCardOwner`). Sign-in still refuses app accounts; none is deleted |
| SEC-05 | Medium | Admin roles are never enforced: any admin can create, rename or delete any admin, the Super Admin included; no password rules for admins (`shared/admin/access.middleware.js:15-38`, `admin.service.js:80-133`) | Open. Was the open part of #13 below |
| SEC-06 | Medium | `JWT_SECRET` is checked only in production; a non-hex secret decodes to an empty key (`core/config/config.js:34-40`) | Open. See #19 below |
| SEC-07 | Medium | Admin email templates insert form values unescaped; partnership inquiries go to one person's outside mailbox (`templates/accessCardTemplate.js:693-760`, `email.service.js:1109`) | Open |
| SEC-08 | Medium | No rate limit on Contact Us, partnership inquiries, guest applications, card analytics events and directory search; every limiter applies only in production | Open |
| SEC-09 | Medium | Tokens in the access log (full URLs), whole Stripe charges logged, `scripts/create-super-admin.js` prints the password | Open |
| SEC-10 | Medium | Card analytics and the mailer return internal error text to clients | Open |
| A-OTH-9 | Medium | The admin's user detail sends the password hash, `remember_token`, Stripe and push ids to the browser (`shared/admin/admin.service.js:346-349`) | Open |
| OPS-04 | Medium | A static health check, no error tracking, an access log that never rotates, no graceful shutdown | Open |
| OPS-05 | Medium | Staging runs in development mode: SQL with values in the logs, no limits, no secret checks (`ecosystem.staging-config.json:14`) | Open |
| FEAT-02 | Medium | Built, but the website has no screen: `/my/directory`, `/directory/listings/:id`, `DELETE /access/cards/:id` | Open (website) |
| FEAT-04 | Medium | Refunds are not handled: no `charge.refunded` handler (`access-card/payments.js:230-277`) | Fixed (Nov 1, not deployed), recorded only (Mohit: the API never refunds): `charge.refunded` and the five `charge.dispute.*` events mark the payment and the order (`access-card/payments.js` `recordRefund`, `recordDispute`); plan, seat and shipping stay |
| DATA-01 | Medium | Card handles are not unique, and pages pick one with no tie-break (`profiles/profileQuery.js:102-120`) | Open |
| DATA-02 | Medium | Deleting a card or a user hard-deletes payment rows and never cancels the Stripe seat | Partly fixed (Nov 1, not deployed): deleting an account, by an admin or the person, ends its Access Pro at Stripe at once with no refund, and the account stays if Stripe refuses (`shared/billing/accountBilling.js`, `access-card/subscriptions.js` `endSeatOfClosedAccount`; BE-15). Open: payment rows are still deleted with a card or an account, as before (an admin's card delete: `businessCard.service.js` `deleteBusinessCard`, BE-19) |
| TEST-01 | Medium | `npm test` drops every table of `glamlink_test` on whatever host `.env` names (`test/setup.js:8-21`) | Open: refuse non-local hosts |
| TEST-02 | Medium | 92 endpoints a client uses have no test (journal topics and FAQs, discover CRUD and CSV, ads, access orders, admin users) | Open |
| TEST-03 | Medium | No test checks every route's auth rule | Open |
| DEAD-01 | Medium | The mobile app and the CRM (264 + 1 routes, 2 jobs, Firebase, a Stripe client built at load) run inside the web API | Open (Later) |
| STR-01 | Medium | The directory feature is spread over four modules | Open (Later) |
| W-ACC-7 | Medium | Card analytics never answer `UPGRADE_REQUIRED`: Free owners get Pro analytics | Fixed (Nov 1, not deployed): `requireAnalyticsPlan` (`access-card/entitlements.js`) on the card analytics (`access-card/accessCardAnalytics.route.js`) and on `GET /my/profile/analytics` (`profiles/myProfile.route.js`) |
| W-ACC-8 | Medium | Card analytics count UTC days and ignore the `timezone` header | Open |
| A-ACC-5 | Medium | `deleteCategory` leaves mappings that would make the directory list answer 500 | Open |
| A-CNT-7 | Medium | The admin shop list lacks `owner` and `brand_profile` | Open |
| A-CNT-13 | Medium | Renaming a topic remakes its slug, so old links break; a deleted topic's name answers 500 | Open |
| A-CNT-14 | Medium | Deleting an author in use leaves articles with a dangling author | Open |
| A-OTH-4 | Medium | Ad dates cannot be cleared on edit | Open |
| A-OTH-6 | Medium | The magazine admin view lacks the raw Publuu and flipbook fields, so a save can erase them (the panel's BA2) | Open |
| A-OTH-7 | Medium | `/admin/users/list/:roleId` maps every id except 7 to 6, so brand accounts are on no list | Open |
| A-OTH-8 | Medium | The admin users list takes no search | Open |
| A-OTH-12 | Medium | `/profession` answers the page's row count as `count` | Open |
| A-OTH-13 | Medium | Renaming a profession orphans the profiles that have it (they store the title) | Open |

Low, all open; described in the Claude Docs audit: SEC-11 to SEC-15, OPS-06 to OPS-08, FEAT-03, DATA-03 to DATA-07,
TEST-04, DEAD-02 to DEAD-07, STR-02 to STR-06, W-10, W-14, X-2, A-OTH-20, A-CNT-20. Also low, from the contract review:

- X-3: `getAllDirectories` counts the directory and category join, not directories (`businessCard.service.js:1277-1329`).
- W-3: `getAllProfiles` and `getBusinessCardById` send `specialties`, `social_media` and `important_info` as JSON
  strings; cleaner card answers wait for both frontends (`cf8edcf`).
- W-ACC-9: a card's `access_orders` are not newest first (the include's `order` is ignored, `businessCard.service.js:324`).
  Still open in the API; the website sorts them itself since Nov 1.
- W-ACC-12: no endpoint tells the website a plan's photo and video limits (admin settings). Fixed (Nov 1, not
  deployed): `GET /access/plans` answers `entitlements` (`access-card/catalog.js`).
- W-10 (in the list above): `/access` changes send no refresh tags. Partly fixed (Nov 1, not deployed): a claimed
  draft, an owner's deleted card and a Free card going live send `cards` and `profiles` (`access-card/cardOwnership.js`,
  `businessCard.service.js`); an admin's subscription change still sends none.
- A-ACC-14: a directory's saved image cannot be cleared (`businessCard.service.js:1218-1221`).
- A-CNT-15: clearing some fields is ignored (category description, podcast fields, article image, author fields).
- A-CNT-17: the "category in use" refusal names `"undefined"` and has no `code` (`journalCategory.service.js:133-136`).
- A-OTH-14: deleting a user leaves their professional-form answers, which then break the review list.
- A-OTH-17: ad, user and profession by id answer 200 with a string on a miss (as X-2).
- A-OTH-18: validators answer 4xx with `success: true` (`core/http/responseWrapper.js:3`).

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
| 10 | High | Personal data readable without login | Fixed: admin lists (Phase 0); the logged-out card purchase now needs the card token, the owner or an admin (Phase 2a); `GET /user/profile/:userId` shows only the public profile to anyone but the owner or an admin (Phase 6, found by the website). The old API on node.glamlink.net still has that leak: Mohit handles the old server |
| 11 | High | Shipping labels and push notifications without login | Fixed: owner-or-admin and admin only (Phase 0) |
| 12 | High | Server logs public at `/api/v1/logs` | Fixed: removed (Phase 0) |
| 13 | High | Admin tokens never re-checked; deactivated admins keep access; admin login ignores `is_active` | Fixed: `requireAdmin` re-checks the admin is active (Phase 0) and is the only admin check on website and shared routes; admin sign-in and admin OTP verification refuse deactivated admins (Phase 2a); the app's admin screens use the same check, tokens last 12 hours and end on sign-out or a new password (go-live fixes). Open: admin roles are never enforced (all admin roles have the same power): SEC-05, Oct 30 |
| 14 | High | Promotion webhook activated unpaid promotions | Fixed (Phase 0) |
| 15 | Medium | "Login required" let guests through on 187 routes | Fixed: `authenticate` / `optionalAuth` / `requireProfessional` (Phase 3) |
| 16 | Medium | Passwords and tokens written to logs | Fixed (Phase 0) |
| 17 | Medium | Uploads accepted on every route, no size limit | Partly: 50 MB per file, files removed when a request fails (Phase 0). Upload parsing still runs on every `/api/v1` request because the admin panel sends multipart bodies to plain endpoints. Oct 30: raised to High (SEC-03): files are kept whenever the answer is 2xx, so anyone can store files on api.glamlink.net |
| 18 | Medium | Shippo webhook not verified | Website: the new keychain tracking webhook checks the secret token in its URL and Shippo's HMAC once set up (Phase 2b). App: its order shipping is unchanged (`src/mobile/commerce`) |
| 19 | Medium | Admin tokens signed with `Buffer.from(JWT_SECRET, "hex")` | Partly: production refuses to start unless `JWT_SECRET` is at least 64 hex characters (go-live fixes), and user tokens use a derived key (Phase 3). Any other mode accepts any secret, and a non-hex one decodes to an empty key (SEC-06, Oct 30) |
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
| `GET /payment/sum` adds DECIMAL strings | Open: still wrong, and no client calls it; remove it (DEAD-05, Oct 30) |
| SMTP `secure: true` hard-coded | Partly: `.env.example` documents port 465 |
| Controllers assigned undeclared globals | Fixed (Phase 2b lint) |

App and CRM (not touched until their phases): checkout rounding, tax lines, stock, payout sums, Shippo order lookup,
order notification, appointment detail and seats, review counts, admin delete-service crash. Fixed since: the
`BAD_Request` typo (`src/mobile/social/post.middleware.js:11`) and the ServiceLocation hook. The per-minute CRM cron
is not app-only: it runs inside the web API, and a database error in it restarts the API (OPS-03, High, in the Oct 30
table). The legacy `createOrder` route and the counsellor endpoints were removed (Phase 2, `a2e5038`).

## Roles and naming (backend audit)

| Finding | Status |
| --- | --- |
| Three end-user types under role ids 6, 7, 8 (+ 9 CRM staff); the client chose its role through a `role_id` header | Fixed: one account per email, `account_type` and `professional_type`; the header is ignored (Phase 3) |
| "Counselor" naming everywhere | Fixed in code and routes (Phase 2d); database columns renamed by migration (Phase 3); the last index names, admin permission labels and GlamCoin titles renamed, with a test that keeps the schema clean (go-live fixes). The one app review that said "Counsellor" is removed (Mohit's go-ahead); AI skin-analysis output that says "beautician" stays as written. New professional accounts no longer default to the profession "Esthetician" |
| Counselling-template features (fees, prices, trials, keywords admin, video calls) | Removed (Phase 2). App phase: the app's appointment, case and scheduler code (`src/mobile/bookings`; `appointments` and `slots` are empty, `cases` has 14 rows with statuses such as TRIAL) |
| Three error formats; status codes vary | Partly: errors carry `success: false`; auth, card, address, payment and admin-guard errors carry a `code`; website and shared code no longer sends raw database or library messages (Phase 2a: 199 catch-and-rethrow wrappers removed, unexpected errors logged with their stack). Open: validation errors from `responseWrapper` still say `success: true` (changes with both frontends) |
| Typos in file and function names | Fixed (`899f4f3`); misspelt admin URLs kept because the admin panel calls them |

## Website audit (Oct 15): items the backend owns

| Item | Status |
| --- | --- |
| Topic page returns users' private fields | Fixed: only the id (and the profile name) is public; emails only for admins (Phase 2a). The professionals' card rows the same answer includes are still whole: W-1, Oct 30 |
| Card `bio` stored and shown as raw HTML (stored XSS) | Fixed: cleaned on save with an allow-list; stored bios checked by a migration (Phase 2a, `d0dca4f`) |
| Purchase, plan, address and shipping calls take a bare card id with no auth | Fixed: card token (Phase 2a) |
| `role_id: 7` header trusted | Fixed: ignored (Phase 3) |
| Tokens in localStorage | Fixed: refresh token in an httpOnly cookie (Phase 3); the website adopted it (access token in memory, `lib/session.ts`) |
| Auth errors answered 200 | Fixed: real statuses and codes (Phase 3) |
| Captcha skipped when the key is missing | Fixed: the API checks the Turnstile token (Phase 3), and production refuses sign-ups while its secret is missing (go-live fixes; before, a missing key let them through) |
| Hard-coded prices, edit lock only in the UI | Fixed: plans and prices from `GET /access/plans`, plan features enforced by the API (Phase 2b, access.md) |
| Ad selection in the browser, ad tracking 404, journal paging in the browser, mock directory, YouTube key in the browser, four forms that send nothing, analytics counts easy to inflate | Fixed in Phase 6 (Oct 23): live ads and `POST /ads/track` (`47211a3`), journal paging (`d06144f`), the directory (`568da4e`), videos imported by the API (`384e538`; the website still ships its browser key as a fallback), the forms (`8010dba`). Open: card analytics counts are still easy to inflate (public, unthrottled `POST /access-card/analytics/event`: SEC-08, SEC-11) |
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
| `GET /order/getBuinessAddressById/:id` (no sign-in) served any address, including Access card buyers' delivery addresses | Open, High (SEC-02, Oct 30): delivery addresses are no longer served (Phase 2b step 5), but business addresses still come with names and phones (verified live), and no client calls the route: remove it (plan.md, Next 3) |
| The renewal webhook read `invoice.subscription` and the period fields Stripe moved (API 2025-03-31 onwards) | Fixed: Access payments rebuilt on API 2026-09-30 (Phase 2b step 4) |
| The pm2 config named the app `glamlink-backend` in `/var/www/backend`, the old backend's name and folder on the same server | Fixed in the repo: `glamlink-api` in `/var/www/api` (go-live fixes). As deployed (reported Oct 30), `glamlink-api` runs from `/var/www/backend` on port 5500 with database `glamlinkdb`, so `ecosystem.config.json`'s `cwd` does not match the server (deploy.md, "As deployed") |
| A `STORAGE_DIR` set in `.env` was ignored (the storage path was read before `.env` loaded) | Fixed (go-live fixes) |
| The app's admin screens (`validateJWTtoken`) let deactivated admins in and answered an expired token with 500 | Fixed: the same check as every admin route (go-live fixes) |
| Admin tokens lasted 5 days and could not be ended (sign-out only deleted the browser's copy) | Fixed: 12 hours, ended on sign-out or a new password (go-live fixes) |
| Guest cards (`POST /businessCard`) had no rate limit; each can become an account and a live card | Fixed: 10 an hour per address in production (go-live fixes) |
