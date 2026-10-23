# Website frontend: backend API changes for the cutover

For: the Claude working on the Glamlink website (glamlink.net) frontend.
Backend: `api.glamlink.net`, all routes under `/api/v1`. Backend branch: `master` (the code that deploys; it holds every earlier phase).

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
- [ ] Ad tracking posts to the relative `/api/ads/track` (the website itself, always 404): post it to the API's
      `POST /ads/track` (section 10.12), and read ads with `GET /ads?live=true&page=<page>`.
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
- [ ] `/directory-form-apply` (`directoryForm.tsx`) posts to `POST /directory/applications` (section 10.5), not
      `POST /businessCard`: the same fields, with the photos as `profile_image` and `images` (it sends `profilePhoto`
      and `gallery_images`, which the API refuses with 400 "Unexpected field"). It no longer makes a card.

## Changelog

Newest first. Each entry says what changed in the API and what the website must (or can) do.

| Date | Change | Website |
| --- | --- | --- |
| Oct 24 | **YouTube import on request** (section 10.9): new episodes come in when an admin presses the import button, not hourly | Nothing to change: the import tells the website through the cache-refresh hook |
| Oct 23 | **Cache-refresh hook** (section 10.18): after each change made through the API, the website is told which data changed: `POST` to its route, `{ tags }`, with a shared secret | **New:** the receiving route; tag cached fetches with the data they show; send us the route's address and the secret |
| Oct 23 | **Page analytics** (section 10.17): `POST /profiles/:slug/events` counts page views and clicks (website, Access card, products, booking, social, email, phone); `GET /my/profile/analytics` gives the owner the numbers in the card analytics' shape | **Should:** report views and clicks on the page as on the card; a numbers screen in the dashboard |
| Oct 23 | **Sitemap feed** (section 10.16): `GET /sitemap`, every public page's id, slug and date of last change by kind (articles, topics, profiles, products, videos, issues) | **Should:** build sitemap.xml from it instead of downloading full lists |
| Oct 23 | **Calls by slug** (section 10.15): `GET /journal/slug/:slug` and `GET /discover/shop/slug/:slug`; `GET /journal/topic/:id` takes a slug too; products carry `slug`; every article and product has its own. The calls by id still answer | **Can:** move article, topic and product links to slugs; old links by id keep working |
| Oct 23 | **Listings become accounts** (section 10.14): approving a directory application makes the person a professional account (set-password email) and a page made from the listing; they keep the listing up to date (`GET`/`PUT /my/directory`) and manage their products (`/my/products`, shown at once) from the Access dashboard. Pages add `listing` (locations, hours, photos) | **Should:** in the dashboard, a "Directory listing" and a "Products" section; the approval email points to sign-in |
| Oct 23 | **The directory** (section 10.13): `GET /directory/search` (our profiles and approved applications, by distance and filters), `GET /directory/listings/:id`, Google's listings near the visitor (`GET /directory/google`), and the claim flow (`/directory/google/search`, `/directory/google/places/:placeId`, then the application with `place_id`) | **Should:** replace the mock provider with these; "Claim this profile" and "Find my business on Google" prefill the apply form |
| Oct 23 | **Ads** (section 10.12): `GET /ads?live=true` (with `slot` and `page`) answers only the ads to show now; `POST /ads/track` counts views and clicks | **Must:** send the ad slots' tracking to `${API}/ads/track`. **Should:** fetch `GET /ads?live=true&page=<page>` instead of every ad |
| Oct 23 | **Site-wide search** (section 10.11): `GET /search?q=` answers topics, professionals, brands, products, articles and videos (first rows and counts, exact matches first); `&type=<group>` pages one group | **Should:** point the hero search and its results page at it (instead of the journal search) |
| Oct 23 | **The magazine** (section 10.10): the 14 issues from `src/data/issues.ts` are served by `GET /magazine` and `GET /magazine/:slug` (with who appears in each); profile pages list their issues | **Should:** read the magazine pages from these instead of `issues.ts`; keep `public/magazine` until the covers are copied to the API |
| Oct 23 | **Watch** (section 10.9): `GET /video-series`, `GET /videos` (series, featured, search, paging), `GET /videos/:slug` (embed link, people, topics, related); profile pages and topics list their videos. The API imports each series' YouTube playlist hourly with its own key | **Should:** build Watch + Learn, the Watch page and the podcast page from these, then drop the browser's YouTube key |
| Oct 23 | **Smaller images** (section 10.8): `/images/<file>?w=<width>` answers a WebP at most that wide (200, 400, 800, 1,200 or 1,600), for every uploaded image. `findById` of a product answers the product's public fields to anyone but an admin (as before, apart from bookkeeping columns such as `status` and `deleted_at`) | **Should:** ask for `?w=400` in grids and home tiles (a `next/image` loader in section 10.8) |
| Oct 23 | **Mentions** (section 10.7): `findJournalById` answers `mentions` (`[{ handle, slug, name, type }]`, the people the article features who have a page); a page's `journal` lists the articles that feature it, and `GET /profiles/:slug/articles` pages them. Product and mention links carry the page's `type` | **Should:** link @handles from `mentions` (and turn off the test mode that links every handle to one card); show the articles on profile pages |
| Oct 23 | **Products have an owner and a brand** (sections 10.3, 10.6): product answers add `owner` and `brand_profile` (`{ id, slug, name }` of their pages, null without one) and `owner_id`, `brand_id`; `brand` stays the text. `GET /discover/shop?brand=` also takes a brand page's slug, and `?owner=<slug>` filters by owner. A page lists its first 4 products; `GET /profiles/:slug/products` pages them | **Can:** link a product's brand and owner to their pages; show the products on profile pages |
| Oct 23 | **Professional and brand pages** (section 10.6): `GET /profiles` (type, featured, search, paging), `GET /profiles/:slug` (the page with its card's details, links and topics; products and articles come next), and the owner's `GET`/`PUT /my/profile` | **Can:** build Find a Brand, the Inside the Industry row (`?type=brand&featured=true`), the profile pages, and page editing in the dashboard |
| Oct 23 | A card is found by its handle (`getBusinessCard/:slug`), whatever host its stored link names, so existing cards open on test.glamlink.net while the API's `WEBSITE_URL` points there; a card made there gets a test.glamlink.net link (the test data is thrown away at the switch) | Nothing |
| Oct 23 | **Directory applications** (section 10.5): the directory form stays (Mohit) and gets its own `POST /directory/applications`, which keeps the form's fields as sent (long bios, walk-ins, service-area and virtual locations) for admins to review, instead of the card endpoint that refused every submission | **Must:** post `/directory-form-apply` to `POST /directory/applications`, with the photos as `profile_image` and `images`; send `place_id` from `?claim=` when there is one |
| Oct 23 | **Newsletter and feature requests** (section 10.4): `POST /newsletter/subscribe` (`email`, `first_name`, `last_name`, `source`) and `POST /feature-request` (`name`, `specialty`, `email`, `phone`, `city`, `interest`) store what the forms send; refusals are 400 `INVALID_INPUT` with `details.field`. The guest application now keeps `businessName` and `instagram`, which the API dropped (it read `business_name` and `instagram_handle`; both spellings work) | **Should:** wire the newsletter popup (`source: "popup"`), the footer (`"footer"`), the podcast's Notify me (`"podcast"`) and Apply for Feature to these, and show success only on a 2xx |
| Oct 23 | **The shop pages on the server** (section 10.3): `GET /discover/shop` with `page`, `limit`, `category`, `brand`, `search` or `featured=true` answers one page of products; without them, as before. New `GET /discover/shop/filters` (categories and brands with counts). Products have `is_featured`, `featured_order` and a longer `description`. `findById` answers 404 `NOT_FOUND` for a missing, removed or unpublished product (it answered 200 "No Record Found") | **Should:** the Shop page, its filters and the home row from these; the product page from `findById` (one product instead of the whole list, twice); treat 404 as not found |
| Oct 23 | **Home tiles and settings** (section 10.2): `GET /journal/topic?featured=true` lists the home page's topic tiles in their order (topics add `is_featured`, `featured_order`, `tile_image`); `GET /settings/home` answers the hero image, the popular searches and the "Find a Professional" image, set in admin | **Should:** build Explore Beauty + Wellness, the hero's image and chips, and the Find a Professional image from these (placeholders while an image is `null`) |
| Oct 23 | **The journal list pages on the server** (section 10.1): `GET /journal` with `page`, `limit`, `category` (a slug), `search`, `exclude` or `featured=true` answers one page of light article cards, newest first, with the true `count`; without them it answers as before (its `count` now counts articles). Articles have `is_featured`, set in admin. `GET /journalCategory` adds `article_count` and `sort_order`; titles are trimmed and slugs made for URLs (`whats-new`). Drafts are no longer served by `findJournalById` or `journal/:category_id` (except to admins) | **Should:** move the Journal page, its hero, related articles and the home row to these calls (one request each instead of four full lists); use `journal_category.slug` in category URLs; hide categories whose `article_count` is 0 |
| Oct 23 | The server steps for testing on test.glamlink.net are written (the backend's `docs/deploy.md`, section 7, "The website on test.glamlink.net"): the origin in `ACCESSDOMAINS`, `WEBSITE_URL` on the test site, Stripe and Shippo test keys, visitors' addresses from Cloudflare, and `www` redirected to `glamlink.net`. Responses no longer carry `X-Powered-By` | **Once Mohit has applied them:** test sign-up (the email link opens on test.glamlink.net), a payment and a keychain address there |
| Oct 23 | `GET /user/profile/:userId` answers guests and other accounts with the public profile only: name, about, profession, ratings and counts, photo, albums, reels, posts, services, and reviews with each reviewer's name and photo. The email, phone, address, coordinates, Stripe, push and socket ids, referral code and settings (of the account and of its reviewers) go only to the owner and to admins. It no longer looks up the address with Google unless `latitude` and `longitude` are sent | Nothing: the website does not call it |
| Oct 16 | A professional account made without a `profession` has none (`null`); it used to get "Esthetician". The website does not read it today | Nothing |
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
| GET | `/user/profile/:userId` | optionalAuth (the public profile; the whole account for its owner or an admin) |
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
- **The directory form is not a card form** (since Oct 23): `/directory-form-apply` posts to
  `POST /directory/applications` (section 10.5), which keeps the application for admins to review. Only `/access`
  makes cards.
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

## 10. The website's requests (Phase 6)

The backend's answers to "Glamlink Backend Requests — Home Page and Pending Work" (Oct 22), with the final shapes.
Each part is logged in the changelog when it lands. Every new list answers `{ count, rows }` (`count`: all matching
rows) for `page` (from 1) and `limit` (default 12, at most 50). Without any list parameter, the existing calls
answer exactly as before.

### 10.1 Journal (done Oct 23)

`GET /journal` with any of these parameters answers one page of article cards, newest first (by `publish_date`, or
`created_at` when an article has none). Only published articles.

| Parameter | Meaning |
| --- | --- |
| `page`, `limit` | The page (from 1) and its size (default 12, at most 50) |
| `category` | A category's `slug` (`pro-spotlight`) or id. An unknown one answers no rows |
| `search` | Matches the title, short description, category title and author name (any case; `%` and `_` are plain characters) |
| `exclude` | Ids to leave out: `12` or `12,15` |
| `featured` | `true`: only featured articles (set in admin) |

```json
{ "success": true, "status": 200, "message": "", "data": { "count": 66, "rows": [
  { "id": 94, "slug": "the-new-cover-story", "title": "…", "short_description": "…",
    "cover_image": "https://api.glamlink.net/images/…", "publish_date": "2026-10-05T00:00:00.000Z",
    "is_featured": true, "created_at": "…", "updated_at": "…",
    "journal_category": { "id": 4, "title": "Cover Feature", "slug": "cover-feature" },
    "journal_author": { "id": 1, "name": "…", "profile_image": "…" } } ] } }
```

No `content`, `shops` or `downloads`: the article page still reads them from `GET /journal/findJournalById/:id`.
Dates are ISO strings.

| For | Call |
| --- | --- |
| The Journal page (6 a page) | `GET /journal?page=1&limit=6&category=<slug>&search=<text>&exclude=<the hero's id>` |
| The Journal hero | `GET /journal?featured=true&limit=1` (the newest featured article; on the live copy, the newest Cover Feature article starts as featured) |
| Latest from Glamlink (home) | `GET /journal?limit=3` |
| Related articles | `GET /journal?category=<slug>&limit=3&exclude=<this article's id>` |
| The sitemap | `GET /journal?limit=50&page=<n>` until a page comes back short (a lighter feed comes with the "Later" items) |

**Categories** (`GET /journalCategory`): each row adds `article_count` (its published articles; hide categories with
0) and `sort_order`; rows come in the admins' order, then by title. Titles have no trailing spaces any more, and
`slug` is made from the title as a URL needs it (`whats-new`, `nails-makeup`: the same as the website's
`slugify(title, { strict: true })`), so `slug` can be the `?category=` value.

**Drafts:** `GET /journal/findJournalById/:id` of an unpublished article answers like a missing one (`"No Journal
Found"`) unless an admin asks; `GET /journal/:category_id` lists published articles only. The full list's `count` now
counts articles (it counted 79 for 66).

### 10.2 Home page: topic tiles and settings (done Oct 23)

**Explore Beauty + Wellness:** `GET /journal/topic?featured=true` answers the topics admins marked for the home page,
in their order (a plain list, like `GET /journal/topic`). Topics add `is_featured`, `featured_order` and `tile_image`
(a square image; `null` means use `cover_image`). A tile opens `/topics/<slug>`. On the live copy the six topics of
the mockup (Skin, Aesthetic Treatments, Plastic Surgery, Hair, Wellness, Nails + Makeup) start as the tiles where a
topic of that name exists; admins create the missing ones.

**The parts admins set by hand:** `GET /settings/home` (no sign-in):

```json
{ "hero_image": "https://api.glamlink.net/images/…", "find_professional_image": null,
  "popular_searches": ["Botox", "Skin Rejuvenation", "Weight Loss", "Facials", "Plastic Surgery"],
  "updated_at": "2026-10-23T10:00:00.000Z" }
```

An image is `null` until an admin sets it: keep the placeholder until then. The popular searches start as the
mockup's five; until the site-wide search exists, a chip can keep opening `/journal?search=<term>`.

### 10.3 Shop (done Oct 23)

`GET /discover/shop` with any of these parameters answers one page of published products, in the order admins
arranged them (then by title):

| Parameter | Meaning |
| --- | --- |
| `page`, `limit` | The page and its size (default 12, at most 50) |
| `category`, `brand` | A `slug` from `GET /discover/shop/filters` (a name works too; "SkinMedica" and "skinmedica " count as one) |
| `search` | Matches the title, short description, brand and category |
| `featured` | `true`: only featured products, in their featured order (the home page's Shop Products row) |

Each row: `id`, `title`, `short_description`, `category`, `brand` (still the text, as today), `price`, `cover_image`,
`link`, `is_featured`, `featured_order`, `sort_order`, `created_at`, `updated_at`; no `description`. Since Oct 23 (with
the pages, section 10.6) also `owner` and `brand_profile`: `{ id, slug, name }` of the page of the account that put
the product up and of the brand that makes it (null without one, or while that page is hidden), and `owner_id`,
`brand_id`. Every product answer carries them (the full list, the pages, `findById`). `brand=` also takes a brand
page's slug, and `owner=<a page's slug>` lists that account's products.

`GET /discover/shop/filters`, the values for the shop's filters (published products only, by name):

```json
{ "categories": [{ "slug": "serums", "name": "Serums", "count": 12 }],
  "brands": [{ "slug": "skinmedica", "name": "SkinMedica", "count": 3 }] }
```

`GET /discover/shop/findById/:id`: one published product with its topics and a new `description` (show
`short_description` when it is null). A missing, removed or unpublished product answers 404 `NOT_FOUND` (it answered
200 `"No Record Found"`). The product's owner and its brand's page come with the profile pages (Phase 2).

| For | Call |
| --- | --- |
| The Shop page | `GET /discover/shop?page=1&limit=12&category=<slug>&brand=<slug>&search=<text>` and the filters |
| Shop Products (home) | `GET /discover/shop?featured=true&limit=5` |
| A product page | `GET /discover/shop/findById/<id>` instead of the whole list |

### 10.4 Newsletter and feature requests (done Oct 23)

**`POST /newsletter/subscribe`** (no sign-in): `{ email, first_name?, last_name?, source? }` answers 200
`{ subscribed: true }`, "Thanks for subscribing.", whether or not the email was already on the list (the form never
tells). `source` is the form it came from, in lower-case letters, digits and dashes: `popup`, `footer`, `podcast` (the
podcast's "Notify me"), or a new one. Signing up again keeps the first source and fills in a name the first sign-up
lacked. Mailchimp is not involved yet.

**`POST /feature-request`** (no sign-in, "Apply for Feature"): `{ name, specialty, email, phone, city, interest }`, all
required as on the form (each at most 100 characters; a phone has at least 7 digits). Answers 201 `{ id }`, "Thank
you! We received your request."; support@glamlink.net is emailed.

Both refuse with 400 `INVALID_INPUT` and `details.field` naming the field. One address may send 20 submissions an hour
across these forms, then 429 `TOO_MANY_REQUESTS`.

### 10.5 Directory applications (done Oct 23)

Mohit (Oct 23): the directory form stays, as the way people without an account or an Access card get onto the
directory; its format may change later. So it no longer posts to the card endpoint (whose rules refused every
submission): **`POST /directory/applications`** (no sign-in, multipart) keeps the form's fields as sent, for admins
to review.

| Field | Rule |
| --- | --- |
| `name`, `email` | Required (name up to 100 characters; a valid email) |
| `professional_title`, `phone`, `bio` (up to 2,000 characters), `custom_handle`, `website`, `booking_link`, `preferred_booking_method` (any text, `Walk-ins welcome` included), `primary_specialty`, `promotion_details` | Optional text |
| `specialties`, `locations` (up to 10; any `location_type`, `service_area` and `virtual` included), `business_hours`, `excites_about_glamlink`, `biggest_pain_points` | Lists as JSON strings, as the form sends them |
| `social_media` | An object as a JSON string |
| `profile_image` (1 file), `images` (up to 10), `gallery_meta` | The photos (not `profilePhoto` and `gallery_images`), and a caption, cover and order per photo |
| `offer_promotion`, `elite_setup`, `createAccessCard` | `"true"` / `"false"` |
| `place_id` | Optional: the listing being claimed (the directory's `?claim=` value) |

Answers 201 `{ id, status: "pending" }`, "Thank you! Your application is in for review."; support@glamlink.net is
emailed. Refusals: 400 `INVALID_INPUT` with `details.field`; 20 submissions an hour per address across the public
forms. Approval makes the person an account with a page (section 10.14).

### 10.6 Professional and brand pages (Oct 23; products and articles on them come next)

Mohit (Oct 23): every professional or brand with a live Access card has a page, shown while the card is live; admins
can unlist any page and make one for a brand with no login yet (it shows without a card). A brand is a professional
who shows their business name. There is no "industry" yet.

**`GET /profiles`** (no sign-in): one page of pages, by name. `type` (`brand` or `individual`), `featured=true` (the
home rows, in the admins' order), `search` (name, tagline, specialties, city, state), `page`, `limit` (12, at most 50).
Each row: `{ id, slug, type, name, image, tagline, city, state, specialty, is_featured }`: `name` is a brand's
business name or an individual's name, `image` the page's image (else the card's photo), `tagline` the page's (else
the card's title), `city` and `state` the card's main location.

**`GET /profiles/:slug`**: the page, found by its own slug or its card's handle (link with the `slug` it answers):

```json
{ "id": 812, "slug": "revance", "type": "brand", "name": "Revance", "image": "…", "cover_image": "…",
  "tagline": "…", "about": "<p>…</p>", "website": "https://…", "social": [{ "title": "Instagram", "url": "https://…" }],
  "location": { "city": "…", "state": "…" }, "specialties": ["…"], "email": "…", "phone": null, "booking_link": "…",
  "is_featured": false, "city": "…", "state": "…", "specialty": "…",
  "access_card": { "slug": "revance", "url": "https://glamlink.net/access/revance" },
  "topics": [{ "id": 3, "name": "Skin", "slug": "skin" }],
  "products": { "count": 0, "rows": [] }, "journal": { "count": 0, "rows": [] },
  "magazine": { "count": 0, "rows": [] }, "videos": { "count": 0, "rows": [] } }
```

`about` is rich text cleaned like the card bio; `email` and `phone` are the card's, as the card shows them (`phone`
null when hidden; both null without a card); `access_card` is null without a live card. A hidden or unknown page
answers 404 `NOT_FOUND`. `products` holds the first 4 products the account put up or makes (rows as the shop lists
them); **`GET /profiles/:slug/products`** pages them all (`page`, `limit`). `journal` holds the first 3 articles that
feature the account (section 10.7); **`GET /profiles/:slug/articles`** pages them all. `videos` holds the first 4
videos the account appears in (section 10.9); **`GET /profiles/:slug/videos`** pages them. `magazine` holds the first 3
issues the account appears in, each with its `role` (section 10.10); **`GET /profiles/:slug/magazine`** pages them.

**The owner's page:** `GET /my/profile` and `PUT /my/profile` (a signed-in professional or brand, Free too) answer
`{ user_id, slug, page, visible, hidden_because, public }`: `page` is what is set on the page (null fields fall back to
the card), `public` the page as everyone sees it, `hidden_because` `"no_live_card"` or `"unlisted"` when it is hidden.
`PUT` (JSON or a form) takes `tagline` (150 characters), `about` (rich text, 2,000 characters of text), `website`,
`social` (a JSON list of `{ title, url }`, up to 10; empty: the card's links), and the images as files:
`profile_image` (the image: a logo or photo) and `images` (one: the cover), or `image` / `cover_image` `""` to remove
one. Refusals: 400 `INVALID_PAGE` with `details.field`.

### 10.7 Who an article features (done Oct 23)

Each article's @handles are kept on every save and matched to accounts when read (a page's slug or a card's handle),
so a professional who gets a card after an article was written is found then. Editors also add accounts an article
never @mentions, and set a mention aside.

**`GET /journal/findJournalById/:id`** adds `mentions`: the people the article features who have a visible page,

```json
"mentions": [{ "handle": "nikicapobianco", "slug": "niki-capobianco", "name": "Niki Capobianco", "type": "individual" }]
```

(`handle` is null for someone an editor added). Link each `@handle` in the text to its page with this list instead of
one `getBusinessCard` call per handle; a handle that is not in it has no page, so leave it as text. Pages list the
articles that feature them (section 10.6: `journal`, `GET /profiles/:slug/articles`).

### 10.8 Smaller images, and what public answers hold (done Oct 23)

**Any uploaded image, smaller:** add `?w=<width>` to an image link on the API host
(`https://api.glamlink.net/images/<file>?w=400`) and the API answers a WebP at most that wide (never wider than the
original). Widths snap up to 200, 400, 800, 1,200 or 1,600, so ask for what the slot needs: 400 for grid cards and
home tiles, 800 to 1,200 for heroes. Copies are made on their first request and kept, with a one-year cache header.
Image fields stay plain links, so this works for every image already uploaded (cards, products, topics, articles,
pages). Files in subfolders (QR codes) and GIFs answer as they are. With `next/image`, a loader does it:

```ts
const apiImage = ({ src, width }: { src: string; width: number }) => `${src}?w=${width}`;
// <Image loader={apiImage} src={product.cover_image} width={400} height={400} alt="" />
```

**Public answers are built from allowed fields:** the pages (`/profiles`), the article cards, the product cards, and a
product for anyone but an admin (`findById`: the card's fields, `description` and its topics) list the fields they
show; a column added later stays private until it is listed.

### 10.9 Watch: videos by series (done Oct 23)

Videos live on the server, grouped by series: Beauty Vault Podcast, Expert Take, Treatment Spotlight, Industry Voices
(admins can add more). Each series names its YouTube playlist, and the API imports its new uploads with its own key
when an admin presses the admin panel's import button; admins paste single links too, and set each video's people and
topics.

| Call | Answers |
| --- | --- |
| `GET /video-series` | The series in order: `[{ id, name, slug, sort_order, video_count }]` |
| `GET /videos` | One page of published videos, newest first: `series` (a series' slug), `featured=true` (the featured ones, in their order), `search` (title, description), `page`, `limit` |
| `GET /videos/:slug` | One video: the card plus `description`, `embed_url`, `watch_url`, `people` (`[{ id, slug, name, type, role }]`, role `host`, `guest` or `featured`, those with a page), `topics` (`[{ id, name, slug }]`) and `related` (4 more from its series) |

A video card: `{ id, slug, title, youtube_id, thumbnail, published_at, duration_seconds, is_featured, series: { id, name, slug } }`.
`thumbnail` is YouTube's image (`i.ytimg.com`): allow that host for `next/image`, or use `<img>`.

| For | Call |
| --- | --- |
| Watch + Learn (home) | `GET /videos?featured=true&limit=4` (`GET /videos?limit=4` while none is featured) |
| The Watch page | `GET /video-series`, then `GET /videos?series=<slug>` per series |
| The podcast page | `GET /videos?series=beauty-vault-podcast` (episode pages: `GET /videos/:slug`) |

Profile pages list the videos an account appears in (`videos`, and `GET /profiles/:slug/videos`), and a topic
(`GET /journal/topic/:id`) adds its `videos`. Once the server's key is set and the first import ran, the website can
drop `NEXT_PUBLIC_YOUTUBE_API_KEY` (the audit item "YouTube key in the browser").

### 10.10 The magazine (done Oct 23)

The 14 issues the website listed in `src/data/issues.ts` (104 to 117) are in the API, with who appears in each
(admins set it).

| Call | Answers |
| --- | --- |
| `GET /magazine` | One page of published issues, newest first (`featured=true`: featured ones; `page`, `limit`) |
| `GET /magazine/:slug` | One issue (`issue-117`) and `features`: `[{ id, slug, name, type, role, page_number }]`, role `cover`, `featured` or `mentioned`, those with a page, cover first |

An issue: `{ id, slug, title, issue_number, cover_image, publish_date, short_description, is_featured, flipbook }`.
`flipbook` is `{ publuu_account_id, publuu_flipbook_id, url }` (the embed link the digital page builds today:
`https://publuu.com/flip-book/<account>/<flipbook>/page/1?embed`) or `{ url }` for a flipbook given as a link; null
without one. Covers point at the website's own files (`https://glamlink.net/magazine/…`) until the backend copies them
to the API; keep `public/magazine` until then. Dates and descriptions are empty until admins fill them in.

Profile pages list the issues an account appears in (`magazine`, each with its `role` and `page_number`) and
`GET /profiles/:slug/magazine` pages them.

### 10.11 Site-wide search (done Oct 23)

**`GET /search?q=<text>`** (no sign-in): every group's first rows (`limit`, 5 by default, at most 10) with its count:

```json
{ "topics": { "count": 2, "rows": [] }, "professionals": { "count": 14, "rows": [] }, "brands": { "count": 1, "rows": [] },
  "products": { "count": 6, "rows": [] }, "articles": { "count": 9, "rows": [] }, "videos": { "count": 3, "rows": [] } }
```

**`GET /search?q=<text>&type=<group>&page=1&limit=12`**: one group, paged (`{ count, rows }`), for "See all".

Rows are each group's own light rows: topics `{ id, name, slug, cover_image, tile_image }`, professionals and brands
as `GET /profiles` rows, products as the shop's, articles as the journal cards, videos as the video cards. Matches
ignore case; exact matches come first, then those starting with the search, then the rest. What is matched:
topic names; a page's name, tagline, specialties, city and state; product title, short description, brand and
category; article title, short description, category and author; video title and description. A search is 2 to 100
characters (else 400 `INVALID_SEARCH`, `details.field: "q"`); one address may search 60 times a minute.

### 10.12 Ads: live ads and their counts (done Oct 23)

**`GET /ads?live=true`** answers only the ads to show now: active, inside their start and end dates (whole days), in
their order; `slot=<slot_id>` and `page=<page name>` (an ad lists its `pages`) narrow them. Without `live`, `GET /ads`
answers every ad as before (the admin list).

**`POST /ads/track`** `{ ad_id, type }` (`type`: `impression` or `click`): the payload the ad slots send today, now to
the API (`${API}/ads/track`, not the website's own `/api/ads/track`). Answers `{ counted: true }`; 400
`INVALID_AD_EVENT` (`details.field`) for an unknown ad or type. Counts are kept per ad and day for admins; one address
may send 300 a minute.

### 10.13 The directory (done Oct 23)

Mohit (Oct 23): /directory shows our own profiles on top, then about 20 Google listings near the visitor (with the
filters, by Google's relevance). A Google listing has "Claim this profile", which opens the apply form prefilled from
Google; a "Don't see your profile? Get yours" banner opens the form with "Find my business on Google".

**Our profiles: `GET /directory/search`.** Live Access cards and the applications admins approved, one page:

| Parameter | Meaning |
| --- | --- |
| `lat` and `lng`, or `location` | The visitor's point, or a place typed ("Las Vegas, NV", a ZIP; the API geocodes it). Nearest first, within `radius` miles (25 by default, at most 100) |
| `q` | Name, title or specialty |
| `specialty`, `city`, `state` | One specialty; a city; a state (as written on the card, e.g. `NV`) |
| `page`, `limit` | 12 by default, at most 50 |

Each row: `{ kind, id, slug, name, image, tagline, city, state, specialty, distance_miles }`. `kind: "profile"` links to
the page (`/profiles/<slug>`); since approved applicants have accounts and pages (section 10.14) nearly every row is
one. `kind: "listing"` is an approved application with no account, shown by **`GET /directory/listings/:id`**:
its name, title, specialties, bio, photos, website, booking link, social links, locations (an exact address only for
exact-address locations, with the business phone given for it), hours and offer; not the applicant's own email or
phone. Without a place, rows come by name.

**Google's listings: `GET /directory/google`** with `lat` and `lng` (or `location`), `type` (`esthetician`, `med-spa`,
`hair-stylist`) and `q` (words): up to 20 `{ place_id, name, address, city, state, rating, review_count, photo_url,
maps_url, website, type, distance_miles }`, by Google's relevance. Listings already claimed through the directory and
closed businesses are left out. `photo_url` is the API's own link (`/directory/google/photo?...`, a redirect to Google's
image), so no key reaches the browser.

**Claiming and starting from Google:**

1. `GET /directory/google/search?q=<business name, city>` (the form's "Find my business on Google"): up to 5
   `{ place_id, name, address, city, state, claimed }`.
2. `GET /directory/google/places/:placeId`: `{ place_id, claimed, form, name, address, rating, review_count, maps_url,
   photos }`, where `form` holds the apply form's fields Google knows: `place_id`, `phone`, `website`, `bio`, `locations`
   (one exact address, primary) and `business_hours` (`[{ note: "Monday: 9:00 AM – 5:00 PM" }]`). Google does not know
   the person's name, title or email: the form asks for them.
3. `POST /directory/applications` as before (section 10.5), with `place_id`. Once an admin approves it, the listing
   leaves Google's list and the application shows among our profiles.

Google calls cost money: the API keeps answers six hours and allows 30 Google searches a minute per address (300
photos). Without the server's Google key these answer 503 `GOOGLE_NOT_CONFIGURED`. The mock provider and its invented
ratings can go.

### 10.14 Listings become accounts; the dashboard for listings and products (done Oct 23)

Mohit (Oct 23): when an admin approves a directory application, its email gets a professional account (a brand
account when the admin approves it as one: its page goes by the business at the listing's main location) and the
person is emailed a "Set your password" link (or, if the account already had a password, a note to sign in). They sign in to the **same dashboard as Access** to keep their listing up to
date, manage their products and make their Free digital card. The account gets a public page made from the listing
(section 10.6: `listing` holds its locations, hours and photos; `email` and `phone` stay null), and the directory shows
it once, as a profile.

**The owner's listing:** `GET /my/directory` and `PUT /my/directory` (signed in, a professional or brand): the listing's
fields as the form sends them (not `email`, which is the sign-in, nor the form's questions). Photos: `profile_image`
(a file) replaces it, `""` removes it; `images` adds photos (up to 10 in all, `gallery_meta` for their captions);
`remove_photos` (a JSON list of photo links) takes some out. No listing: 404 `NO_LISTING`.

**The owner's products** (shown at once; admins can still edit, unpublish or delete them):

| Method | Path | Body | Answers |
| --- | --- | --- | --- |
| GET | `/my/products` | `page`, `limit` | `{ count, rows }`: their products, drafts too, newest first |
| POST | `/my/products` | `title` (required), `short_description`, `description`, `category`, `brand` (text), `price` (dollars, `12.50`), `link` (a web link), `status` (`published` by default, or `draft`); the cover as `images` (one file) | 201, the product (with `owner`, `brand_profile`, `status`) |
| PUT | `/my/products/:id` | the same fields (`cover_image: ""` removes the cover) | The product |
| DELETE | `/my/products/:id` | | `{ deleted: true }` |

A brand's products are its own make (`brand_id` is the brand). Refusals: 400 `INVALID_PRODUCT` with `details.field`;
another account's product answers 404.

### 10.15 Calls by slug (done Oct 23)

Every page the website links to can be found by its slug, and the calls by id keep answering, so old links keep
working:

| Page | By slug | By id (as before) |
| --- | --- | --- |
| Article | **`GET /journal/slug/:slug`** (new): the same answer as by id; 404 `NOT_FOUND` when there is none (drafts for admins only) | `GET /journal/findJournalById/:id` |
| Topic | `GET /journal/topic/:slug`: the same call takes a slug or an id | `GET /journal/topic/:id` |
| Product | **`GET /discover/shop/slug/:slug`** (new): the same answer as by id | `GET /discover/shop/findById/:id` |
| Professional or brand page | `GET /profiles/:slug` (section 10.6) | |
| Video | `GET /videos/:slug` (section 10.9) | |
| Issue | `GET /magazine/:slug` (section 10.10) | |

Each article and product has a slug of its own, made from its title when it is added unless an admin gives one; it
stays when the title changes, so links last. Products carry `slug` in every answer now (the shop's rows, a page's
products, `/my/products`). Existing articles and products got theirs on Oct 23 (a slug an admin had typed was kept,
written as a slug).

### 10.16 The sitemap feed (done Oct 23)

`GET /sitemap` answers every public page's id, slug and date of last change, by kind, in one light call (the whole
site; no paging):

```json
{ "articles": [{ "id": 12, "slug": "glow-guide", "updated_at": "2026-10-01T10:00:00.000Z" }],
  "topics": [{ "id": 4, "slug": "skin", "updated_at": "..." }],
  "profiles": [{ "id": 812, "slug": "skinmedica", "type": "brand", "updated_at": "..." }],
  "products": [...], "videos": [...], "issues": [...] }
```

Each kind lists what its own pages show: published articles, products, videos and issues; active topics; visible
professional and brand pages (`type`: `individual` or `brand`). A page's date is its latest change: of the page, its
card, its listing or its account. The slugs are the ones the calls in section 10.15 take.

### 10.17 Page analytics (done Oct 23)

**Reporting**, as the card page does: `POST /profiles/:slug/events` with
`{ event_type, event_target?, visitor_id?, session_id? }`.

| `event_type` | When | `event_target` |
| --- | --- | --- |
| `PAGE_VIEW` | The page is shown | |
| `WEBSITE_CLICK` | The website link | The link |
| `ACCESS_CARD_CLICK` | The link to their Access card | |
| `PRODUCT_CLICK` | A product on the page | The product's `id` |
| `BOOKING_CLICK` | The booking link | |
| `SOCIAL_CLICK` | A social link | The platform (`instagram`, ...) |
| `EMAIL_CLICK`, `PHONE_CLICK` | The email or the phone | |

`visitor_id` is a random id kept in the browser (unique visitors are counted by it); `session_id` is optional. Answers
`{ counted: true }`, or `{ counted: false }` for robots (search engines, link previews). Refusals: 400
`INVALID_PAGE_EVENT` with `details.field`; 404 for a page that is not shown; 120 a minute from one address. Nothing
about the visitor is kept beyond these ids and the kind of device.

**The dashboard**: `GET /my/profile/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` (signed in, a professional or brand; both
dates are today when not given) answers in the shape of the card's analytics:

```json
{ "page": { "id": 812, "slug": "skinmedica", "name": "SkinMedica", "visible": true },
  "date_range": { "from": "2026-10-01", "to": "2026-10-23" },
  "summary": { "total_views": 120, "unique_visitors": 80, "total_clicks": 30 },
  "events": { "PAGE_VIEW": 120, "WEBSITE_CLICK": 10, "ACCESS_CARD_CLICK": 4, "PRODUCT_CLICK": 12, "...": 0 },
  "daily_views": [{ "date": "2026-10-01", "count": 5 }],
  "daily_clicks": [{ "date": "2026-10-01", "count": 2 }],
  "device_breakdown": [{ "device_type": "mobile", "count": 70 }],
  "top_targets": [{ "event_type": "PRODUCT_CLICK", "event_target": "31", "count": 7 }] }
```

As for cards, days without events are left out of the daily lists. `top_targets` holds the 10 most clicked links and
products. Refusals: 400 `INVALID_INPUT` (`details.field`) for a date that is wrong, in the future, or a `from` after
`to`.

### 10.18 The cache-refresh hook (done Oct 23)

After each change made through the API (an admin's, or a signed-in owner's: their page, listing, products or card),
the API tells the website which of its data changed, so the website can keep pages cached for hours and still show
changes within seconds. **The website adds the receiving route:**

```
POST <WEBSITE_REFRESH_URL>                      the address the website gives us, e.g. https://glamlink.net/api/revalidate
Authorization: Bearer <WEBSITE_REFRESH_SECRET>  a secret both sides keep: refuse calls without it
Content-Type: application/json

{ "tags": ["journal", "topics"] }
```

Answer 2xx. Changes close together come in one call, a second after the first. A call that fails is not repeated, so
keep an expiry on cached pages too (an hour, say).

| Tag | What changed |
| --- | --- |
| `journal` | Articles, their categories, authors and FAQs, who they feature |
| `topics` | Topics and what they link |
| `shop` | Products (their owners' changes too) |
| `discover` | Education and events |
| `profiles` | Professional and brand pages: the page, its card, its directory listing |
| `cards` | Access cards (a paid card going live too) |
| `directory` | Directory listings |
| `videos` | Videos and series (an admin's YouTube import too) |
| `magazine` | Issues and who appears in them |
| `ads` | Ads |
| `home` | The home page's settings |
| `podcasts` | The podcast schedule |
| `blog` | The blog |

Tag each cached fetch with the data it shows: a profile page shows products, articles, videos and issues, so
`profiles`, `shop`, `journal`, `videos` and `magazine`. Tags name data, not single pages: editing one product refreshes
every page that shows products, which is cheap at this size (if per-page tags such as `profile:<slug>` become worth
it, ask). Changes made outside the API's calls (account details edited in the app, a plan ending) show when the cache
expires. Once the route is live, send us its address and the secret for the server's settings.

