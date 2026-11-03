# Website frontend: backend API changes for the cutover

For: the Claude working on the Glamlink website (glamlink.net) frontend.
Backend: `api.glamlink.net`, all routes under `/api/v1`. Backend branch: `master` (the code that deploys; it holds every earlier phase).

The backend and the website ship together in one cutover. After it, every signed-in person has to sign in
again (old tokens stop working). Everything below is what the website must change to work with the new
backend; anything not mentioned answers as before.

**Status (Oct 30):** the website's `master` runs against this API on `https://test.glamlink.net`; glamlink.net
still serves the old site on `https://node.glamlink.net` until the switch. The new backend runs at
`https://api.glamlink.net` (all routes under `/api/v1`). This note was checked against the code on Oct 30; known
gaps carry their audit IDs (W-…, W-ACC-…, A-CNT-…, X-…).

**Nov 1–2:** the changes in the Nov 1 changelog row are built and tested in the backend but not deployed. The website's
matching changes (on its `master`, Nov 4) rely on them: deploy the API first.

**Nov 3:** the profile pages in the owner's design (the Nov 3 row, section 10.6.1) are built and tested in the backend,
not deployed: run its three migrations (`20261103-1300` to `-1500`) before the website that reads them. So are the
calls of the Directory, Professionals and Brands pages (sorting and filters in section 10.6, `GET /directory/filters`
and `GET /directory/map` in section 10.13) and the Shop's sorting, price bands and saved products (section 10.3), the
two newer Nov 3 rows, which need no migration.

**Nov 4:** product tags, categories and the button label (the Nov 4 row, sections 10.3 and 10.14) are built and tested
on the backend's `master`, not deployed; deploying them takes `npm run migrate`.

## Checklist before the switch

Found by reviewing the website code (`glamlink_web`, Oct 16) against the new backend. Details in the sections below.
Ticked on Oct 30 against the website's code (branch `preview/journal-and-heroes`, `master` plus two preview commits).

- [x] `NEXT_PUBLIC_API_URL=https://api.glamlink.net/api/v1`, then rebuild (the value is fixed at build time). In
      `.env.example`; the test build uses it. Set it again for the live build at the switch.
- [x] New sign-in (section 2): access token in memory, refresh cookie, `credentials: 'include'`, `client: "website"`.
      Detect an ended session by `code: "SESSION_EXPIRED"`, not by the old messages (`jwt expired`, `Token Not Found`).
      The direct `fetch` calls (card create/update, featured-link reorder, guest application) need the same handling.
      Done: `lib/session.ts`, `api/Api.tsx`; those calls now go through the shared client.
- [x] Pages `/verify-email` and `/reset-password` (section 3); remove `/verify-otp` and the OTP steps of
      forgot-password; logout is `POST`; change password moved to `/user/auth/change-password`.
- [x] Drop the `role_id` header everywhere (sign-in, card create/update).
- [x] `user/nearby/map/beautician/list` is now `user/nearby/map/professional/list` (section 5); rename
      `GetBeauticianListApi` and `GetBeauticianListDetailsApi` with it, and say "professionals" on the CSAM
      policy page, so no template word is left. Done (`GetProfessionalListApi`, `GetPlaceDetailsApi`). The page that
      calls them, `/journal/directory`, should go (W-2, section 10.13).
- [x] The `/directory` featured carousel calls `businessCard/getAllBusinessCards`, which is admin-only: use the public
      `businessCard/getAllProfiles` (accepted cards only).
- [x] Ad tracking posts to the relative `/api/ads/track` (the website itself, always 404): post it to the API's
      `POST /ads/track` (section 10.12), and read ads with `GET /ads?live=true&page=<page>`. Done; the website reads
      every live ad once and picks by page and slot itself, which works (W-12).
- [x] Logged-out card purchase: keep the `card_token` from `POST /businessCard` and send it on every purchase call;
      signed-in owners send their access token instead (section 8). Partly for owners on Oct 30: once the in-memory
      token was about 14 minutes old, owner calls went out without it (W-ACC-2). Fixed in the website on Nov 1 (not
      deployed): it refreshes the token before it runs out and retries once on a 401.
- [x] A guest whose email has an account (`next_step: "sign_in"` or `ACCOUNT_EXISTS`): sign in, then claim the
      draft (section 9.2). `CARD_EXISTS` on create: offer edit or replace. Since Nov 1 (not deployed) an app account's
      email counts as a new one and the purchase converts the account (W-ACC-3 fixed in the API).
- [x] The card form: at most 4 photos and 1 video; show `INVALID_CARD` errors under `details.field` (section 9.1).
- [x] Plans and prices from `GET /access/plans` before any admin price change or sale (section 9.3).
- [x] Free owners may edit details; photos, video and offers stay behind Pro (`UPGRADE_REQUIRED`, section 9.6). The
      website retired offers on Oct 24 (`aa8c6b2`); the API stopped reading and answering them on Nov 1.
- [x] After cancelling, Access Pro runs to the end of the paid month: say so, offer resume (section 9.4).
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in every build: the API requires the Turnstile token on sign-up in production,
      and the form skips the captcha without the key (then sign-up fails with `CAPTCHA_REQUIRED`). Testing mode:
      Cloudflare's always-pass test site key `1x00000000000000000000AA`. The code reads it (`Register.tsx`,
      `.env.example`); whether each build sets it is an ops check.
- [x] The Stripe publishable key comes from the same account and mode as the API's secret key (test while testing).
      The website loads the key the API reports (`lib/stripe.ts`).
- [x] `/directory-form-apply` (`directoryForm.tsx`) posts to `POST /directory/applications` (section 10.5), not
      `POST /businessCard`: the same fields, with the photos as `profile_image` and `images` (it sends `profilePhoto`
      and `gallery_images`, which the API refuses with 400 "Unexpected field"). It no longer makes a card.
      Superseded on Nov 1: the directory form is retired. The website redirects the page to `/access` (with `?claim=`),
      and the API answers `POST /directory/applications` with 410 `FORM_RETIRED`.

## Changelog

Newest first. Each entry says what changed in the API and what the website must (or can) do.

| Date | Change | Website |
| --- | --- | --- |
| Nov 4 | **Product tags, categories and the button label** (sections 10.3 and 10.14; built and tested, not deployed; needs `npm run migrate`). Every product row (the shop's lists, `slug/:slug`, `findById/:id`, a page's products, `/my/products`, the site-wide search) adds `tag` (`{ id, name, is_editorial }` or null) and `button_label` (null when unset), beside `category`. New `GET /discover/shop/tags`: the tags, in the admins' order. `GET /discover/shop/filters` lists the 8 categories first, in their order with zeros, then any other stored category. `/my/products` takes `category` (one of the 8; else 400 `INVALID_PRODUCT`), `button_label` (30 characters) and `tag_id` (an open tag; an editorial one, or changing or clearing one an admin set, is 403 `TAG_ADMIN_ONLY`) | **New:** the tag top-left on product cards and the product page; the button reads `button_label`, else "Shop now"; the category filter shows all 8. In the dashboard's Products: Category (a select of the 8), Tag (the open tags; an editorial one shown, locked) and Button label |
| Nov 3 | **Shop sorting, price bands and saved products** (section 10.3; built and tested, not deployed; no migration). `GET /discover/shop` takes `sort` (`featured`, `newest`, `price_asc`, `price_desc`, `name`), `min_price` (in the band) and `max_price` (not), and `ids` (up to 100 saved products, in their order unless sorted); a value it cannot take is 400 `INVALID_SHOP_QUERY`. `GET /discover/shop/filters` adds `price: { min, max }` (null when no product has a price) | **New:** sorting and price bands on /shop, and saved products (their ids in a cookie, most recent first). Don't call the list with an empty `ids`: it would answer every product |
| Nov 3 | **The Directory, Professionals and Brands pages** (sections 10.6 and 10.13; built and tested, not deployed; no migration). `GET /profiles` takes `sort` (`name`, `recommended`, `newest`, `nearest`), `specialty`, `category`, `shipping`, `state` (a U.S. state by code or name), `city`, `lat` and `lng` (each row then has `distance_miles`) and `radius`; a value it cannot take is 400 `INVALID_PROFILE_QUERY`. Its rows (and the site-wide search's professionals and brands) add `category`, `category_label` and `shipping`. New `GET /directory/filters?type=individual\|brand` (each option with as many pages as the list finds for it) and `GET /directory/map` (the hero map's pins: professionals' pages with a point, to 3 decimals; `north`, `south`, `east`, `west`, `limit`) | **New:** the directory's map hero and its three sections (our professionals, 15 Google listings from `GET /directory/google?lat=36.1699&lng=-115.1398&limit=15`, a few brands), and the Professionals and Brands pages with their sorting and filters. Show `category_label`, else `specialty` |
| Nov 3 | **Profile pages in the owner's design** (section 10.6.1; built and tested, not deployed). `GET /profiles/:slug` adds `intro` (else the card bio as text, 300 characters), `category` and `category_label` (a brand's from a list of 8 keys, "Skincare Brand"; a professional's specialty), `shipping` and `shipping_label`, `about_image` (else the page's first photo, else the card's cover photo), `quick_info` (`has_education`, `on_podcast`, `in_journal`), and the lists `media` (5), `education` (3) and `podcast` (the newest Beauty Vault episode); `cover_image` falls back to the card gallery's cover photo; `products` holds 8. New public `GET /profiles/:slug/media` (the card's gallery, `source: "card"`, until the page has its own), `GET /profiles/:slug/education`, `GET /profiles/:slug/education/:itemSlug`, and `?series=` on `GET /profiles/:slug/videos`. The owner's `GET`/`PUT /my/profile` read and write `intro`, `category`, `shipping` and `about_image` (the file `about_image`, or a link; `""` clears). New owner endpoints for Media & Images (`/my/profile/media`: list, add photos, MP4s or a YouTube/Vimeo link, `import-card`, order, caption and alt, delete; the first add copies the card's gallery in) and Education (`/my/profile/education`: list, one, add, edit, order, delete; `POST /my/profile/uploads` for images in an article's text). Page events add `SHARE_CLICK`, `MEDIA_CLICK`, `EDUCATION_CLICK`, `PODCAST_CLICK`, `JOURNAL_CLICK` | **New:** the page's new layout, the View-all pages (`media`, `education`, `podcast` with `series=beauty-vault-podcast`), the education item page, and the dashboard's new My Page fields and Media & Images and Education tabs. Allow frames from YouTube and Vimeo's player and their thumbnails' hosts (`i.ytimg.com`, `i.vimeocdn.com`); render article bodies through DOMPurify too |
| Nov 1 | **Access fixes, one form, brands and Stripe** (Mohit's decisions of Nov 1; built and tested, not deployed). **Cards** (section 9.1): `professional_type` (`individual`, the default, or `brand`); a brand's `professional_title`, `specialties` and `preferred_booking_method` are optional; `locations` are optional (`[]` clears them); `claimed_place_id` on a create claims a Google listing for an admin to verify (section 10.13); `offer_promotion` and `promotion_details` are ignored on input and left out of every answer. The signed-in create answers `business_card_id` too. **App accounts:** a guest's email that belongs to an app account counts as new (`account_exists: false`, `next_step: "plan_selection"`, no `ACCOUNT_EXISTS`); the purchase or Free makes it a professional account of the card's type, with the set-password email (W-ACC-3). **Plans** (9.3): Access Pro $9.99 a month; the new feature copy, each plan's list holding the one before it; `entitlements` with the photo and video limits (W-ACC-12). **Select plan:** `nfc_only` makes the card live on Free at once, then the keychain is paid (`next_step: "shipping"`); choosing Free again changes nothing and sends no email; an unknown plan is 400 `INVALID_PLAN`. **Checkout** (9.4): the API asks Stripe itself while a checkout waits (the poll, `/pay`, the quote and a sweeper), so a paid card goes live without the webhook; statuses add `processing` and `cancelled`, and `failed` is shown when Stripe declined the last attempt; the view adds `client_secret` while payable and `card` once paid; one payment under way per card (409 `CHECKOUT_IN_PROGRESS`, `details.checkout_id`); `/pay` answers `{ paid: true, checkout_id }` when nothing is due; cards (with Apple Pay and Google Pay) and Link only; 400 `AMOUNT_TOO_SMALL`; Stripe's refusals answer 502 `PAYMENT_UNAVAILABLE` instead of `PAYMENT_FAILED`; a checkout asked for by someone who may not act on its card answers 404 whether it exists or not. **Seat:** `past_due` and `last_payment_failed_at`; Pro at most 21 days after a renewal first fails; `POST /access/billing-portal` answers a Stripe billing portal `url`. **Analytics** (9.7, 10.17): the card's and the page's numbers are Pro's: 403 `UPGRADE_REQUIRED`, `details.feature: "analytics"` (W-ACC-7). **Directory** (10.13): `GET /directory/search` takes `type=individual` or `brand` and its rows carry `type`; `POST /directory/applications` answers 410 `FORM_RETIRED` (10.5). A claimed draft, a deleted card and a Free card going live now send the `cards` and `profiles` refresh tags (W-10, in part) | **Done on Nov 1–2** in the website (uncommitted on `preview/journal-and-heroes`, not deployed): "I am a…" Professional or Brand on the Access form, with brand labels; optional locations; "Claim This Profile" opens `/access?claim=<place id>`, prefilled from `GET /directory/google/places/:placeId`; the directory form retired (`/directory-form-apply` redirects to `/access`); `/brands` from `GET /profiles?type=brand`, and the nearby search with `type=individual`; `business_card_id ?? id` (W-ACC-1); a token refresh before calls and one retry on 401 (W-ACC-2); plans loaded after the session (W-ACC-4); "paid" only when the poll says so, else "processing" with Check again (W-ACC-5); the checkout kept per card and resumed, `CHECKOUT_IN_PROGRESS` followed, `{ paid: true }`; the past-due banner and "Manage billing"; the analytics' upgrade state; `REJECTED`, `CANCELLED` and `REFUNDED` payments (W-ACC-10). **Still to do:** read the photo and video limits from `entitlements` (the form still has 4 and 1); cap Instagram handles at 3 (W-ACC-6) |
| Oct 30 | No API change. This note was corrected against the code (audit of Oct 30): sign-in rules for the purchase calls (section 6), what happens to an email with an account (sections 7, 9.2), checkout statuses (9.4), card analytics (9.7), the error codes (section 4), and stale "coming" notes | **Must:** after a signed-in create, read `data.business_card_id ?? data.id` (W-ACC-1: today `/pricing?businessCardId=undefined`). **Should:** refresh the token before owner calls and retry once on 401 `SIGN_IN_REQUIRED` / `CARD_TOKEN_REQUIRED` (W-ACC-2); load plans after the session is restored (W-ACC-4); show "processing" when the checkout is not `paid` yet (W-ACC-5); cap Instagram handles at 3 (W-ACC-6); map payment statuses `REJECTED` and `CANCELLED` (W-ACC-10); retire `/journal/directory` (W-2); drop the browser YouTube key (W-9). **Known API gaps:** the public topic answer carries whole card rows (W-1) and draft articles and products (A-CNT-3); an app account's email cannot buy (W-ACC-3); Contact Us emails nobody (X-1); card analytics are not limited to Pro (W-ACC-7) and count days in UTC (W-ACC-8); `/access` changes send no refresh tags (W-10); four by-id calls answer 200 with a string on a miss (X-2) |
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
| Oct 23 | **Watch** (section 10.9): `GET /video-series`, `GET /videos` (series, featured, search, paging), `GET /videos/:slug` (embed link, people, topics, related); profile pages and topics list their videos. The API imports each series' YouTube playlist hourly with its own key (superseded on Oct 24: imports run when an admin asks, not hourly) | **Should:** build Watch + Learn, the Watch page and the podcast page from these, then drop the browser's YouTube key |
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
| Oct 16 | **The plan's features are enforced by the API** (section 9.6): once a card is live, its owner on Free can still change the details (text, links, hours, locations) but not the photos, the video or the profile image, and cannot run a special offer: 403 `UPGRADE_REQUIRED` with `details.feature` (`edit_media`, `special_offers`, or `edit_details` if an admin turns Free editing off). Pro may do all of it. Public cards show an offer only while the owner is Pro. Drafts, cards waiting for review and rejected cards can always be edited | **Should:** let Free owners edit their details (today the Edit button sends them to the plans), keep photos, video and offers behind Pro; show the offer fields to Pro owners; on `UPGRADE_REQUIRED`, offer the upgrade. (Oct 30: done, except offers: the website retired them on Oct 24, `aa8c6b2`; the API still takes them until the plan rework) |
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
| `INVALID_INPUT` | 400 | A field is missing or invalid; `details.field` names it when it can (sign-up: name or email; addresses: `state_id`, `city_id`; the public forms; the billing portal's `return_url`, Nov 1) |
| `CAPTCHA_REQUIRED` / `CAPTCHA_FAILED` | 400 | Turnstile token missing or rejected |
| `CAPTCHA_NOT_CONFIGURED` | 503 | The API has no Turnstile secret yet: sign-up is off until it does (a server setting, not the visitor's fault) |
| `TOO_MANY_REQUESTS` | 429 | Too many guest cards from one address in an hour |
| `CARD_TOKEN_REQUIRED` | 401 | A purchase call without the card's token (section 8) |
| `ADDRESS_INVALID` | 400 | Shipping address rejected by the carrier (message: "Address validation failed: …") |
| `ADDRESS_NOT_FOUND` | 404 | No address on the card or account (message: "Address not found") |
| `ADDRESS_NOT_VERIFIED` | 400 | Shipping rate asked before the address was saved (message: "Please verify address first") |
| `NFC_ALREADY_PURCHASED` | 400 | The card already has its NFC keychain (message: "NFC card already purchased") |
| `PAYMENT_FAILED` | 4xx | Stripe refused a call; the message is Stripe's. Since Nov 1 the Access purchase, seat and billing portal calls answer `PAYMENT_UNAVAILABLE` instead |
| `PAYMENT_UNAVAILABLE` | 502 | Stripe refused or could not be reached on a quote, `/pay`, a subscription cancel or resume, or the billing portal (Nov 1): "Payments are not available right now. Please try again in a few minutes." |
| `CHECKOUT_IN_PROGRESS` | 409 | A payment for this card is already being confirmed, or has just gone through: poll `details.checkout_id` (Nov 1, section 9.4) |
| `AMOUNT_TOO_SMALL` | 400 | A keychain-only total of 1 to 49 cents, below Stripe's smallest card payment (Nov 1) |
| `NO_CUSTOMER` | 404 | The billing portal for someone who has never paid through Stripe here (Nov 1) |
| `FORM_RETIRED` | 410 | `POST /directory/applications`: the directory form is retired; profiles are made on `/access` (Nov 1) |
| `INVALID_CARD` | 400 | A card field fails the form's rules; `details.field` names it (section 9.1) |
| `ACCOUNT_EXISTS` | 409 | A guest's draft whose email already has a website account (an app account does not count since Nov 1): sign in, then claim it (section 9.2) |
| `CARD_EXISTS` | 409 | The person already has a card; `details.card_id` is theirs. Send `replace: true` to swap it (section 9.2) |
| `CARD_NOT_CLAIMABLE` | 409 | Claiming a card that is no longer a draft, or is someone else's |
| `UPGRADE_REQUIRED` | 403 | The owner's plan does not include this; `details.feature` is `edit_media`, `edit_details` or (Nov 1) `analytics` (sections 9.6, 9.7). `special_offers` is gone |
| `ALREADY_OWNED` | 409 | The person already has what the plan sells (Access Pro) |
| `SHIPPING_COUNTRY_UNSUPPORTED` | 400 | The keychain does not ship to the address's country |
| `ADDRESS_CHECK_UNAVAILABLE` | 502 | Shippo did not answer; try again |
| `CHECKOUT_EXPIRED` | 409 | The quote is over 24 hours old or its payment lapsed: quote again |
| `INVALID_PLAN` | 400 | A checkout quote (or, since Nov 1, `select-plan`) for a plan code that does not exist or is switched off |
| `PLAN_IS_FREE` | 400 | A checkout quote for a free plan: choose it with `select-plan` |
| `ALREADY_PAID` | 409 | Paying a checkout that is already paid |
| `NO_SUBSCRIPTION` | 404 | Cancel or resume without an Access Pro subscription |
| `SHIPPING_UNAVAILABLE` | 502 | The shipping-rate call to Shippo failed: try again |
| `NO_SHIPPING_RATES` | 400 | Shippo has no rate for the address |

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
- **ownerOrAdmin**: the signed-in owner of the record (or an admin).
- **card token**: the card's token (`x-card-token`, section 8), the card's signed-in owner, or an admin. On the two
  card edits below the token counts only while nobody owns the card; once owned, only the owner or an admin. An
  unowned card is never open to anyone without its token.

Before, most of these let guests through and then failed with `500`. Website and shared endpoints now:

| Method | Path | Needs |
| --- | --- | --- |
| POST | `/businessCard` | public (logged-out purchase; 10 an hour per address in production) |
| POST | `/businessCard/select-plan` | card token |
| POST | `/businessCard/shipping-rate-public` | card token |
| POST | `/businessCard/create-subscription-public` | card token |
| POST | `/order/addNewAddress-public`; PUT `/order/editAddress-public/:id`; GET `/order/getAddressByBusinessCardId/:business_card_id` | card token |
| GET | `/access/plans` | public (an access token, or a guest's card token with `?business_card_id=`, adds personal prices and `owned`) |
| POST | `/access/cards/:id/claim` | authenticate (any account) and the draft's card token |
| DELETE | `/access/cards/:id` | requireProfessional (the owner) |
| POST | `/access/checkout/quote`, `/access/checkout/:id/pay`; GET `/access/checkout/:id` | card token (for `/pay` and the read, of the checkout's card; anyone else gets 404 whether it exists or not, section 9.4) |
| GET | `/access/subscription`; POST `/access/subscription/cancel`, `/access/subscription/resume` | requireProfessional |
| POST | `/access/billing-portal` | requireProfessional (Nov 1, section 9.4) |
| POST | `/order/addNewAddress`, `/order/deleteAddress/:id`; PUT `/order/editAddress/:id`; GET `/order/getAllUserAddress` | authenticate (own addresses only) |
| POST | `/businessCard/createBusinessCard` | requireProfessional |
| GET | `/businessCard/getMyBusinessCard` | requireProfessional |
| POST | `/businessCard/select-address` | requireProfessional |
| POST | `/businessCard/shipping-rate` | requireProfessional |
| GET | `/businessCard/payment-history` | requireProfessional |
| POST | `/businessCard/create-subscription` | requireProfessional |
| POST | `/businessCard/cancel-subscription` | requireProfessional |
| PUT | `/businessCard/updateBusinessCard/:id` | card token while unowned; then the owner or an admin |
| PUT | `/businessCard/:id/featured-links/reorder` | card token while unowned; then the owner or an admin |
| GET | `/businessCard/getBusinessCardById/:id`, `/getBusinessCard/:slug`, `/search`, `/getAllProfiles`, `/filter`, `/getAllCategories`, `/findCategoryById/:id`, `/getAllDirectories`, `/getProfilesByDirectory/:id` | public |
| POST | `/access-card/analytics/event` | public (no rate limit yet) |
| GET | `/access-card/analytics/:businessCardId`, `/access-card/analytics/:businessCardId/events` | ownerOrAdmin; an owner on Free gets 403 `UPGRADE_REQUIRED` (Nov 1, section 9.7) |
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

- Paid plans go through the checkout calls `/access/checkout/*` (section 9.4); Free goes through `select-plan`. The
  old calls `shipping-rate[-public]`, `create-subscription[-public]` and `cancel-subscription` keep their payloads
  (plus the card token, section 8) and run on the same checkout, but no client uses them now.
- A buyer without an account now gets a professional account **without a password**. The welcome email has
  a "Set Your Password" button to `/reset-password?token=…` (valid 7 days) instead of a generated password.
  Setting it also verifies the email. Until then, sign-in answers `PASSWORD_NOT_SET`.
- If the card's email already belongs to a website account (professional, brand or staff), the plan and payment
  calls answer 409 `ACCOUNT_EXISTS`: the person signs in and claims the draft (section 9.2). Since Nov 1 an app
  ("user") account's email counts as a new one: no `ACCOUNT_EXISTS`, and when the card goes live the app account
  becomes a professional account of the card's type, which gets the set-password email (W-ACC-3). Website sign-in
  still refuses app accounts (`PROFESSIONAL_REQUIRED`) until then.
- A guest's card is attached to its account when it is paid or when Free (or Free with the keychain, `nfc_only`) is
  chosen (`select-plan`), not when the email is verified. Since Nov 1 the paid case does not wait for the webhook:
  the checkout poll, `/pay` and a sweeper job ask Stripe too (section 9.4).

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

A signed-in professional acting on their own card sends their access token (the dashboard's plan change now goes
through `/pricing`, which sends it). Owners have no card token, so a call that goes out without the access token is
refused. The website sends it only while the in-memory token is fresh (about 14 minutes): refresh first, and retry
once on 401 `SIGN_IN_REQUIRED` or `CARD_TOKEN_REQUIRED` (W-ACC-2).

Refused requests answer `401` with `code: "CARD_TOKEN_REQUIRED"` (no or wrong token), `401 SIGN_IN_REQUIRED`
(editing an owned card without signing in), or `403` (signed in, but not the owner). The token expires after
24 hours; a buyer who comes back later signs in instead (their account exists once the card is paid for).

## 9. Access cards, plans and payments (Phase 2b, done Oct 16)

Designed and built on Oct 16 (the backend's `docs/access.md`); each step is logged in the changelog above with
exactly what to change. In short:

- **Plans and prices from the API** (`GET /access/plans`): names, taglines, features, badge, current prices,
  a running sale, and a client's personal price. The hard-coded `PLANS`, `$4.99` and `$39.99` go (Access Pro is
  $9.99 since Nov 1).
- **Draft cards:** a guest's card stays hidden until a plan is chosen or paid.
- **An email that already has a website account:** the guest is asked to sign in (`ACCOUNT_EXISTS`), then the draft
  is claimed with its card token. An app account's email counts as new since Nov 1 (W-ACC-3).
- **One card per person:** creating a second answers `CARD_EXISTS`; owners can delete their card and make a new
  one on the same subscription and public link.
- **Checkout:** a quote with the line items, discount and the shipping choices; a corrected address to accept;
  cancel at the end of the month (with resume) instead of immediately. The current purchase calls and
  `confirmCardPayment` keep working; the Payment Element can add Apple Pay, Google Pay and Link.
- **Card form:** exactly the fields in `docs/access.md` section 1, checked by the API as the form checks them
  (`isPrimary` and the gallery captions are now read; up to 4 photos and 1 video).
- **What Free and Pro can change** (pricing page features): Free owners can keep their details current; photos and
  video need Pro (`UPGRADE_REQUIRED`), and since Nov 1 so do the analytics. The website does this.
- **Special offers:** the website retired them on Oct 24 (`aa8c6b2`: the form sends no offer fields). Since Nov 1 the
  API ignores `offer_promotion` and `promotion_details` on input and leaves them out of every card answer.
- **Professional or brand, and claims** (Nov 1): the Access form is the one way in. A card says whether it is a
  professional's or a brand's (`professional_type`), and can claim a Google listing from the directory
  (`claimed_place_id`), which an admin verifies (section 10.13).

### 9.1 The card's fields (done Oct 16)

Creating (`POST /businessCard`, `POST /businessCard/createBusinessCard`) and editing (`PUT /businessCard/updateBusinessCard/:id`)
accept exactly these fields, as the form sends them (multipart; lists and objects as JSON strings). An edit changes
only the fields it sends.

| Field | Rule (refusal: 400 `INVALID_CARD`, `details.field` in brackets) |
| --- | --- |
| `professional_type` | Nov 1. `individual` (a beauty or wellness professional) or `brand` [`professional_type`]; a create without it is a professional's. On a guest's create the account takes it when the card goes live (made now, or an app account converted). On a signed-in create (and a claim) the account takes it while it has no other live card and no products; otherwise the card takes the account's type, and the answer's `professional_type` says which. An edit that sends it changes the card's type only, so the website sends it on a create only. Pages, products, `/brands` and the directory read the account's type |
| `claimed_place_id` | Nov 1, create only: the Google listing's `place_id` from "Claim This Profile" (10 to 255 letters, digits, `_` or `-`) [`claimed_place_id`]. Never in a public answer; an admin verifies it (section 10.13) |
| `name`, `business_name` | Required, at most 100 / 150 characters |
| `professional_title` | Required for a professional, at most 100 characters; optional for a brand (Nov 1) |
| `email` | Required, valid |
| `phone`, `is_phone_visible` | Digits (other characters are removed); exactly 10 while visible (default visible) |
| `bio` | Required; cleaned to the editor's formatting; at most 80 characters of text |
| `color_code` | `#RRGGBB` |
| `specialties` | 1 to 5 (0 to 5 for a brand, Nov 1), at most 60 characters each; the first is the card's `primary_specialty` |
| `locations` | Optional since Nov 1: 0 to 10, and `[]` clears them (a card with none shows no location). Each one: `location_type` `exact_address` (with `address`) or `city_only` (with `city` and `state`), `label`, `latitude`, `longitude`, `isPrimary` (or `is_primary`; one primary, the first if none). Leave out the coordinates of a typed address: the API geocodes it after the save |
| `business_hour` | `[{ note }]`, at most 14 lines |
| `preferred_booking_method` | 1 or more of `GO_TO_BOOKING_LINK` (any case, so `GO_tO_BOOKING_LINK` works), `CALL_TEXT`, `DM_INSTAGRAM` (none is fine for a brand, Nov 1); the first needs `booking_link` or `website` [`booking_link`], the last `social_media.instagram` [`instagram`] |
| `website`, `booking_link` | Web links; `example.com` is saved as `https://example.com` |
| `social_media` | `instagram`, `instagram1`, `instagram2`, `tiktok`, `linkedin`, `youtube`, `facebook`. Other keys are dropped without an error, so a fourth Instagram handle (`instagram3`) is lost: cap the form at 3 (W-ACC-6) |
| `other_links`, `featured_links` | At most 10 each; one featured link at most |
| `important_info` | At most 10 lines of 200 characters |
| `profile_image` | Required on create [`profile_image`] |
| `images`, `videos` + `video_thumbnails` | At least one item on create; up to the plan's photos and videos (4 and 1 by default, section 9.6) and an MP4 of 21 MB at most, a thumbnail per video [`images`]. Edit: `existing_image_ids` / `existing_video_ids` list what stays; a card that already has more keeps them but cannot add |
| `new_images_gallery_meta`, `existing_images_gallery_meta` | Caption and cover (`is_thumbnail`) per new / kept photo, in order |
| `offer_promotion`, `promotion_details` | Retired. The website no longer sends them (`aa8c6b2`), and since Nov 1 the API ignores them and leaves them out of every card answer |

Every upload to the API is also capped at 50 MB per file, and each text field of a multipart form at 1 MB (multer's
default); the card's own limits above are lower.

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
- **The directory form is retired** (Nov 1; it stopped making cards on Oct 23): `POST /directory/applications`
  answers 410 `FORM_RETIRED` (section 10.5). Only `/access` makes cards and profiles, for professionals and brands.
- **The email already has a website account** (`account_exists: true`, `next_step: "sign_in"`): the plan and payment
  calls answer 409 `ACCOUNT_EXISTS`. An app account's email answers `account_exists: false` and
  `next_step: "plan_selection"` since Nov 1, as a new email does. For a website account, send the person to sign in,
  then:

  `POST /access/cards/:id/claim` with their access token and the draft's card token (`x-card-token`). Body
  `{ "replace": true }` only after they chose to replace the card they already have. Answers
  `{ business_card_id, status: "accepted", plan_type, nfc_status, business_card_link, business_card_qr }`; then continue
  the purchase signed in (the plan step). Errors: 401 `CARD_TOKEN_REQUIRED`, 409 `CARD_EXISTS` (with
  `details.card_id`), 409 `CARD_NOT_CLAIMABLE`. The claim works for any account and makes an app account a
  professional one of the card's type; an existing professional's type is settled as on a signed-in create (section
  9.1, `professional_type`). Website sign-in still refuses app accounts (403 `PROFESSIONAL_REQUIRED`), but since Nov 1
  they never need to sign in to buy: their email counts as new (W-ACC-3).
- **One card per person.** `POST /businessCard/createBusinessCard` (signed in) answers 409 `CARD_EXISTS` while they
  have a card; with `replace=true` in the form, the old card is deleted (kept in the database) and the new one takes
  its public link and QR code. On success it answers 201 with the whole card: its id is `data.id`, and since Nov 1 also
  `data.business_card_id` (the same id, as `POST /businessCard` answers it). Before Nov 1 there was no
  `business_card_id`, so the website reads `data.business_card_id ?? data.id` (W-ACC-1, fixed in both).
- **Delete:** `DELETE /access/cards/:id` (the owner) answers `{ deleted: true, subscription_continues }`. The
  subscription goes on; the person's next card takes over the deleted card's link and QR code (printed codes and the
  keychain keep working), their keychain and their plan.
- Choosing Free for a card whose owner subscribes changes nothing (the subscription is the person's). Since Nov 1,
  choosing Free again for a card that is already live changes nothing and sends no email.
- **`POST /businessCard/select-plan`** `{ business_card_id, plan_type }` answers `{ payment_required, next_step,
  business_card_id, plan_type }`: `free` → `false`, `"dashboard"` (the card is live); `nfc_only` → `true`,
  `"shipping"`, and since Nov 1 the card is already live on Free (Free with the keychain keeps the card live), so keep
  the card token for the address, quote, pay and poll; `subscription_only` → `true`, `"payment"`;
  `nfc_with_subscription` → `true`, `"shipping"` (the last two change nothing until paid). A guest's draft that goes
  live gets its account (made, or an app account converted) and the set-password email. An unknown plan is 400
  `INVALID_PLAN` (Nov 1).

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
  "entitlements": {
    "free": { "photos": 4, "videos": 1, "edit_details": true, "edit_media": false, "analytics": false, "priority_search": false },
    "pro": { "photos": 4, "videos": 1, "edit_details": true, "edit_media": true, "analytics": true, "priority_search": true } },
  "plans": [
    { "code": "nfc_with_subscription", "name": "Pro + keychain", "label": "Pro", "badge": "Most popular",
      "tagline": "Full Pro plan with the NFC keychain included.",
      "features": [{ "text": "Directory listing" }, "… the 7 Free features …",
                   { "text": "Swap your featured video anytime" }, { "text": "Refresh your photos anytime" },
                   { "text": "Profile analytics" },
                   { "text": "NFC keychain — tap to share your profile", "highlight": "keychain" }],
      "includes": { "subscription": true, "keychain": true },
      "lines": [
        { "product": "pro", "name": "Access Pro", "kind": "subscription", "interval": "month",
          "list": 999, "amount": 799, "recurring": 999, "personal": false, "discount": { "name": "Launch", "…": "…" } },
        { "product": "keychain", "name": "NFC keychain", "kind": "one_time", "interval": null,
          "list": 3999, "amount": 3999, "recurring": null, "personal": false, "discount": null }
      ],
      "due_today": 4798, "monthly": 999 }
  ]
}
```

**Since Nov 1:** Access Pro's list price is 999 ($9.99 a month); people who subscribed before keep their price.
`entitlements` gives what Free and Pro may do, the photo and video limits among them (W-ACC-12; `priority_search` is
stored but not built). The features are the new copy (the backend's `docs/access.md` section 2): every feature is
`{ text }` (the keychain line also has `highlight: "keychain"`), nothing is `soon`, and each plan's list holds the one
before it, Free → Access Pro → Pro + keychain (and Free → Keychain). So the first card lists its features and each
later card says "Everything in <previous plan>, plus:" with the ones it adds, found by comparing the texts. Don't
compare Access Pro with Keychain: Pro does not include the keychain.

- `code` is the `plan_type` the purchase calls take. Plans are in display order; an admin can rename them, change
  their features and badge, or switch one off.
- `lines[].amount` is what the first payment charges for that product, `recurring` what later monthly payments
  charge (after a sale's months run out); `list` is the price before any discount, for showing it struck through.
  `personal: true` marks the client's own price, and such a line also carries `override_id` (that price's id;
  nothing needs to read it).
- `due_today` is before shipping (the keychain's shipping is quoted at checkout). `monthly` is the subscription's
  later monthly amount.
- `owned` (signed in): what the person already has; buying Pro again or a second keychain is refused, so grey those
  out (as `SubscriptionPlansTab` does for the keychain today).

### 9.4 Checkout and payment (done Oct 16; following Stripe, Nov 1)

Who may call: the card's owner (access token), or the guest with the draft's card token (`x-card-token`), as for
the purchase calls in section 8. `/pay` and the read check the checkout's own card, and since Nov 1 they tell no one
else what exists: a valid card token for that card is enough; otherwise a stale sign-in answers 401
`SESSION_EXPIRED`, a call with no sign-in and no valid card token 401 `CARD_TOKEN_REQUIRED`, and anyone else 404
"Checkout not found.", whether the checkout exists or not. Amounts in cents.

1. `POST /access/checkout/quote` `{ business_card_id, plan_type, rate_id? }`: what the plan costs this person now.
   Products they already have are left out (a Pro member choosing Pro + keychain pays for the keychain only; someone
   who owns the keychain choosing Pro + keychain pays for Pro alone, with `shipping: null`). With the keychain, the
   card's checked address is needed first (`order/addNewAddress-public` or `businessCard/select-address`), and the
   answer lists the shipping options; send `rate_id` to pick one (the cheapest otherwise). Answers the checkout:

   ```json
   { "checkout_id": 77, "status": "open", "plan_type": "nfc_with_subscription",
     "lines": [{ "product": "pro", "amount": 999, "recurring": 999, "list": 999, "personal": false, "…": "…" },
               { "product": "keychain", "amount": 3999, "…": "…" }],
     "shipping": { "address": { "name": "…", "street1": "…", "city": "…", "state": "NV", "zip": "…", "country": "US" },
                   "options": [{ "rate_id": "…", "amount_cents": 500, "provider": "USPS", "service": "Ground Advantage", "estimated_days": 3 }],
                   "selected": { "rate_id": "…", "amount_cents": 500, "…": "…" } },
     "subtotal_cents": 4998, "shipping_cents": 500, "total_cents": 5498, "monthly_cents": 999,
     "expires_at": "…", "paid_at": null }
   ```

   Since Nov 1 the checkout also carries `client_secret` while its status is `pending` or `failed`, and `card`
   (`{ business_card_id, status, business_card_link }`) once it is `paid`; the poll (step 3) answers the same shape.

   Quoting again (another plan or shipping option) updates the same open checkout, also when two quotes come at once
   (a second tab, a double click). A quote holds for 24 hours. **One payment under way per card** (Nov 1): when the
   card has a checkout waiting at Stripe (`pending` or `processing`), the quote asks Stripe about it first:

   - paid, or being confirmed by the bank: 409 `CHECKOUT_IN_PROGRESS` with `details.checkout_id`: poll that checkout
     (a paid one has just been activated);
   - still payable, for the same plan, the same `rate_id` (if one is sent) and the card's current delivery address:
     that checkout again, `status: "pending"` with its `client_secret` (mount the Payment Element with it; `/pay`
     gives the same secret);
   - still payable, for another plan, rate or address: the old payment is stopped at Stripe, that checkout becomes
     `cancelled`, and a new `open` checkout is quoted.

   Refusals: 400 `INVALID_PLAN`, 400 `PLAN_IS_FREE` (choose Free with `select-plan`), 409 `ACCOUNT_EXISTS` (not for an
   app account's email since Nov 1), 409 `ALREADY_OWNED`, 400 `NFC_ALREADY_PURCHASED`, 409 `CHECKOUT_IN_PROGRESS`, 400
   `AMOUNT_TOO_SMALL` (a keychain-only total of 1 to 49 cents; $0 is fine), 502 `PAYMENT_UNAVAILABLE` (Stripe could
   not be asked); with the keychain also 400 `ADDRESS_NOT_VERIFIED` or 404 `ADDRESS_NOT_FOUND` (no checked address
   yet), 400 `SHIPPING_COUNTRY_UNSUPPORTED`, 502 `SHIPPING_UNAVAILABLE` and 400 `NO_SHIPPING_RATES`.
2. `POST /access/checkout/:id/pay` (no body) answers one of two things:

   - **A payment to make:** `{ checkout_id, client_secret, publishable_key, amount_cents, stripe_customer_id,
     stripe_subscription_id, payment_intent_id }`. Load Stripe.js with that `publishable_key` and confirm:
     `stripe.confirmPayment({ elements, clientSecret })` with the Payment Element, or
     `confirmCardPayment(clientSecret, { payment_method: { card } })`. Paying again while pending returns the same
     secret, once Stripe has said it is not paid yet. From this call the buyer has 24 hours to pay (`expires_at`
     moves).
   - **Nothing to pay** (Nov 1): `{ paid: true, checkout_id }`, with no secret: a $0 first invoice (a 100% sale, a $0
     personal price), a free keychain with free shipping, or a checkout Stripe says was paid meanwhile. The card is
     live before the answer: go straight to done, and poll once for `card`.

   Ways to pay (Mohit, Nov 1): cards, which include Apple Pay and Google Pay, and Link; nothing else. Refusals: 409
   `ALREADY_PAID`, 409 `CHECKOUT_EXPIRED` (quote again), 409 `ACCOUNT_EXISTS`, 409 `CHECKOUT_IN_PROGRESS` (the bank is
   confirming the payment: poll), 502 `PAYMENT_UNAVAILABLE` (Stripe refused or could not be reached: it replaces the
   4xx `PAYMENT_FAILED` with Stripe's own message these calls used to answer).
3. Poll `GET /access/checkout/:id` after Stripe.js confirms. Since Nov 1, while the checkout is `pending` or
   `processing`, the poll asks Stripe first (at most every 3 seconds per checkout) and activates a paid checkout
   itself, so the card goes live even when the webhook is late or lost; with Stripe out of reach it answers the
   stored state. Then:

   - `paid`: done; show `card.business_card_link`;
   - `processing`: the bank is confirming: say so, and poll again or offer "Check again";
   - `failed`: the last attempt was declined: show the Payment Element again with the `client_secret` it carries;
   - `expired` or `cancelled`: quote again.

   Say "your card is live" only on `paid` (W-ACC-5).

A checkout's `status` (Nov 1): `open` (quoted), `pending` (Stripe waits for the buyer: a payment method, 3-D Secure),
`failed` (shown, never stored: the last attempt was declined; still payable), `processing` (the bank is confirming),
`paid`, `expired` (the quote or its payment window ran out, or Stripe gave up), `cancelled` (a newer quote replaced
it, or an admin cancelled its order). Besides the poll, `/pay` and the quote, a sweeper job asks Stripe every 5
minutes about checkouts still waiting 10 minutes after they were made (on a server with scheduled jobs on), and the
webhook moves a keychain's checkout between `pending` and `processing`. A second Pro or keychain paid at the same
time is recorded but not given; support refunds it by hand.

The old calls answer as before on top of this: `shipping-rate[-public]` quotes (`checkout_id` added),
`create-subscription[-public]` pays the card's newest quote for that plan (`clientSecret`, `paymentIntentId`,
`customerId`, `subscriptionId`, `amount`, `publishableKey`, `checkout_id`).

**The subscription:** `GET /access/subscription` → `{ status, pro, past_due, last_payment_failed_at, source,
amount_cents, current_period_end, cancel_at_period_end, canceled_at, started_at }` (null without one). `pro` is true
while the subscription is `active` or `trialing`, or `past_due` for at most 21 days after a renewal first failed (Nov
1). `past_due` (Nov 1): a payment of the subscription failed and is not settled (Stripe's `past_due` or `unpaid`; the
owner is emailed too): say the last payment failed, with a button to the billing portal below; `last_payment_failed_at`
is the latest failure. `POST /access/subscription/cancel` ends it at the end of the paid month (`pro` stays true until
then; since Nov 1 it also cancels a subscription past due beyond the 21 days); `POST /access/subscription/resume` takes
that back. Stripe's refusals on both are 502 `PAYMENT_UNAVAILABLE` (Nov 1). Nothing is ever refunded.
`POST /businessCard/cancel-subscription` now does the same as cancel (it used to end Pro at once).

**The billing portal** (Nov 1): `POST /access/billing-portal` (signed in) `{ return_url? }` answers `{ url }`, a
Stripe billing portal session: send the person there to update their card, pay a failed renewal and see invoices.
`return_url` must be a page of the website (`WEBSITE_URL`'s origin, or another origin the API allows); the default is
`<WEBSITE_URL>/dashboard`. Refusals: 400 `INVALID_INPUT` (`details.field: "return_url"`), 404 `NO_CUSTOMER` (never
paid through Stripe here), 502 `PAYMENT_UNAVAILABLE` (for example, the portal is not set up in that Stripe mode yet).

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
| Photos / videos on the card (defaults) | 4 / 1 | 4 / 1 |
| Analytics: the card's (section 9.7) and the page's (section 10.17) | no: `analytics` (since Nov 1; before, every owner got them: W-ACC-7) | yes |

Special offers were a Pro feature (`special_offers`) until they were retired; since Nov 1 no plan has them and no
card answer carries an offer.

The photo and video counts are admin settings (`entitlements`, changed in the admin panel). Since Nov 1
`GET /access/plans` answers them (`entitlements`, section 9.3), so the form can read its limits instead of
hard-coding 4 and 1 (W-ACC-12). Cards an admin makes may hold up to 20 photos.

Refused edits answer 403 `UPGRADE_REQUIRED` with `details.feature`. Sending the whole form back with the photos
unchanged (as the edit page does) is fine; only real changes count. A draft, a card waiting for review and a
rejected card can always be edited, and an admin can change anything.

### 9.7 Card analytics (as built; written down Oct 30)

**Reporting:** `POST /access-card/analytics/event` (no sign-in) `{ business_card_id, event_type, event_target?,
visitor_id?, session_id?, metadata? }` answers 201 `{ id, business_card_id, event_type, created_at }`. There is no rate
limit and no de-duplication yet. `event_type` is one of these 19:

| Group | Event types |
| --- | --- |
| The card | `ACCESS_CARD_VIEW` |
| Contact and business | `WEBSITE_CLICK`, `BOOKING_CLICK`, `PHONE_CLICK`, `EMAIL_CLICK`, `SHARE_CLICK`, `SAVE_CONTACT_CLICK`, `CONNECT_CLICK` |
| Social | `INSTAGRAM_CLICK`, `TIKTOK_CLICK`, `FACEBOOK_CLICK`, `LINKEDIN_CLICK`, `YOUTUBE_CLICK` |
| Links | `OTHER_LINK_CLICK`, `FEATURED_LINK_CLICK`, `JOURNAL_CLICK` |
| Other | `LOCATION_CLICK`, `IMAGE_CLICK`, `PROMOTION_CLICK` |

**The owner's numbers** (the owner or an admin; `from` and `to` as YYYY-MM-DD, both today when not given). Since Nov 1
they are Access Pro's: an owner on Free gets 403 `UPGRADE_REQUIRED`, `details.feature: "analytics"`, "Profile
analytics are part of Access Pro." (offer the upgrade); a Pro owner (past due within the 21 days included) and an
admin get them:

| Call | Answers |
| --- | --- |
| `GET /access-card/analytics/:businessCardId` | `{ business_card: { id, name, business_name, business_card_link }, date_range: { from, to }, summary: { total_views, unique_visitors, total_clicks }, events, daily_views, daily_clicks, device_breakdown }`. `events` maps all 19 types to a count (0 included); `daily_views` and `daily_clicks` are `[{ date, count }]` without empty days; `device_breakdown` is `[{ device_type, count }]` |
| `GET /access-card/analytics/:businessCardId/events` | `{ count, rows }`, newest first: `id`, `business_card_id`, `event_type`, `event_target`, `visitor_id`, `session_id`, `device_type`, `referrer`, `metadata`, `created_at`. `event_type` filters; `limit` (100 by default, at most 500) and `offset` page |

Other refusals here carry no `code`: 400 with a message (a bad date or `event_type`), 404 "Business card not found.".
Known gap:

- Days are UTC and the `timezone` header is ignored (W-ACC-8). For US owners "today" misses events after about 5 pm
  Pacific; an owner east of UTC gets 400 "To date cannot be in the future." between local and UTC midnight. Until
  that changes, send UTC dates.

Before Nov 1 the `analytics` entitlement was not enforced (W-ACC-7): every owner, Free too, got full numbers, and the
website's lock for Free owners was client-side only.

## 10. The website's requests (Phase 6)

The backend's answers to "Glamlink Backend Requests — Home Page and Pending Work" (Oct 22), with the final shapes.
Each part is logged in the changelog when it lands. Every new list answers `{ count, rows }` (`count`: all matching
rows) for `page` (from 1) and `limit` (default 12, at most 50). Without any list parameter, the existing calls
answer exactly as before. Older lists still answer a plain array: `GET /journal/topic`, `/video-series`,
`/podcast-schedule/list`, `/directory/google/search` and `/businessCard/getAllProfiles` (unpaged: every live card;
its `specialties`, `social_media` and `important_info` arrive as JSON strings, as in `getBusinessCardById`, and are
parsed only by `getBusinessCard/:slug`: W-3).

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

**A miss by id:** `findJournalById`, `GET /journalCategory/:id`, `GET /author/:id` and `GET /ads/findAdById/:id` still
answer 200 with a string in `data` ("No Journal Found", "No Category Found", …), while the newer calls answer 404
`NOT_FOUND` (X-2). Treat a string `data` as not found, as `lib/api/public.ts` already does.

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
mockup's five; a chip opens the site-wide search (section 10.11), which the website uses.

### 10.3 Shop (done Oct 23; sorting, price bands and saved products Nov 3; tags, categories and the button label Nov 4)

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
200 `"No Record Found"`). It carries `owner` and `brand_profile` like every product answer (above).

| For | Call |
| --- | --- |
| The Shop page | `GET /discover/shop?page=1&limit=12&category=<slug>&brand=<slug>&search=<text>` and the filters |
| Shop Products (home) | `GET /discover/shop?featured=true&limit=5` |
| A product page | `GET /discover/shop/findById/<id>` instead of the whole list |

**Sorting, price bands and saved products** (Mohit, Nov 3; built and tested, not deployed). The Shop page sorts and
filters by price, and a visitor saves products in a cookie on their browser (no account); the website sends the saved
ids to list them. `GET /discover/shop` also takes the parameters below. Without them it answers as before.

| Parameter | Meaning |
| --- | --- |
| `sort` | `featured` (featured products first in their featured order, then the admins' order), `newest` (the newest product first), `price_asc` or `price_desc` (products without a price last either way) or `name` (by title). Every order ends with the title, then the id. A sort also wins over the site-wide search's ranking (section 10.11) |
| `min_price` | Dollars, 0 or more, decimals allowed (`49.99`): products priced at least this |
| `max_price` | Dollars, more than 0: products priced below this, so price bands don't overlap: under 50 (`max_price=50`), 50–100 (`min_price=50&max_price=100`: 50 is in it, 100 is not), 100–150, 150 and up (`min_price=150`). With either, products without a price are left out |
| `ids` | The saved products, up to 100 product ids separated by commas (`ids=12,5,9`): only those, if published, in the order of `ids` (send the most recent first) unless `sort` is sent. An id sent twice counts once |

An empty value counts as not sent. Mind `ids=`: it lists every product, so with no saved products don't call the list.
Ids that match nothing published answer `{ "count": 0, "rows": [] }`. `limit` is still at most 50, so 100 saved
products take two pages. A value the list cannot take is 400 `INVALID_SHOP_QUERY` with `details.field`: `sort`
(another value), `min_price` or `max_price` (not a number of dollars, or a `max_price` of 0), `min_price` when it is
not below `max_price`, and `ids` (more than 100, or one that is not a positive whole number).

`GET /discover/shop/filters` adds `price`, the lowest and highest price of the published products that have one, as
numbers; `null` when none has. Offer only the price bands that can match.

```json
{ "categories": [ ... ], "brands": [ ... ], "price": { "min": 29, "max": 180 } }
```

| For | Call |
| --- | --- |
| The Shop page, sorted and by price | `GET /discover/shop?page=1&limit=12&sort=price_asc&min_price=50&max_price=100` (with the filters above) |
| Saved products | `GET /discover/shop?ids=<the saved ids, most recent first>&limit=50` |

**Tags, categories and the button label** (Mohit, Nov 4; built and tested, not deployed). A product carries one tag,
shown top-left on its card and on its page; admins keep the list of tags. Its category comes from a fixed list of 8,
and its button may have its own label. Every product row (the shop's lists, `GET /discover/shop/slug/:slug`,
`findById/:id`, a page's products, `/my/products`, the site-wide search's products) adds:

```json
{ "tag": { "id": 2, "name": "Editor's Pick", "is_editorial": true }, "tag_id": 2, "button_label": "Book a demo",
  "category": "Body & Bath" }
```

- `tag`: `{ id, name, is_editorial }` or null. Show its name top-left.
- `button_label`: null when unset: the button reads `button_label || "Shop now"`.
- `category`: as stored, the label of one of Skincare, Haircare, Makeup, Nails, Body & Bath, Fragrance, Wellness &
  Supplements, Devices & Tools. Values stored before the list (none of today's products has one) stay until edited.

**`GET /discover/shop/tags`** (no sign-in): `[{ id, name, is_editorial, sort_order }]` in the admins' order, then by
name. An editorial tag ("Featured in The Beauty Vault", "Editor's Pick") is set by admins only; an open one ("Pro
Favorite", "New", "Best Seller") by owners too (section 10.14).

`GET /discover/shop/filters` now lists the 8 categories first, in that order with zeros, so the website can show the
whole list, then any other stored category as before: `{ slug, name, count }`. Their slugs are as the list has always
made them: `skincare`, `haircare`, `makeup`, `nails`, `body-and-bath`, `fragrance`, `wellness-and-supplements`,
`devices-and-tools`. `GET /discover/shop?category=` takes a slug or a label (`body-bath` works too), and finds every
stored spelling of the category.

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

### 10.5 Directory applications (done Oct 23; retired Nov 1)

**Retired on Nov 1** (Mohit: one form): `POST /directory/applications` answers 410 `FORM_RETIRED`, "The directory form
is retired. Create your free profile at /access." People join through the Access form, as a professional or a brand,
and claim a Google listing from there (sections 9.1 and 10.13); a profile is listed as soon as its card is live. The
admin screens stay for the applications still pending and for listings admins add. What follows is how it worked.

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

### 10.6 Professional and brand pages (done Oct 23, with their products, articles, videos and issues; the owner's design, sorting and filters Nov 3)

Mohit (Oct 23): every professional or brand with a live Access card has a page, shown while the card is live; admins
can unlist any page and make one for a brand with no login yet (it shows without a card). A brand is a professional
who shows their business name. There is no "industry" yet.

**`GET /profiles`** (no sign-in): one page of pages, by name. `type` (`brand` or `individual`), `featured=true` (the
home rows, in the admins' order), `search` (name, tagline, specialties, city, state), `page`, `limit` (12, at most 50).
Each row: `{ id, slug, type, name, image, tagline, city, state, specialty, is_featured }`: `name` is a brand's
business name or an individual's name, `image` the page's image (else the card's photo), `tagline` the page's (else
the card's title), `city` and `state` the card's main location.

**Brands** (Mohit, Nov 1: brands get their own list, apart from the professionals near a place):
`GET /profiles?type=brand` (with `search`, `page`, `limit`) is the list for Find a Brand, "Browse Brands" and "View
all brands" (the website's `/brands`). `type` is the account's: since Nov 1 the Access form asks Professional or Brand,
and the account takes the card's type (section 9.1). A brand needs no title, so its `tagline` is the page's, else the
card's title when it has one.

**Sorting and filters** (Mohit, Nov 3: the Professionals and Brands pages; built and tested, not deployed).
`GET /profiles` also takes the parameters below. Without them it answers as before: by name, or in the featured order
with `featured=true`.

| Parameter | Meaning |
| --- | --- |
| `sort` | `name` (the default), `recommended` (featured pages first in their order, then the rest by name), `newest` (the newest account first) or `nearest` (needs `lat` and `lng`; pages without coordinates last, by name). Every order ends with the name, then the account's id. `featured=true` keeps its featured order unless `sort` is sent |
| `specialty` | Professionals: the pages whose category (a professional's specialty, section 10.6.1), primary specialty or any of their specialties is this one, trimmed and in any case (the whole name, not a part); at most 100 characters |
| `category`, `shipping` | Brands: a category key (`skincare`, …, section 10.6.1) or a shipping key (`local`, `nationwide`, `international`), in any case |
| `state` | A U.S. state by its code or its name, in any case: `NV`, `nv` and `Nevada` each find the pages in Nevada however the page writes it. Another place (`Ontario`) is matched as typed, in any case |
| `city` | The city, trimmed and in any case |
| `lat`, `lng` | The visitor's point, both or neither. Each row then has `distance_miles`: the miles to the page's main location, 1 decimal; null for a page without coordinates |
| `radius` | Miles from `lat` and `lng`, more than 0 and at most 500: pages farther away, and pages without coordinates, are left out. Without it, no limit |

Rows add `category` (a brand's key, or a professional's specialty as they typed it), `category_label` ("Skincare
Brand", or the specialty) and `shipping` (its key), each null when unset; show `category_label`, else `specialty`. A
value the list cannot take is 400 `INVALID_PROFILE_QUERY` with `details.field`: `sort` (another order, or `nearest`
without `lat` and `lng`: "Sort by nearest needs lat and lng."), `specialty`, `category`, `shipping`, `lat` or `lng`
(not a coordinate, or one without the other) and `radius` (out of range, or without `lat` and `lng`). The options and
their counts come from `GET /directory/filters` (section 10.13). The site-wide search (section 10.11) takes none of
these; its rows add the three fields too.

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
answers 404 `NOT_FOUND`. `products` holds the first 8 products (4 before Nov 3) the account put up or makes (rows as the
shop lists them); **`GET /profiles/:slug/products`** pages them all (`page`, `limit`). `journal` holds the first 3 articles that
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

#### 10.6.1 The page in the owner's design (Nov 3; built and tested, not deployed)

Mohit (Nov 3): one layout for brands and professionals, no tabs; each section shows a few items and "View all". The
page's basic details still come from the page, then the card, the listing and the account. No reviews, verified badge
or Follow.

**`GET /profiles/:slug`** keeps every field above and adds:

```json
{ "intro": "High-performance skincare powered by biotechnology…", "category": "skincare", "category_label": "Skincare Brand",
  "shipping": "nationwide", "shipping_label": "Ships nationwide", "about_image": "https://api.glamlink.net/images/…",
  "quick_info": { "has_education": true, "on_podcast": true, "in_journal": false },
  "media": { "count": 12, "rows": [ProfileMedia] }, "education": { "count": 4, "rows": [EducationCard] },
  "podcast": { "count": 2, "rows": [VideoCard] } }
```

- `intro`: the page's (300 characters of plain text), else the live card's bio as plain text, at most 300 characters
  (cut at a word, ending "…"); null without either.
- `category`: a brand's is one of these keys, shown as `category_label` "<label> Brand": `skincare` Skincare,
  `haircare` Haircare, `makeup` Makeup, `nails` Nails, `body` Body & Bath, `fragrance` Fragrance, `wellness` Wellness &
  Supplements, `devices` Devices & Tools. A professional's is a specialty's name as they pick it (the specialties list,
  60 characters at most); its label is the name. Both null when unset.
- `shipping`: `local`, `nationwide` or `international`; `shipping_label` "Local pickup or delivery", "Ships nationwide",
  "Ships internationally". Both null when unset.
- `cover_image` now falls back to the live card gallery's cover photo (the one marked `is_thumbnail`).
- `about_image`: the page's, else the first photo of the page's own media that shows, else the card's cover photo;
  null when none.
- `quick_info`: the automatic lines: `has_education` (a published education item), `on_podcast` (a Beauty Vault
  episode), `in_journal` (an article that features the account).
- `media`: the first 5 items of Media & Images; `education`: the first 3 published items; `podcast`: the newest Beauty
  Vault episode the account appears in (the `beauty-vault-podcast` series; rows are the video cards of section 10.9).
  `products` now holds the first 8 (the carousel). `journal`, `videos` and `magazine` are as before.

```ts
ProfileMedia = { id; kind: "image" | "video"; source: "upload" | "youtube" | "vimeo" | "card"; url; thumbnail;
                 embed_url; caption; alt; width; height }
EducationCard = { id; slug; kind: "video" | "article"; title; summary; cover_image;
                  video: { source: "upload" | "youtube" | "vimeo"; url; embed_url; thumbnail; duration_seconds } | null;
                  published_at }
EducationDetail = EducationCard & { body; page: { slug; name; type; image } }
```

- **Media & Images:** an image's `url` is the photo (`thumbnail` null); an uploaded video's `url` is the MP4 and
  `thumbnail` its poster; a YouTube or Vimeo video's `url` is its watch link, `embed_url` the player
  (`https://www.youtube.com/embed/<id>`, `https://player.vimeo.com/video/<id>`, with `?h=<hash>` for an unlisted Vimeo
  video) and `thumbnail` YouTube's `https://i.ytimg.com/vi/<id>/hqdefault.jpg` or Vimeo's (from `i.vimeocdn.com`, null
  when Vimeo did not give one). `width` and `height` are an uploaded photo's, else null. **Until the page has an item of
  its own that shows, it shows its live card's gallery** with `source: "card"` (the card item's `id`, videos first, as
  the card shows them; no `alt`, sizes or player). Allow frames from `www.youtube.com` and `player.vimeo.com`, and
  images from `i.ytimg.com` and `i.vimeocdn.com` (`next/image` `remotePatterns`).
- **Education:** an article's `cover_image` is its own; a video's falls back to its thumbnail. `body` is the article's
  HTML, cleaned by the API on every save (below); render it through DOMPurify too. `published_at` is when the item was
  first published.

**Lists and the item page** (no sign-in; a hidden or unknown page is 404 `NOT_FOUND`):

| Method and path | Answers |
| --- | --- |
| `GET /profiles/:slug/media?kind=image\|video&page=&limit=` | `{ count, rows: ProfileMedia[] }` in the owner's order (the card's gallery as above while the page has none); `limit` 24, at most 60 |
| `GET /profiles/:slug/education?kind=video\|article&page=&limit=` | `{ count, rows: EducationCard[] }`, published items in the owner's order; `limit` 12, at most 50 |
| `GET /profiles/:slug/education/:itemSlug` | `EducationDetail`; 404 `NOT_FOUND` for a draft or an unknown slug |
| `GET /profiles/:slug/videos?series=beauty-vault-podcast` | The videos list filtered by series (any series' slug; an unknown one answers `{ count: 0, rows: [] }`); without `series`, every video as before |

An unknown `kind` lists every kind. `POST /profiles/:slug/events` also takes `SHARE_CLICK`, `MEDIA_CLICK`,
`EDUCATION_CLICK`, `PODCAST_CLICK` and `JOURNAL_CLICK` (section 10.17).

**The owner's page** (`GET`/`PUT /my/profile`): `page` adds `intro`, `category`, `shipping` and `about_image` (null when
unset), and `PUT` takes them: `intro` (300 characters), `category` (a brand: a key from the list; a professional: the
specialty's name, 60 characters), `shipping`, and the About image as the file `about_image` or a link to an image
uploaded here; `""` clears each. A brand's other category, a wrong shipping value and a link elsewhere are 400
`INVALID_PAGE` with `details.field`. `public` in this answer carries the page's fields with their fallbacks, not its
lists (`media`, `education`, `podcast` are empty and `quick_info` false there).

**Media & Images, the owner's** (a signed-in professional or brand, every plan, no limit; items show at once):

| Method and path | Takes | Answers |
| --- | --- | --- |
| `GET /my/profile/media` | `page`, `limit` (24, at most 100) | `{ count, rows: OwnerMedia[] }`, hidden items too, in order; `count` is every item |
| `POST /my/profile/media` | A form: `images` (photos, up to 20 a request) and/or `videos` (MP4s, up to 10) with `video_thumbnails` (one poster per video in the same order, or none), and optional `captions` (a JSON list, photos then videos); or JSON `{ url, caption?, alt? }` with a YouTube or Vimeo link | 201 `{ rows: OwnerMedia[] }`, the items added |
| `POST /my/profile/media/import-card` | | `{ rows: OwnerMedia[] }`: the live card's gallery items not on the page yet, added last (`[]` when none) |
| `PUT /my/profile/media/order` | `{ ids }`: every item once (hidden too), in the new order | `{ ok: true }` |
| `PUT /my/profile/media/:id` | `caption`, `alt` (255 characters; `""` clears) | The item |
| `DELETE /my/profile/media/:id` | | `{ deleted: true }` |

`OwnerMedia` is `ProfileMedia` plus `is_hidden` (an admin hid it), `sort_order`, `created_at` and `from_card` (copied
from the card). New items go first, in the order sent. **The page's first add copies the card's gallery in first**
(once), so the card's photos stay on the page after it; deleting a copy never deletes the card's file. Deleting an
upload deletes its file unless something else still shows it (the About image, say). Files: photos JPEG, PNG, WebP,
AVIF or GIF; videos MP4 only; each file up to the API's upload limit (50 MB unless the server sets `UPLOAD_MAX_MB`).
Refusals (400 `INVALID_PAGE`, `details.field`): `images` (nothing to add, a file that is not a photo), `videos` (not an
MP4), `video_thumbnails` (not one per video, or not a photo), `captions`, `url` (not a YouTube or Vimeo link, or a link
with files), `ids` (not every item once), and any other file field sent (`details.field` names it). 404 `NOT_FOUND`
for another page's item.

**Education, the owner's:**

| Method and path | Takes | Answers |
| --- | --- | --- |
| `GET /my/profile/education` | `page`, `limit` (12, at most 100) | `{ count, rows: OwnerEducation[] }`, drafts too, in order, without `body` |
| `GET /my/profile/education/:id` | | `OwnerEducation` with `body` |
| `POST /my/profile/education` | JSON or a form: `kind` (`video` or `article`), `title` (150 characters), `summary` (300), `status` (`published`, the default, or `draft`), `body` (HTML), `video_url` (YouTube or Vimeo) or the files `videos` (one MP4) and `video_thumbnails` (its poster), the cover as the file `images` (one) or `cover_image` (a link to an image uploaded here), `duration_seconds` (optional) | 201, `OwnerEducation` with `body` |
| `PUT /my/profile/education/:id` | The same fields, each optional; `""` clears `summary` and `cover_image` | `OwnerEducation` with `body` |
| `PUT /my/profile/education/order` | `{ ids }`: every item once (drafts too) | `{ ok: true }` |
| `DELETE /my/profile/education/:id` | | `{ deleted: true }` |
| `POST /my/profile/uploads` | One image as the file `images` (for the article's text) | 201 `{ location }`, the image's link |

`OwnerEducation` is `EducationCard` plus `status`, `sort_order`, `created_at`, `updated_at` (and `body` where said). New
items go first. The slug comes from the title, unique on the page (`how-to-layer`, then `how-to-layer-2`), and changes
only when the title does. A video needs a link or a file (not both); an article needs text to be published (a draft may
be empty). An edit that sends no video fields keeps the video. A video item may become an article (its video goes,
uploaded files deleted) and an article a video (send the video; the text stays). A form that sends back the
`cover_image` it was shown (a video's thumbnail included) changes nothing. Deleting an item deletes its own files
unless something else still shows them. The article HTML keeps `h2`, `h3`, `p`, `br`, `strong`, `em`, `ul`, `ol`,
`li`, `blockquote`, links over http or https (given `rel="noopener noreferrer"`, `target` only `_blank`) and `img`
whose `src` is an image uploaded here (`POST /my/profile/uploads`); `h1` becomes `h2`, `h4`–`h6` `h3`, `b` `strong`,
`i` `em`; everything else goes (scripts, styles, attributes, iframes, images from elsewhere). Refusals (400
`INVALID_PAGE`, `details.field`): `kind`, `title`, `summary`, `status`, `body` (publishing an empty article, or longer
than 100,000 characters of HTML), `video_url` (no video, both, or not a YouTube or Vimeo link), `videos` (not an MP4),
`video_thumbnails`, `cover_image`, `images`, `duration_seconds`. 404 `NOT_FOUND` for another page's item.

Every write here sends the `profiles` refresh tag (section 10.18).

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
(`GET /journal/topic/:id`) adds its `videos` (the topic page does not show them yet: W-6). The server's key is set
and imports ran (34 Beauty Vault episodes on Oct 30), so the website can drop `NEXT_PUBLIC_YOUTUBE_API_KEY` and its
browser fallback in `PodcastPage.tsx` (W-9; the audit item "YouTube key in the browser"). `GET /videos` takes at most
`limit=50`: page the podcast list before episode 51 (W-8).

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
answers every ad as before (the admin list). The website reads every live ad once and picks by page, slot and time
itself (W-12): that works; `page=` would only trim the answer.

**`POST /ads/track`** `{ ad_id, type }` (`type`: `impression` or `click`): the payload the ad slots send today, now to
the API (`${API}/ads/track`, not the website's own `/api/ads/track`). Answers `{ counted: true }`; 400
`INVALID_AD_EVENT` (`details.field`) for an unknown ad or type. Counts are kept per ad and day for admins; one address
may send 300 a minute.

### 10.13 The directory (done Oct 23; the map and the filters Nov 3)

Mohit (Oct 23): /directory shows our own profiles on top, then about 20 Google listings near the visitor (with the
filters, by Google's relevance). A Google listing has "Claim this profile", which opens the apply form prefilled from
Google; a "Don't see your profile? Get yours" banner opens the form with "Find my business on Google". Since Nov 1
both open the Access form instead (`/access?claim=<place id>` and `/access`), and brands have their own list on the
website (`/brands`, from `GET /profiles?type=brand`, section 10.6), so the nearby search asks for professionals.

**Our profiles: `GET /directory/search`.** Live Access cards and the applications admins approved, one page:

| Parameter | Meaning |
| --- | --- |
| `lat` and `lng`, or `location` | The visitor's point, or a place typed ("Las Vegas, NV", a ZIP; the API geocodes it). Nearest first, within `radius` miles (25 by default, at most 100) |
| `q` | Name, title or specialty |
| `specialty`, `city`, `state` | One specialty; a city; a state (as written on the card, e.g. `NV`) |
| `type` | Nov 1: `individual` (professionals) or `brand`; both without it. The account's type; an approved application with no account counts as `individual`. Anything else is 400 `INVALID_DIRECTORY_QUERY` (`details.field: "type"`). The website's nearby search sends `type=individual` |
| `page`, `limit` | 12 by default, at most 50 |

Each row: `{ kind, id, slug, name, image, tagline, city, state, specialty, type, distance_miles }` (`type` since Nov 1). `kind: "profile"` links to
the page (`/profiles/<slug>`); since approved applicants have accounts and pages (section 10.14) nearly every row is
one. `kind: "listing"` is an approved application with no account, shown by **`GET /directory/listings/:id`**:
its name, title, specialties, bio, photos, website, booking link, social links, locations (an exact address only for
exact-address locations, with the business phone given for it), hours and offer; not the applicant's own email or
phone. The website has no page for these yet and leaves such rows unlinked (rare now that approval makes accounts).
Without a place, rows come by name.

**The directory, Professionals and Brands pages** (Mohit, Nov 3; built and tested, not deployed). The directory's hero
is a map of Las Vegas with our professionals' pins; under it come our professionals, 15 Google listings near Las Vegas
with no search needed (`GET /directory/google?lat=36.1699&lng=-115.1398&limit=15`, as it is: `limit` is 20 at most,
and the API's six-hour cache keeps Google to a few calls a day) and a few brands, each with "Explore all": the
Professionals and Brands pages, `GET /profiles` with the sorting and filters of section 10.6.

**`GET /directory/filters?type=individual|brand`** (no sign-in): what those pages filter by, each option with as many
pages as `GET /profiles` finds for it. `type` is `individual` without it; another type is 400
`INVALID_DIRECTORY_QUERY` (`details.field: "type"`).

```json
{ "type": "individual", "count": 22,
  "specialties": [{ "name": "Esthetician", "count": 5 }],
  "states": [{ "code": "NV", "name": "Nevada", "count": 12, "cities": [{ "name": "Las Vegas", "count": 10 }] }] }

{ "type": "brand", "count": 9,
  "categories": [{ "key": "skincare", "label": "Skincare", "count": 3 }],
  "shipping": [{ "key": "nationwide", "label": "Ships nationwide", "count": 2 }] }
```

- `count`: the visible pages of the type, as `GET /profiles?type=…` counts them.
- `specialties`: each page's category, primary specialty and specialties, trimmed (empty ones, and ones over 100
  characters, left out), grouped as the `specialty` filter compares them (case and accents aside); a page counts once in
  each. `name` is the spelling most pages use (on a tie, the first by name, capitals first: "Las Vegas" before "las
  vegas"); filter with `specialty=<name>`. By count, then name.
- `states`: a U.S. state by its `code` and `name`, however its pages write it; another place by its text as written,
  `code` null (grouped like the specialties). Pages without a state are left out. `cities` are grouped the same way
  within their state; a page without a city counts in its state only. By count, then name. Filter with
  `state=<code, else name>&city=<name>`.
- Brands: `categories` and `shipping` list every option of section 10.6.1, in that order, zeros included; filter with
  `category=<key>` and `shipping=<key>`.

**`GET /directory/map`** (no sign-in): the hero map's pins, the visible professional pages (`type` individual) whose
main location has coordinates. Never a listing without an account, so every pin links to `/profiles/<slug>`. Featured
pages come first in their order, then by name.

```json
{ "count": 12, "rows": [{ "id": 7, "slug": "kate-sue", "name": "Kate Sue", "image": "https://…", "specialty": "Esthetician",
  "city": "Las Vegas", "state": "NV", "latitude": 36.117, "longitude": -115.172 }] }
```

- `north`, `south`, `east` and `west` (degrees), all four or none: only the pins inside that box. Each must be a number
  in range, with `south` below `north` and `west` below `east` (a box cannot cross the date line); else 400
  `INVALID_DIRECTORY_QUERY` with `details.field`: the first side missing (in that order), the side out of range, or
  `south` or `west` when it is not below the other.
- `limit`: 100 by default, at most 200. `count` is every pin in the box, not only the rows answered.
- `latitude` and `longitude` are rounded to 3 decimals (about 100 m: an exact address is public on the card already,
  and a city's point is the city's own). `specialty` is the page's category, else its primary specialty; `state` is a
  U.S. state's two-letter code, else as stored.

**Google's listings: `GET /directory/google`** with `lat` and `lng` (or `location`), `type` (`esthetician`, `med-spa`,
`hair-stylist`) and `q` (words): `{ count, rows }`, up to 20 rows of `{ place_id, name, address, city, state, rating,
review_count, photo_url, maps_url, website, type, distance_miles }`, by Google's relevance. Listings already claimed
(an approved application's `place_id`, or since Nov 1 a card's claim an admin verified) and closed businesses are
left out. `photo_url` is the API's own link (`/directory/google/photo?...`, a redirect to Google's image), so no key
reaches the browser.

**Claiming and starting from Google** (through the Access form since Nov 1):

1. `GET /directory/google/search?q=<business name, city>`: a plain array of up to 5 `{ place_id, name, address, city,
   state, claimed }`. It served the retired form's "Find my business on Google"; the Access form does not use it.
2. `GET /directory/google/places/:placeId`: `{ place_id, claimed, form, name, address, rating, review_count, maps_url,
   photos }`, where `form` holds the fields Google knows: `place_id`, `phone`, `website`, `bio`, `locations` (one exact
   address, primary) and `business_hours` (`[{ note: "Monday: 9:00 AM – 5:00 PM" }]`). Google does not know the
   person's name, title or email: the form asks for them. The Access form fills its empty fields from this (the card's
   bio is at most 80 characters of text).
3. Create the card with `claimed_place_id` (section 9.1; on a create only). The claim is never public. An admin
   verifies it (`GET /directory/claims`, `PUT /directory/claims/:cardId`; the admin panel's Listing Claims); only then
   does the listing leave Google's list, and `claimed` turns true. A rejected claim is cleared from the card. Before
   Nov 1 this step was `POST /directory/applications` with `place_id`, and approving the application took the listing
   out.

Google calls cost money: the API keeps answers six hours and allows 30 Google searches a minute per address (300
photos). Without the server's Google key these answer 503 `GOOGLE_NOT_CONFIGURED`. The mock provider is gone from
/directory. The old page `/journal/directory` still calls the legacy Google endpoints
(`GET /user/nearby/map/professional/list`, then `GET /user/google-locations/details/:placeId` once per place: up to
about 60 paid calls per visit, uncached): remove it or redirect it to /directory, and the backend then retires those
two endpoints (W-2).

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
`remove_photos` (a JSON list of photo links) takes some out. No listing: 404 `NO_LISTING`. The website's dashboard has
no "Directory listing" section yet, so listing owners cannot do this today (W-5). Pages made from a listing also send
`listing` (locations, hours, photos), which the profile page does not show yet (W-4).

**The owner's products** (shown at once; admins can still edit, unpublish or delete them):

| Method | Path | Body | Answers |
| --- | --- | --- | --- |
| GET | `/my/products` | `page`, `limit` | `{ count, rows }`: their products, drafts too, newest first |
| POST | `/my/products` | `title` (required), `short_description`, `description`, `category`, `brand` (text), `price` (dollars, `12.50`), `link` (a web link), `status` (`published` by default, or `draft`); the cover as `images` (one file). Nov 4: `tag_id`, `button_label` (below) | 201, the product (with `owner`, `brand_profile`, `status`; Nov 4 `tag`, `button_label`) |
| PUT | `/my/products/:id` | the same fields (`cover_image: ""` removes the cover) | The product |
| DELETE | `/my/products/:id` | | `{ deleted: true }` |

A brand's products are its own make (`brand_id` is the brand). Refusals: 400 `INVALID_PRODUCT` with `details.field`;
another account's product answers 404.

Since Nov 4 (Mohit; built and tested, not deployed): `category` is one of the 8 of section 10.3, sent as its label in any
case or its slug (`body-and-bath`, or `body-bath`); the label is stored and `""` clears it; anything else is 400
`INVALID_PRODUCT` (`details.field: "category"`). `button_label` is the button's own label, trimmed, at most 30
characters (else 400); `""` clears it. `tag_id` is an open tag of `GET /discover/shop/tags`, or `""` to clear it. An
editorial tag is Glamlink's to give: sending one is 403 `TAG_ADMIN_ONLY` (`details.field: "tag_id"`), and while the
product carries one (an admin set it), sending another `tag_id` or `""` is the same 403. Sending the same id, or no
`tag_id`, is fine, and other edits keep the tag: show the editorial tag in the form, locked.

### 10.15 Calls by slug (done Oct 23)

Every page the website links to can be found by its slug, and the calls by id keep answering, so old links keep
working:

| Page | By slug | By id (as before) |
| --- | --- | --- |
| Article | **`GET /journal/slug/:slug`** (new): the same answer as by id; 404 `NOT_FOUND` when there is none (drafts for admins only) | `GET /journal/findJournalById/:id` |
| Topic | `GET /journal/topic/:slug`: the same call takes a slug or an id. Its sub-route `GET /journal/topic/:id/paragraphs` takes the numeric id only (a slug answers 404) | `GET /journal/topic/:id` |
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
card, its listing or its account. The slugs are the ones the calls in section 10.15 take. Videos carry no series, so
to place podcast episodes under /podcast the website pages `GET /videos?series=beauty-vault-podcast` (adding the
series to the feed would remove that call: ask if it helps).

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
| `SHARE_CLICK` (Nov 3) | Sharing the page | How it was shared (`native`, `copy`), if wanted |
| `MEDIA_CLICK` (Nov 3) | An item of Media & Images | The item's `id` |
| `EDUCATION_CLICK` (Nov 3) | An education item | Its `slug` |
| `PODCAST_CLICK` (Nov 3) | The Beauty Vault episode | The video's `slug` |
| `JOURNAL_CLICK` (Nov 3) | An article in "In the Glamlink Journal" | The article's `id` or slug |

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
`to`. Since Nov 1 the numbers are Access Pro's, as the card's are (section 9.7): an owner on Free gets 403
`UPGRADE_REQUIRED`, `details.feature: "analytics"`. Counting (`POST /profiles/:slug/events`) is unchanged for every
page.

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
keep an expiry on cached pages too (an hour, say). The secret is one value under two names: `WEBSITE_REFRESH_SECRET`
on the API, `REVALIDATE_SECRET` on the website.

| Tag | What changed |
| --- | --- |
| `journal` | Articles, their categories, authors and FAQs, who they feature |
| `topics` | Topics and what they link |
| `shop` | Products (their owners' changes too) |
| `discover` | Education and events |
| `profiles` | Professional and brand pages: the page, its card, its directory listing; since Nov 3 its media and education (the owner's and admins' writes) |
| `cards` | Access cards (a paid card going live too). Since Nov 1 also a claimed draft going live, an owner's deleted card and a Free card going live (`select-plan`), each with `profiles`. Not yet sent for an admin's subscription change (W-10) |
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

