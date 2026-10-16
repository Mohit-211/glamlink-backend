# Website frontend: backend API changes for the cutover

For: the Claude working on the Glamlink website (glamlink.net) frontend.
Backend: `api.glamlink.net`, all routes under `/api/v1`. Backend branch: `phase5/security` (it holds every earlier phase).

The backend and the website ship together in one cutover. After it, every signed-in person has to sign in
again (old tokens stop working). Everything below is what the website must change to work with the new
backend; anything not mentioned answers as before.

**Status:** the website is frozen until the backend is ready; this note collects everything to do then. The new
backend runs at `https://api.glamlink.net` (all routes under `/api/v1`), replacing `https://node.glamlink.net`.

## Checklist before the switch

Found by reviewing the website code (`glamlink_web`, Oct 16) against the new backend. Details in the sections below.

- [ ] `NEXT_PUBLIC_API_URL=https://api.glamlink.net/api/v1`, then rebuild (the value is fixed at build time).
- [ ] New sign-in (section 2): access token in memory, refresh cookie, `credentials: 'include'`, `client: "website"`.
      Detect an ended session by `code: "SESSION_EXPIRED"`, not by the old messages (`jwt expired`, `Token Not Found`).
      The direct `fetch` calls (card create/update, featured-link reorder, guest application) need the same handling.
- [ ] Pages `/verify-email` and `/reset-password` (section 3); remove `/verify-otp` and the OTP steps of
      forgot-password; logout is `POST`; change password moved to `/user/auth/change-password`.
- [ ] Drop the `role_id` header everywhere (sign-in, card create/update).
- [ ] `user/nearby/map/beautician/list` is now `user/nearby/map/professional/list` (section 5); rename
      `GetBeauticianListApi` and `GetBeauticianListDetailsApi` with it, and say "professionals" on the CSAM
      policy page, so no template word is left.
- [ ] The `/directory` featured carousel calls `businessCard/getAllBusinessCards`, which is admin-only: use the public
      `businessCard/getAllProfiles` (accepted cards only).
- [ ] Ad tracking posts to the relative `/api/ads/track` (the website itself, always 404); it will point at the API
      once the backend adds the endpoint (see the changelog).
- [ ] Logged-out card purchase: keep the `card_token` from `POST /businessCard` and send it on every purchase call;
      signed-in owners send their access token instead (section 8).
- [ ] A guest whose email has an account (`next_step: "sign_in"` or `ACCOUNT_EXISTS`): sign in, then claim the
      draft (section 9.2). `CARD_EXISTS` on create: offer edit or replace.
- [ ] The card form: at most 4 photos and 1 video; show `INVALID_CARD` errors under `details.field` (section 9.1).
- [ ] Plans and prices from `GET /access/plans` before any admin price change or sale (section 9.3).
- [ ] Free owners may edit details; photos, video and offers stay behind Pro (`UPGRADE_REQUIRED`, section 9.6).
- [ ] After cancelling, Access Pro runs to the end of the paid month: say so, offer resume (section 9.4).
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in every build: the API requires the Turnstile token on sign-up in production,
      and the form skips the captcha without the key (then sign-up fails with `CAPTCHA_REQUIRED`). Testing mode:
      Cloudflare's always-pass test site key `1x00000000000000000000AA`.
- [ ] The Stripe publishable key comes from the same account and mode as the API's secret key (test while testing).
- [ ] `/directory-form-apply` (`directoryForm.tsx`) posts to `POST /businessCard` too: send the photos as
      `profile_image` and `images` (it sends `profilePhoto` and `gallery_images`, which the API refuses with 400
      "Unexpected field", as the old API did), and continue like `/access` after it (section 9.2): the card is a
      hidden draft until a plan is chosen.

## Changelog

Newest first. Each entry says what changed in the API and what the website must (or can) do.

| Date | Change | Website |
| --- | --- | --- |
| Oct 16 | **Ready to run on api.glamlink.net** (the backend's `docs/deploy.md`). Stored file links (card photos, QR codes, gallery, journal covers and bodies) point at `https://api.glamlink.net/images/…` and `/videos/…` instead of `node.glamlink.net`; the files are copied. Sign-up in production needs the Turnstile token (an API without its secret key answers 503 `CAPTCHA_NOT_CONFIGURED` rather than letting sign-ups through). One address may create 10 guest cards an hour (`POST /businessCard`; refused attempts don't count), then 429 `TOO_MANY_REQUESTS`. A URL with a double slash (`/api/v1//journal`) now reaches its route | **Must:** the Turnstile site key in the build, and the directory form's fields (checklist). Nothing else: image URLs come from the API as before |
| Oct 16 | **The plan's features are enforced by the API** (section 9.6): once a card is live, its owner on Free can still change the details (text, links, hours, locations) but not the photos, the video or the profile image, and cannot run a special offer: 403 `UPGRADE_REQUIRED` with `details.feature` (`edit_media`, `special_offers`, or `edit_details` if an admin turns Free editing off). Pro may do all of it. Public cards show an offer only while the owner is Pro. Drafts, cards waiting for review and rejected cards can always be edited | **Should:** let Free owners edit their details (today the Edit button sends them to the plans), keep photos, video and offers behind Pro; show the offer fields to Pro owners; on `UPGRADE_REQUIRED`, offer the upgrade |
| Oct 16 | **Delivery addresses checked with Shippo in one step** (section 9.5): `order/addNewAddress-public`, `editAddress-public`, `order/addNewAddress` and `editAddress` save the address as Shippo corrected it and answer it, with `corrected: true` and `original_address` when Shippo changed it. New optional fields: `address_line_2`, `recipient_name`, `phone`. Refusals: 400 `ADDRESS_INVALID` (message unchanged: "Address validation failed: …"), 502 `ADDRESS_CHECK_UNAVAILABLE`. `editAddress` edits only the signed-in person's own addresses (it edited any address by id). The keychain ships to the US only unless an admin adds Canada | **Should:** show "We corrected your address to …" when `corrected`, and add an apartment/suite field (`address_line_2`) |
| Oct 16 | **Payments on the new Stripe integration** (section 9.4): a checkout quotes and stores what a plan costs for a card (`POST /access/checkout/quote`), then `POST /access/checkout/:id/pay` returns the Stripe client secret; `GET /access/checkout/:id` says when it is paid. The old calls (`shipping-rate[-public]`, `create-subscription[-public]`) now run on it: same requests and answers, plus `checkout_id`; prices come from the plans and sales, not from the browser. `cancel-subscription` now ends Access Pro at the end of the paid month (it ended it at once); `/access/subscription` shows the seat, `/access/subscription/cancel` and `/resume`. New refusals: 409 `ALREADY_OWNED` (buying Pro again), `NFC_ALREADY_PURCHASED` is now per person, 400 `SHIPPING_COUNTRY_UNSUPPORTED`, `CHECKOUT_EXPIRED` | **Nothing required:** `confirmCardPayment(clientSecret)` keeps working. **Should:** say "Your Pro plan ends on <date>" after cancelling, and offer resume; after paying, poll `GET /access/checkout/:id` until `paid` before showing the dashboard. **Can:** the Payment Element (`confirmPayment`) for Apple Pay, Google Pay and Link |
| Oct 16 | **Plans and prices from the API:** `GET /access/plans` (section 9.3): the four plans with name, label, badge, tagline, features (`soon`, `highlight`), and prices in cents for whoever asks (signed in: their personal prices and what they already own; a guest: `?business_card_id=` with the card token, for a personal price on their email; anyone: list prices and a running sale). Admins can now change prices, run a sale and give one client a personal price | **Must (before prices change):** build the plan cards and the "Continue" button from `/access/plans` instead of `plans.ts` (`PRO_PRICE`, `KEYCHAIN_PRICE`, the feature lists). **Can:** show the sale and its end date |
| Oct 16 | **Guest cards are drafts; one card per person** (section 9.2). `POST /businessCard` makes a draft (not public, not in the directory) and no longer attaches the card to an existing account with that email; it answers `status: "draft"`, `account_exists`, and `next_step: "sign_in"` or `"plan_selection"`. For a draft whose email has an account, `select-plan`, `shipping-rate-public` and `create-subscription-public` answer 409 `ACCOUNT_EXISTS`. New: `POST /access/cards/:id/claim` (signed in, with the card token) and `DELETE /access/cards/:id` (the owner). `createBusinessCard` (signed in) answers 409 `CARD_EXISTS` while the person has a card (`replace: true` swaps it) | **Must:** after `POST /businessCard`, when `next_step` is `sign_in` (or a purchase call answers `ACCOUNT_EXISTS`), send the person to sign in and then claim the draft with its card token. **Must:** handle `CARD_EXISTS` on create (offer edit, or replace). **Can:** a "Delete my card" action |
| Oct 16 | **The card form's fields and checks are now the API's** (section 9.1). Creating and editing a card (guest, signed in, owner edit) checks the same fields the form checks, and a refusal names the field: 400 `INVALID_CARD` with `details: { field }` (the form's keys: `name`, `phone`, `bio`, `booking_link`, `instagram`, `images`, …). Read now: `isPrimary` on locations (it was dropped, so no location was primary), `new_images_gallery_meta` captions and cover, video thumbnails. Limits: 4 photos and 1 video (the form allows 5 media in any mix), MP4 under 21 MB, bio up to 80 characters of text (a stored longer bio can stay until it is changed). Ignored: `custom_handle`, `elite_setup`, `excites_about_glamlink`, `biggest_pain_points`; `primary_specialty` is the first specialty. Public card responses (`getBusinessCard/:slug`, `getAllProfiles`, `getProfilesByDirectory/:id`, `getBusinessCardById/:id` without the owner's or an admin's token) leave out the owner's account and plan fields (`user_id`, `business_user`, `plan_type`, `nfc_status`, address and shipping fields, the marketing answers) and return `phone: null` when the phone is hidden; `getBusinessCardById` of a card that is not live is 404 for them | **Must:** cap the gallery at 4 photos and 1 video. **Can:** show `details.field` errors under the field. The dashboard reads `getMyBusinessCard`, which still returns everything |
| Oct 16 | Coming (Phase 2b): the Access redesign in the backend's `docs/access.md`. Section 9 lists what it will mean for the website; each part gets its own entry here when it lands | Nothing yet |
| Oct 16 | The card bio is cleaned on save: only the bio editor's formatting stays (paragraphs, bold, italic, underline, strike, h3, lists, quotes, and links over http, https, mailto or tel, which get `target="_blank" rel="noopener noreferrer nofollow"`). The directory filter's `location` is matched as a value (it was written into the SQL) | Nothing: the bio editor only produces these |
| Oct 16 | CORS: the API no longer answers `Access-Control-Allow-Origin: *`; only the origins in its `ACCESSDOMAINS` setting get CORS headers, and a browser on any other origin gets 403 `ORIGIN_NOT_ALLOWED`. The production setting must list `https://glamlink.net` (and `https://www.glamlink.net` if used) | Nothing, as long as the site runs on a listed origin. For local development, ask for `http://localhost:3000` to be listed |
| Oct 16 | `GET /journal/topic/:id` no longer returns professionals' `email` (it is still returned to an admin token). The topic page's expert cards show emails today | **Must:** stop showing the email on the topic page (`ExpertCard`) |
| Oct 16 | Errors: unexpected failures answer a generic 500 (database and library messages no longer reach the client); Stripe payment errors keep Stripe's status and message with `code: "PAYMENT_FAILED"`; the address and NFC messages gain codes (section 4), messages unchanged | **Can:** branch on `code` instead of message text |
| Oct 16 | Logged-out card purchase needs the card token (section 8). The public calls used to accept any card id, so anyone could change any card's plan or read its address. `editAddress-public` now edits only the card's own address | **Must:** keep the `card_token` from `POST /businessCard` and send it on the purchase calls; send the access token when a signed-in owner calls them |
| Oct 16 | Internal restructure (code grouped by product). No API change | Nothing |
| Oct 14–15 | Identity, sign-in and route changes in the sections below | See the checklist |

## 1. What to change, in short

1. **Sign-in**: new login response, a 15-minute access token, a refresh token in an httpOnly cookie, a
   refresh call. Send `credentials: 'include'` on the auth calls. See section 2.
2. **Registration and email verification**: no more 4-digit OTP. Registration emails a link; build the
   page `/verify-email` that the link opens. See section 3.
3. **Forgot / reset / change password**: links instead of OTP codes; build the page `/reset-password`.
   Changing the password while signed in moved to `/user/auth/change-password`.
4. **Renamed endpoints and fields**: "beautician" and "counselor" are now "professional" (section 5).
5. **Sign-in requirements**: routes now refuse guests with `401` where they need a person, and Access card
   owner routes need a professional account (section 6). Handle `401` by refreshing, then sign-in.
6. **Error codes**: error responses carry a `code` to branch on (section 4).
7. **Access card welcome email** now links to `/reset-password` to set a first password (section 7).

## 2. Sign-in model

| Piece | Lifetime | Where it lives | Sent how |
| --- | --- | --- | --- |
| Access token (JWT) | 15 minutes | Memory only (not localStorage) | `Authorization: Bearer <token>` (or the old `x-access-token` header; both work) |
| Refresh token | 30 days, extended on every refresh | httpOnly cookie `glamlink_refresh` set by `api.glamlink.net` (Path `/api/v1/user/auth`, SameSite=Lax, Secure) | Automatically, when the request uses `credentials: 'include'` |

- The website never sees the refresh token; JavaScript cannot read the cookie. The app gets it in the body instead.
- **Every auth call that sets or uses the cookie needs `credentials: 'include'`**: `login`, `verify-email`,
  `refresh`, `logout`, `logout-all`. The API already allows credentials for the origins in its
  `ACCESSDOMAINS` setting (must include `https://glamlink.net`, and `https://www.glamlink.net` if used).
- Send `client: "website"` in the JSON body of `register`, `login` and `verify-email` (or the header
  `x-client: website`). The website signs in **professional accounts only**.
- The `role_id` request header is gone: nothing reads it. Account type comes from the account.

**Refresh flow**

```js
// On app start: try to get an access token from the cookie (silent sign-in).
// Before the access token expires (access_token_expires_at), or after a 401 with code SESSION_EXPIRED:
const res = await fetch(`${API}/api/v1/user/auth/refresh`, { method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' }, body: '{}' });
// 200 -> data.access_token (+ access_token_expires_at). A new refresh cookie is set automatically.
// 409 code REFRESH_TOKEN_ROTATED -> another tab refreshed at the same moment: wait ~300 ms and retry once.
// 401 code SESSION_EXPIRED -> signed out: go to the sign-in page.
```

Retry the original request once after a successful refresh. Refresh tokens rotate: if an old one is ever
replayed, the backend treats it as stolen and ends that session (the person signs in again).

Local development: the cookie only flows between the same site. Run the website and API on the same
hostname (both `localhost`, not `localhost` and `127.0.0.1`). The cookie is not `Secure` outside production.

## 3. Auth endpoints

All bodies are JSON. Successful responses keep the usual envelope `{ success: true, status, message, data }`.

| Endpoint | Body | Success | Notes |
| --- | --- | --- | --- |
| `POST /user/auth/register` | `name`, `email`, `password`, `confirm_password`, `client: "website"`, `turnstile_token`; optional `professional_type` (`individual` default, or `brand`), `mobile`, `profession`, `about`, `address`, `state_id`, `city_id`, `user_name`, `referral_code` | `201`, `data: { email, verification_sent: true }` | Emails a verification link. Registering an email that exists but was never verified just sends a new link (same answer). A verified email: `409 EMAIL_TAKEN`. Password: 8–100 characters, at least 2 digits, no spaces. The Turnstile captcha is required in production. |
| `POST /user/auth/verify-email` | `token`, `client: "website"` | `200`, sign-in response (below) | The person is signed in. A used or expired link: `400 INVALID_LINK`. |
| `POST /user/auth/resend-verification` | `email` | `200` always | Never reveals whether the account exists. |
| `POST /user/auth/login` | `email`, `password`, `client: "website"` | `200`, sign-in response | Errors: `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED` (a new link is sent automatically), `403 PROFESSIONAL_REQUIRED` (a user/app account), `400 PASSWORD_NOT_SET` (account made with Google/Apple: use forgot password), `403 ACCOUNT_DISABLED`. |
| `POST /user/auth/refresh` | `{}` (cookie) | `200`, `data: { access_token, access_token_expires_at, refresh_token_expires_at }` | See section 2. |
| `POST /user/auth/logout` | `{}` + access token | `200` | Ends this session and clears the cookie. Was `GET /user/auth/logout`. |
| `POST /user/auth/logout-all` | `{}` + access token | `200` | Ends every session of the account. |
| `POST /user/auth/forgot-password` | `email` | `200` always | Emails a reset link valid 1 hour. Also how Google/Apple-only accounts set a password. |
| `POST /user/auth/reset-password` | `token`, `password`, `confirm_password` | `200` | Signs out every device; then sign in. Bad link: `400 INVALID_LINK`. Also verifies the email if it was not yet. |
| `POST /user/auth/change-password` | `old_password`, `new_password`, `confirm_password` + access token | `200` | Other devices are signed out; this one stays. Was `POST /user/auth/reset-password` (authenticated). |
| `POST /user/auth/sso` | | `501` | Google sign-in comes later. |

**Sign-in response** (`login`, `verify-email`):

```json
{
  "success": true, "status": 200, "message": "Signed in.",
  "data": {
    "user": { "id": 18, "name": "…", "email": "…", "account_type": "professional",
              "professional_type": "individual", "email_verified": true, "role_id": 7 },
    "access_token": "…", "access_token_expires_at": "2026-10-15T10:15:00.000Z",
    "refresh_token_expires_at": "2026-11-14T10:00:00.000Z"
  }
}
```

Was: `data: { id, name, email, role_id, tokens: { access: { token, expires } } }` with a 7-day token.

**Removed**: `POST /user/auth/otp`, `POST /user/auth/verify-otp`, `GET /user/auth/logout`, the OTP-based
`forgot-password` body (`email, password, confirm_password, token`).

### Pages the email links open

| Page | Opened by | What it does |
| --- | --- | --- |
| `/verify-email?token=…` | Verification email (valid 24 h) | `POST /user/auth/verify-email { token, client: "website" }` → signed in → dashboard. On `INVALID_LINK`, offer "send a new link" (`resend-verification`). |
| `/reset-password?token=…` | Forgot-password email (1 h), and the Access card welcome email for new owners (7 days) | Form with password + confirm → `POST /user/auth/reset-password` → sign-in page. Word it so it fits both "reset" and "set your password". |

The links use the backend's `WEBSITE_URL` (`https://glamlink.net` in production).

## 4. Error codes

Error responses: `{ success: false, status, message, code, data: "" }`. `code` is stable; `message` is for people.

| Code | Status | Meaning |
| --- | --- | --- |
| `SIGN_IN_REQUIRED` | 401 | The route needs a signed-in account and none was sent |
| `SESSION_EXPIRED` | 401 | Access token expired/invalid or the session ended: refresh, else sign in |
| `REFRESH_TOKEN_ROTATED` | 409 | Another tab refreshed at the same moment: retry the refresh once |
| `PROFESSIONAL_REQUIRED` | 403 | A user (app) account on a professional-only route or website sign-in |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (deliberately not saying which) |
| `EMAIL_NOT_VERIFIED` | 403 | Sign-in before verifying; a new link was emailed |
| `PASSWORD_NOT_SET` | 400 | Account created with Google/Apple; use forgot password |
| `ACCOUNT_DISABLED` | 403 | Account deactivated or rejected |
| `EMAIL_TAKEN` | 409 | Registering a verified email |
| `WEAK_PASSWORD` | 400 | Password rules not met |
| `PASSWORD_MISMATCH` | 400 | Password and confirm differ |
| `INVALID_LINK` | 400 | Email link expired or already used |
| `INVALID_INPUT` | 400 | Missing name or invalid email |
| `CAPTCHA_REQUIRED` / `CAPTCHA_FAILED` | 400 | Turnstile token missing or rejected |
| `CAPTCHA_NOT_CONFIGURED` | 503 | The API has no Turnstile secret yet: sign-up is off until it does (a server setting, not the visitor's fault) |
| `TOO_MANY_REQUESTS` | 429 | Too many guest cards from one address in an hour |
| `CARD_TOKEN_REQUIRED` | 401 | A purchase call without the card's token (section 8) |
| `ADDRESS_INVALID` | 400 | Shipping address rejected by the carrier (message: "Address validation failed: …") |
| `ADDRESS_NOT_FOUND` | 404 | No address on the card or account (message: "Address not found") |
| `ADDRESS_NOT_VERIFIED` | 400 | Shipping rate asked before the address was saved (message: "Please verify address first") |
| `NFC_ALREADY_PURCHASED` | 400 | The card already has its NFC keychain (message: "NFC card already purchased") |
| `PAYMENT_FAILED` | 4xx | Stripe refused the payment; the message is Stripe's, written for the payer ("Your card was declined.") |
| `INVALID_CARD` | 400 | A card field fails the form's rules; `details.field` names it (section 9.1) |
| `ACCOUNT_EXISTS` | 409 | A guest's draft whose email already has an account: sign in, then claim it (section 9.2) |
| `CARD_EXISTS` | 409 | The person already has a card; `details.card_id` is theirs. Send `replace: true` to swap it (section 9.2) |
| `CARD_NOT_CLAIMABLE` | 409 | Claiming a card that is no longer a draft, or is someone else's |
| `UPGRADE_REQUIRED` | 403 | The owner's plan does not include this change; `details.feature` is `edit_media`, `special_offers` or `edit_details` (section 9.6) |
| `ALREADY_OWNED` | 409 | The person already has what the plan sells (Access Pro) |
| `SHIPPING_COUNTRY_UNSUPPORTED` | 400 | The keychain does not ship to the address's country |
| `ADDRESS_CHECK_UNAVAILABLE` | 502 | Shippo did not answer; try again |
| `CHECKOUT_EXPIRED` | 409 | The quote is over 24 hours old or its payment lapsed: quote again |

Older errors elsewhere in the API still have no `code`; branch on `status` there. Messages the website matches today
("Address not found", "Please verify address first", "NFC card already purchased", "Address validation failed: …")
are unchanged; switch to the codes when convenient.

An unexpected error answers `500` with `message: "An internal server error occurred."`; the details are only in the
server log. Before, database and library messages reached the client.

## 5. Renamed endpoints and fields

| Was | Now |
| --- | --- |
| `GET /user/find-beautician` | `GET /user/find-professional` |
| `GET /user/nearby/map/beautician/list` | `GET /user/nearby/map/professional/list` |
| `/user/beautician/brand/association` (+ `/list`, `/answer`, `/remove`, `/success/list`) | `/user/professional/brand/association` (same sub-paths) |
| `GET /user/list/random-counsellors` | `GET /user/list/random-professionals` |
| `POST /user/list/nearby-counsellors` | `POST /user/list/nearby-professionals` |
| `GET /review/:counselor_id` | `GET /review/:professional_id` |
| `/counselor/schedular[...]` | `/professional/scheduler[...]` |

Response fields:

| Where | Was | Now |
| --- | --- | --- |
| `GET /user/profile` (and other profile payloads) | `user_profile.no_of_beautician_associated` | `user_profile.no_of_professionals_associated` |
| `GET /user/profile` | `reviews[].counselor_id` | `reviews[].professional_id` |
| `GET /user/profile` | | adds `account_type`, `professional_type`, `email_verified_at`, `downgraded_at` |
| `GET /user/profile` | `user_role: { name: "Estheticians", abbreviation: "ESTI" }` | `user_role: { name: "Professional", abbreviation: "PRO" }` |
| Bookings / appointments / reviews (app) | `counselor_id`, `is_counselor_joined`, `is_counselor_canceled` | `professional_id`, `is_professional_joined`, `is_professional_canceled` |
| Bookings / appointments (app) | `call_type` and video-call fields | removed |
| Any user object | emails as typed | emails stored lowercase |

Request fields follow the same renames (`counselor_id` → `professional_id`).

Also removed since the version in production: the counselling features (`/price`, `/keywords`, `/user/fees/change`,
`/user/trial`, `/user/list/counsellors`), `/order/createOrder`, `/payment/crm/*`, the CRM routes
(`/customer`, `/staff`, `/vendor`), `/logs`, `/test`. The website should not call any of these.

## 6. Sign-in requirements

- **public**: no token needed. **optionalAuth**: works without a token, shows more with one.
- **authenticate**: any signed-in account; guests get `401 SIGN_IN_REQUIRED`.
- **requireProfessional**: a professional account; user accounts get `403 PROFESSIONAL_REQUIRED`.
- **ownerOrAdmin**: the signed-in owner of the record (or an admin). **(or unowned)**: also open while the
  record has no owner yet, which is the logged-out Access card purchase flow.

Before, most of these let guests through and then failed with `500`. Website and shared endpoints now:

| Method | Path | Needs |
| --- | --- | --- |
| POST | `/businessCard` | public (logged-out purchase) |
| POST | `/businessCard/select-plan` | public |
| POST | `/businessCard/shipping-rate-public` | public |
| POST | `/businessCard/create-subscription-public` | public |
| POST | `/businessCard/createBusinessCard` | requireProfessional |
| GET | `/businessCard/getMyBusinessCard` | requireProfessional |
| POST | `/businessCard/select-address` | requireProfessional |
| POST | `/businessCard/shipping-rate` | requireProfessional |
| GET | `/businessCard/payment-history` | requireProfessional |
| POST | `/businessCard/create-subscription` | requireProfessional |
| POST | `/businessCard/cancel-subscription` | requireProfessional |
| PUT | `/businessCard/updateBusinessCard/:id` | ownerOrAdmin (or unowned) |
| PUT | `/businessCard/:id/featured-links/reorder` | ownerOrAdmin (or unowned) |
| GET | `/businessCard/getBusinessCardById/:id`, `/getBusinessCard/:slug`, `/search`, `/getAllProfiles`, `/filter`, `/getAllCategories`, `/findCategoryById/:id`, `/getAllDirectories`, `/getProfilesByDirectory/:id` | public |
| POST | `/access-card/analytics/event` | public |
| GET | `/access-card/analytics/:businessCardId`, `/access-card/analytics/:businessCardId/events` | ownerOrAdmin |
| GET | journal, journal categories, authors, blog, blog categories, podcast schedule, discover, ads, FAQ | public |
| POST | `/guest-application/create`, `/partnership-inquiry`, `/contactUs` | public |
| GET | `/form/getAllQuestions` | public |
| POST | `/form/submitForm` | authenticate |
| GET | `/user/profile` | authenticate |
| GET | `/user/profile/:userId` | optionalAuth |
| POST | `/user/profile`, `PUT /user/username`, `POST /user/addLinkTreeLink`, `POST /user/notifications`, `DELETE /user/deactivate` | authenticate |
| GET | `/user/list`, `/user/list/random-professionals`, `/user/list/timezones`; POST `/user/list/nearby-professionals`, `/user/search` | optionalAuth |
| GET | `/payment/stripe/stripe-key` | optionalAuth |
| POST | `/payment/stripe/create-payment-intent` | authenticate |
| GET | `/country`, `/state`, `/city`, `/language`, `/category`, `/profession` (and `/:id`) | public |

Every other user route (social, bookings, marketplace: app features) needs `authenticate`; admin routes
need an admin token and refuse user tokens.

## 7. Access card purchase: what changed

- The purchase endpoints and their payloads are unchanged, apart from the card token (section 8).
- A buyer without an account now gets a professional account **without a password**. The welcome email has
  a "Set Your Password" button to `/reset-password?token=…` (valid 7 days) instead of a generated password.
  Setting it also verifies the email. Until then, sign-in answers `PASSWORD_NOT_SET`.
- If the card's email already belongs to an account, that account is used (an app "user" account becomes a
  professional one). Before, the payment webhook could fail in this case.
- Cards bought while logged out are attached to the account once its email is verified (or the password is
  set from the welcome link).

## 8. The card token (logged-out purchase)

Added Oct 16. Before, the purchase calls took a bare `business_card_id`, so anyone could change any card's plan,
read its shipping address, or edit a card nobody owned yet. Now a request must prove it may act on the card.

`POST /businessCard` (create a card while logged out) adds `card_token` to its `data`:

```json
{ "success": true, "status": 201, "data": { "business_card_id": 412, "card_token": "eyJhbGciOi…", "…": "…" } }
```

Keep it for the rest of the purchase (for example in `sessionStorage` next to the card id, or pass it to
`/pricing` with the card id). It is valid for 24 hours and works only for that card. Send it on these calls as the
header `x-card-token` (or as `card_token` in the JSON body; in the query string for the GET):

| Method | Path | Who may call it |
| --- | --- | --- |
| POST | `/businessCard/select-plan` | card token, the signed-in owner, or an admin |
| POST | `/businessCard/shipping-rate-public` | same |
| POST | `/businessCard/create-subscription-public` | same |
| POST | `/order/addNewAddress-public` | same |
| PUT | `/order/editAddress-public/:id` | same; and `:id` must be the card's own address (else 403) |
| GET | `/order/getAddressByBusinessCardId/:business_card_id` | same |
| PUT | `/businessCard/updateBusinessCard/:id`, `/businessCard/:id/featured-links/reorder` | while the card has no owner: card token or an admin; once owned: the owner or an admin, as before |

A signed-in professional acting on their own card (the dashboard's plan change, `SubscriptionPlansTab`) sends their
access token as usual; today the website calls `select-plan` there without any token, which is now refused.

Refused requests answer `401` with `code: "CARD_TOKEN_REQUIRED"` (no or wrong token), `401 SIGN_IN_REQUIRED`
(editing an owned card without signing in), or `403` (signed in, but not the owner). The token expires after
24 hours; a buyer who comes back later signs in instead (their account exists once the card is paid for).

## 9. Coming: Access cards, plans and payments (Phase 2b)

Designed Oct 16 in the backend's `docs/access.md`; built step by step, each step logged in the changelog above
with exactly what to change. What the website should expect:

- **Plans and prices from the API** (`GET /access/plans`): names, taglines, features, badge, current prices,
  a running sale, and a client's personal price. The hard-coded `PLANS`, `$4.99` and `$39.99` go.
- **Draft cards:** a guest's card stays hidden until a plan is chosen or paid.
- **An email that already has an account:** the guest is asked to sign in (`ACCOUNT_EXISTS`), then the draft is
  claimed with its card token. Today such a card is silently attached to that account.
- **One card per person:** creating a second answers `CARD_EXISTS`; owners can delete their card and make a new
  one on the same subscription and public link.
- **Checkout:** a quote with the line items, discount and the shipping choices; a corrected address to accept;
  cancel at the end of the month (with resume) instead of immediately. The current purchase calls and
  `confirmCardPayment` keep working; the Payment Element can add Apple Pay, Google Pay and Link.
- **Card form:** exactly the fields in `docs/access.md` section 1, checked by the API as the form checks them
  (`isPrimary` and the gallery captions are now read; up to 4 photos and 1 video).
- **What Free and Pro can change** (pricing page features): Free owners can keep their details current; photos,
  video and special offers need Pro (`UPGRADE_REQUIRED`). Today the website locks all editing for Free cards.
- **Special offers:** the form gains the offer fields for Pro cards.

### 9.1 The card's fields (done Oct 16)

Creating (`POST /businessCard`, `POST /businessCard/createBusinessCard`) and editing (`PUT /businessCard/updateBusinessCard/:id`)
accept exactly these fields, as the form sends them (multipart; lists and objects as JSON strings). An edit changes
only the fields it sends.

| Field | Rule (refusal: 400 `INVALID_CARD`, `details.field` in brackets) |
| --- | --- |
| `name`, `professional_title`, `business_name` | Required, at most 100 / 100 / 150 characters |
| `email` | Required, valid |
| `phone`, `is_phone_visible` | Digits (other characters are removed); exactly 10 while visible (default visible) |
| `bio` | Required; cleaned to the editor's formatting; at most 80 characters of text |
| `color_code` | `#RRGGBB` |
| `specialties` | 1 to 5, at most 60 characters each; the first is the card's `primary_specialty` |
| `locations` | At least 1, at most 10: `location_type` `exact_address` (with `address`) or `city_only` (with `city` and `state`), `label`, `latitude`, `longitude`, `isPrimary` (or `is_primary`; one primary, the first if none) |
| `business_hour` | `[{ note }]`, at most 14 lines |
| `preferred_booking_method` | 1 or more of `GO_TO_BOOKING_LINK` (any case, so `GO_tO_BOOKING_LINK` works), `CALL_TEXT`, `DM_INSTAGRAM`; the first needs `booking_link` or `website` [`booking_link`], the last `social_media.instagram` [`instagram`] |
| `website`, `booking_link` | Web links; `example.com` is saved as `https://example.com` |
| `social_media` | `instagram`, `instagram1`, `instagram2`, `tiktok`, `linkedin`, `youtube`, `facebook` |
| `other_links`, `featured_links` | At most 10 each; one featured link at most |
| `important_info` | At most 10 lines of 200 characters |
| `profile_image` | Required on create [`profile_image`] |
| `images`, `videos` + `video_thumbnails` | At least one item on create; up to 4 photos and 1 MP4 video (21 MB), a thumbnail per video [`images`]. Edit: `existing_image_ids` / `existing_video_ids` list what stays; a card that already has more keeps them but cannot add |
| `new_images_gallery_meta`, `existing_images_gallery_meta` | Caption and cover (`is_thumbnail`) per new / kept photo, in order |
| `offer_promotion`, `promotion_details` | Special offer (Pro only, once plans are enforced) |

### 9.2 Drafts and one card per person (done Oct 16)

- **A guest's card is a draft** until a plan is chosen (Free) or paid. Drafts are not public (`getBusinessCard/:slug`
  404), not in the directory or listings. The card token still works for the purchase calls.
- `POST /businessCard` (guest) answers:

  ```json
  { "business_card_id": 412, "card_token": "eyJ…", "status": "draft", "account_exists": false,
    "next_step": "plan_selection", "plan_type": "free", "business_card_link": "…", "business_card_qr": "…" }
  ```

  It never attaches the card to an existing account any more (before, anyone could create a card on someone else's
  account by typing their email).
- **Both card forms make drafts.** `/access` and `/directory-form-apply` post to the same `POST /businessCard`; the old
  API made the directory form's card public at once, the new one keeps it a draft like any guest card. After the
  directory form, follow `next_step` as `/access` does (choose Free, or sign in and claim), or the card never goes live.
- **The email already has an account** (`account_exists: true`, `next_step: "sign_in"`): the plan and payment calls
  answer 409 `ACCOUNT_EXISTS`. Send the person to sign in, then:

  `POST /access/cards/:id/claim` with their access token and the draft's card token (`x-card-token`). Body
  `{ "replace": true }` only after they chose to replace the card they already have. Answers
  `{ business_card_id, status: "accepted", plan_type, nfc_status, business_card_link, business_card_qr }`; then continue
  the purchase signed in (the plan step). Errors: 401 `CARD_TOKEN_REQUIRED`, 409 `CARD_EXISTS` (with
  `details.card_id`), 409 `CARD_NOT_CLAIMABLE`.
- **One card per person.** `POST /businessCard/createBusinessCard` (signed in) answers 409 `CARD_EXISTS` while they
  have a card; with `replace=true` in the form, the old card is deleted (kept in the database) and the new one takes
  its public link and QR code.
- **Delete:** `DELETE /access/cards/:id` (the owner) answers `{ deleted: true, subscription_continues }`. The
  subscription goes on; the person's next card takes over the deleted card's link and QR code (printed codes and the
  keychain keep working), their keychain and their plan.
- Choosing Free for a card whose owner subscribes changes nothing (the subscription is the person's).

### 9.3 Plans and prices (done Oct 16)

`GET /access/plans` (no sign-in needed). Send the access token when signed in; a guest sends
`?business_card_id=<draft id>` with `x-card-token`, so a personal price set for their email shows. Amounts are in
cents (USD).

```json
{
  "currency": "usd",
  "sale": { "name": "Launch", "percent_off": 20, "amount_off_cents": null, "applies_to": ["pro"],
            "duration": "repeating", "duration_in_months": 3, "starts_at": "…", "ends_at": "…" },
  "owned": { "subscription": false, "keychain": false },
  "plans": [
    { "code": "nfc_with_subscription", "name": "Pro + keychain", "label": "Pro", "badge": "Most popular",
      "tagline": "Full Pro plan with the NFC keychain included.",
      "features": [{ "text": "Swap your featured video anytime" }, { "text": "Performance analytics", "soon": true },
                   { "text": "NFC keychain — tap to share your profile", "highlight": "keychain" }],
      "includes": { "subscription": true, "keychain": true },
      "lines": [
        { "product": "pro", "name": "Access Pro", "kind": "subscription", "interval": "month",
          "list": 499, "amount": 399, "recurring": 499, "personal": false, "discount": { "name": "Launch", "…": "…" } },
        { "product": "keychain", "name": "NFC keychain", "kind": "one_time", "interval": null,
          "list": 3999, "amount": 3999, "recurring": null, "personal": false, "discount": null }
      ],
      "due_today": 4398, "monthly": 499 }
  ]
}
```

- `code` is the `plan_type` the purchase calls take. Plans are in display order; an admin can rename them, change
  their features and badge, or switch one off.
- `lines[].amount` is what the first payment charges for that product, `recurring` what later monthly payments
  charge (after a sale's months run out); `list` is the price before any discount, for showing it struck through.
  `personal: true` marks the client's own price.
- `due_today` is before shipping (the keychain's shipping is quoted at checkout). `monthly` is the subscription's
  later monthly amount.
- `owned` (signed in): what the person already has; buying Pro again or a second keychain is refused, so grey those
  out (as `SubscriptionPlansTab` does for the keychain today).

### 9.4 Checkout and payment (done Oct 16)

Who may call: the card's owner (access token), or the guest with the draft's card token (`x-card-token`), as for
the purchase calls in section 8. Amounts in cents.

1. `POST /access/checkout/quote` `{ business_card_id, plan_type, rate_id? }`: what the plan costs this person now.
   Products they already have are left out (a Pro member choosing Pro + keychain pays for the keychain only).
   With the keychain, the card's checked address is needed first (`order/addNewAddress-public` or
   `businessCard/select-address`), and the answer lists the shipping options; send `rate_id` to pick one (the
   cheapest otherwise). Answers:

   ```json
   { "checkout_id": 77, "status": "open", "plan_type": "nfc_with_subscription",
     "lines": [{ "product": "pro", "amount": 499, "recurring": 499, "list": 499, "personal": false, "…": "…" },
               { "product": "keychain", "amount": 3999, "…": "…" }],
     "shipping": { "address": { "name": "…", "street1": "…", "city": "…", "state": "NV", "zip": "…", "country": "US" },
                   "options": [{ "rate_id": "…", "amount_cents": 500, "provider": "USPS", "service": "Ground Advantage", "estimated_days": 3 }],
                   "selected": { "rate_id": "…", "amount_cents": 500, "…": "…" } },
     "subtotal_cents": 4498, "shipping_cents": 500, "total_cents": 4998, "monthly_cents": 499, "expires_at": "…" }
   ```

   Quoting again (another plan or shipping option) updates the same open checkout. A quote holds for 24 hours.
2. `POST /access/checkout/:id/pay` → `{ checkout_id, client_secret, publishable_key, amount_cents, … }`. Confirm with
   Stripe.js: `stripe.confirmPayment({ elements, clientSecret })` with the Payment Element, or the current
   `confirmCardPayment(clientSecret, { payment_method: { card } })`. Paying again returns the same secret.
3. Stripe tells the API (webhook); the card goes live, the seat starts, the keychain order is made, the emails go
   out. `GET /access/checkout/:id` shows `status: "paid"` (poll for a few seconds after Stripe.js confirms).

The old calls answer as before on top of this: `shipping-rate[-public]` quotes (`checkout_id` added),
`create-subscription[-public]` pays the card's newest quote for that plan (`clientSecret`, `paymentIntentId`,
`customerId`, `subscriptionId`, `amount`, `publishableKey`, `checkout_id`).

**The subscription:** `GET /access/subscription` → `{ status, pro, source, amount_cents, current_period_end,
cancel_at_period_end, … }` (null without one). `POST /access/subscription/cancel` ends it at the end of the paid
month (`pro` stays true until then); `POST /access/subscription/resume` takes that back.
`POST /businessCard/cancel-subscription` now does the same as cancel (it used to end Pro at once).

### 9.5 Delivery addresses (done Oct 16)

The address calls take `address_line_1`, `address_line_2` (apartment, suite), `state_id`, `city_id`, `postal_code`,
and optionally `recipient_name` and `phone`. Shippo checks the address before it is saved, and the saved address is
Shippo's corrected one (standard abbreviations, ZIP+4). The answer:

```json
{ "address_id": 812, "address": { "id": 812, "address_line_1": "1 MAIN ST", "address_line_2": "STE 5", "postal_code": "89101-1234", "…": "…" },
  "corrected": true, "original_address": { "street1": "1 Main St", "street2": "Suite 5", "zip": "89101", "…": "…" } }
```

(`order/addNewAddress` and `editAddress` answer the address itself, with `corrected` and `original_address` in it.)
An address Shippo cannot deliver to: 400 `ADDRESS_INVALID`, "Address validation failed: <Shippo's reasons>".
Shippo not answering: 502 `ADDRESS_CHECK_UNAVAILABLE` (try again). A checkout for a country the keychain does not
ship to: 400 `SHIPPING_COUNTRY_UNSUPPORTED` (US only until an admin adds Canada).

### 9.6 What each plan may change (done Oct 16)

From the pricing page; admins can change these per plan (settings `entitlements`).

| Once the card is live | Free | Pro |
| --- | --- | --- |
| Details: name, title, bio, contact, specialties, booking, links, hours, locations | yes | yes |
| Photos, video, profile image (add, remove, replace, captions, cover) | no: `edit_media` | yes |
| Special offer (`offer_promotion`, `promotion_details`) | no: `special_offers` | yes |
| Photos / videos on the card | 4 / 1 | 4 / 1 |

Refused edits answer 403 `UPGRADE_REQUIRED` with `details.feature`. Sending the whole form back with the photos
unchanged (as the edit page does) is fine; only real changes count. A draft, a card waiting for review and a
rejected card can always be edited, and an admin can change anything. A public card shows its offer only while
its owner is Pro (the offer is kept, and shows again if they subscribe again).
