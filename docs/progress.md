# Progress

Newest first. Each phase lists its commits; branches chain from `main` (old code) to the current one. `master` holds
every phase below and is the code deployed on api.glamlink.net (the Nov 1–4 work since Nov 4). glamlink.net moves to
the new site and this API at the switch of Nov 5.

## The switch to live (Nov 5, on `master`)

Mohit's decisions of Nov 5: glamlink.net goes live on the new site; the database stays (`glamlinkdb`, the Oct 23 copy,
where all the work since was done); test.glamlink.net stays, with an API of its own later. The steps: deploy.md
section 8.

- `stripe:setup` reused the Stripe ids the database had saved, whatever the keys: with live keys it would have printed
  the test products, and every checkout would have failed ("No such price"). `forgetForeignIds` (`stripeCatalog.js`)
  forgets the products', prices' and coupons' ids this account doesn't have, and a list price archived in the
  dashboard, before they are adopted or made; `stripe:setup` runs it first and names the account (`accountName` in
  `integrations/stripe.js`). Customers were already checked at checkout (`customerExists`) and in the billing portal.
- `check:server -- --online` names the Stripe account and mode, and fails when a saved Access product or price is not
  in that account. It also warns about cards whose link names another website.
- `npm run cards:relink` (`scripts/card-links.js`, `relinkCards` in `cardWriter.js`): the cards made on the test site
  link to test.glamlink.net, and so do their QR codes. It lists them; `--apply` moves them to `WEBSITE_URL` and draws
  their QR codes again.
- Checks: 385 of 385 tests pass on a throwaway MariaDB (382 before; three new in `stripeCatalog.test.js` and
  `cardSlugs.test.js`); oxlint and the boundary check pass.

## Product tags, categories and the button label (Nov 4, on `master`; deployed Nov 4)

Mohit's decisions of Nov 4: one tag per product, top-left on its card and page, from a list admins keep (an editorial
tag is theirs to set; an open one owners set too); a category from a fixed list of 8; a button label of the product's
own ("Shop now" without one). The website and the admin panel build against the same contract (their handoffs, Nov 4
rows).

- Migration `20261104-0100`: the `product_tags` table, seeded with five tags; the products' `tag_id` (emptied when its
  tag is deleted) and `button_label`. Model `website/content/models/productTag.model.js`.
- `productTags.service.js`: `GET /discover/shop/tags` and the admins' add, edit, order and delete; the owners' rules
  (403 `TAG_ADMIN_ONLY`). `productForm.js`: the 8 categories (the label stored; slugs `body-and-bath` and
  `body-bath` both read) and the button label, for the admin and owner product writes.
- Every product row adds `tag` and `button_label` (`withLinks`); the shop's filters list the 8 categories first.
- Card creation's speed (the website saw about 1 s before the first byte, `/api/healthcheck` too): nothing in
  `POST /businessCard` re-encodes, hashes or reads a whole file (multer streams each file to disk), and the request
  waits only on the database; e-mail, the QR code, geocoding and the website's refresh run after the answer. Locally a
  card with four 4 MB photos takes about 23 ms and the health check 0.3 ms, so the second is spent before the request
  reaches the app (DNS, TLS, nginx, the network). Nothing changed for it.
- Checks: 382 of 382 tests pass on a throwaway MariaDB (374 before; new `test/productTags.test.js`); `npm run lint`
  passes. **For Mohit to do:** `npm run migrate` with the next deploy.

## Profile pages in the owner's design (Nov 3, on `master`; deployed Nov 4)

Mohit's decisions of Nov 3: one page layout for brands and professionals (the Epicutis mockup without reviews, the
verified badge and Follow); Media & Images unlimited on every plan, showing the card's gallery until the owner adds
their own; Education (videos and articles) on the profile; Quick Info from a category, shipping and automatic lines;
everything an owner edits, admins edit too. The website builds against the same contract (its handoff, section 10.6.1).

| Item | Status |
| --- | --- |
| Data | Done: migrations `20261103-1300` (`profile_pages.intro`, `category`, `shipping`, `about_image`, `media_started_at`), `-1400` (`profile_media`) and `-1500` (`profile_education`); models in `website/profiles/models` |
| The public page | Done: `GET /profiles/:slug` adds the intro (else the card bio as text), category and shipping with labels, the About image and cover fallbacks, `quick_info`, and the first rows of media (5), education (3) and the Beauty Vault (1); products 8. New `GET /profiles/:slug/media` (the card's gallery until the page has its own), `/education`, `/education/:itemSlug`, and `?series=` on `/videos` (`watch/video.service.js`) |
| Owners and admins | Done: `/my/profile` and `PUT /profiles/admin/:userId` take the new fields (a brand's category from a list of 8, a professional's specialty; the About image as the new multer field `about_image`, `core/http/uploads.js`); media and education under `/my/profile/...` and `/profiles/admin/:userId/...` (one service each, `profileMedia.service.js` and `profileEducation.service.js`); the first media add copies the card's gallery in; deletes remove only files nothing else shows (never a card's); YouTube and Vimeo links (Vimeo's thumbnail from its oEmbed, `integrations/vimeo.js`); article HTML cleaned with its own allow-list (`articleHtml.js`); `POST .../uploads` for images in the text; page events `SHARE_CLICK`, `MEDIA_CLICK`, `EDUCATION_CLICK`, `PODCAST_CLICK`, `JOURNAL_CLICK` |
| Checks | 342 of 342 tests pass on a throwaway MariaDB (311 before; new `test/profileMedia.test.js`, `test/profileEducation.test.js`, more in `test/profiles.test.js`, `test/pageAnalytics.test.js`, `test/websiteRefresh.test.js`); `npm run lint` passes |

**For Mohit to do:** `npm run migrate` with the next deploy, before the website that reads the new fields. **Open:** no
size cap per page on media (the per-file upload cap, 50 MB, applies); no site-wide Education hub yet. The admin panel's
screens for these were built on Nov 3 too (admin `progress.md`, pass 12).

**Later on Nov 3: the Directory, Professionals and Brands pages** (the website builds against the same contract; its
handoff, sections 10.6 and 10.13). `GET /profiles` takes `sort` (`recommended`, `newest`, `nearest`), `specialty` (the
page's category, its primary specialty or an entry of its specialties, read with `JSON_TABLE`), `category`, `shipping`,
`state` (a U.S. state by its code or name: `core/utils/usStates.js`), `city`, `lat` and `lng`, and `radius`; its rows
add `category`, `category_label` and `shipping` (and `distance_miles` from a point). The new options of `pageList` are
off unless given, so the admin list and the site-wide search answer as before. New `GET /directory/filters` (options
grouped by MariaDB's own sort key, `WEIGHT_STRING`, so each count is what the list finds) and `GET /directory/map` (the
hero map's pins, to 3 decimals). No migration. 360 of 360 tests pass on a throwaway MariaDB (342 before; new
`test/directoryPages.test.js`); `npm run lint` passes.

**Then the Shop's sorting, price bands and saved products** (the website handoff, section 10.3): `GET /discover/shop`
takes `sort`, `min_price` and `max_price` (bands that don't overlap) and `ids` (a visitor's saved products, in their
order), and `GET /discover/shop/filters` adds `price: { min, max }`; no migration. 371 of 371 tests pass (new
`test/shopSorting.test.js`); `npm run lint` passes.

## Access fixes, one form, brands and Stripe (Nov 1–2, on `master`; deployed Nov 4)

Mohit's decisions of Nov 1 (access.md, section 12): build the Oct 23 plan decisions now (Access Pro $9.99, Free with
the keychain keeps the card live, profile analytics for Pro, special offers retired, plan cards that list only what
they add); fix Stripe and its flow "once and for good"; no automatic refunds, admins cancel orders; app accounts don't
block a website purchase; cards, wallets and Link; locations optional; one form (Professional or Brand) with the
directory form retired; listed as soon as live; brands on their own list; Google listing claims through the Access
form, verified by an admin. The website and the admin panel changed with it (web `docs/audit.md`, admin
`progress.md`) and rely on the new answers, so the API deploys first.

| Item | Status |
| --- | --- |
| Professional or brand | Done: migration `20261101-0100` (`business_cards.professional_type`; cards of brand accounts become `brand`, professional accounts with no type `individual`); `cardFields.js` reads the type (another is 400 `INVALID_CARD`) and makes a brand's title, specialties and booking method optional; the account takes the card's type when it is made or converted, and an existing professional's is settled with the card's (`settleCardType` in `cardOwnership.js`); the signed-in create answers `business_card_id` and the type it settled. Tests: `test/cardFields.test.js`, `test/accessStripeFlow.test.js` |
| Optional locations | Done: `cardFields.js` (0 to 10; `[]` clears them). Migration `20261101-0300` clears the Las Vegas centre the website's "Confirm" saved for typed exact addresses, so `npm run directory:geocode` places them. Tests: `test/cardFields.test.js`, `test/directory.test.js` |
| One form, brands, claims | Done: `POST /directory/applications` answers 410 `FORM_RETIRED` (the admin endpoints stay); `GET /directory/search?type=individual\|brand`, its rows with `type`; migration `20261101-0200` (`claimed_place_id`, `claim_verified_at`), the place id read on a create only and never public (`cardPublic.js`); admin `GET /directory/claims` and `PUT /directory/claims/:cardId` (verify or reject; 409 `PLACE_ALREADY_CLAIMED`); a verified claim hides the Google listing as an approved application does. Tests: `test/directory.test.js`, `test/directoryApplications.test.js` (which now adds applications through the admin endpoint) |
| Plans and prices | Done: migration `20261101-1100` (Access Pro 499 → 999 cents, recorded; subscribers keep their price) and `20261101-1200` (the copy: Free's 7 lines, Pro = Free + 3, Pro + keychain = Pro + the keychain line; "Priority placement in search" removed; `special_offers` out of the entitlements); `GET /access/plans` answers `entitlements`; a product's earlier Stripe list prices are archived once its new one exists (`stripeCatalog.js`). Tests: `test/catalog.test.js` |
| Special offers retired | Done: not read on input (`cardFields.js`), left out of every card answer (`withoutOffers` in `entitlements.js`), no longer an entitlement or an admin right. The stored columns stay |
| Analytics for Pro | Done: `requireAnalyticsPlan` (`entitlements.js`) on the card analytics (`accessCardAnalytics.route.js`) and `GET /my/profile/analytics` (`profiles/myProfile.route.js`): 403 `UPGRADE_REQUIRED` `analytics` for an owner on Free; admins pass. Tests: `test/entitlements.test.js`, `test/pageAnalytics.test.js` |
| App accounts | Done: an app account's email counts as new (`websiteAccountFor` in `cardOwnership.js`); going live, by Free, a payment or a claim, converts it to a professional account of the card's type, with the set-password email (`accessCardOwner` in `shared/identity/account.service.js`). No account was deleted (Mohit: app accounts "can be removed"; a clean-up waits for his go-ahead and a backup). Tests: `test/accessStripeFlow.test.js` |
| Stripe: the purchase follows Stripe | Done (`checkout.js`, `checkoutSync.js`, `payments.js`, `stripeErrors.js`, migration `20261101-1000`): the poll, `/pay`, the quote and the sweeper job `access-checkout-sweep` (every 5 minutes, only with `JOBS_ENABLED`) ask Stripe and activate a paid checkout, once; one payment under way per card (409 `CHECKOUT_IN_PROGRESS`); statuses `processing` and `cancelled`, and `failed` shown; the view with `client_secret` and `card`; nothing to pay answers `{ paid: true }` at `/pay`; idempotency keys per request; a customer Stripe lost is made again; cards and Link only; Stripe's refusals answer 502 `PAYMENT_UNAVAILABLE`; the guest's account made inside the activation's transaction, emails after; a second Pro or keychain recorded but not given, support emailed to refund it; `select-plan` `nfc_only` makes the card live on Free, and Free again changes nothing; a checkout tells no one else that it exists. Tests: `test/accessStripeFlow.test.js` (new), with a larger `test/fakeStripe.js` |
| Stripe: renewals, portal, refunds, webhook | Done: 15 webhook events (new: `invoice.payment_action_required`, `payment_intent.processing`, `charge.refunded` and the five `charge.dispute.*`), printed by `npm run stripe:setup` and checked by `npm run check:server -- --online`; failed renewals and 3-D Secure requests emailed to the owner; a seat past due is Pro at most 21 days; the seat view's `past_due` and `last_payment_failed_at`; `POST /access/billing-portal`; refunds and disputes recorded only (FEAT-04); each event's claim marked done after a 2xx (`stripe_events.processed_at`), a stale claim taken over, a concurrent delivery answered 409. Tests: `test/accessStripeFlow.test.js`, `test/stripeWebhook.test.js` |
| Admin orders | Done: the list reads the query string (A-ACC-1, the admin panel's BA1), with `cancelled` and the new statuses; the detail adds `checkout`, refunds and disputes; `POST /businessCard/access-orders/:id/cancel` (no refund; a keychain not shipped stopped; Access Pro ended now; the card stays on Free); no label for a cancelled order (409 `ORDER_CANCELLED`). Tests: `test/accessStripeFlow.test.js`, `test/shipping.test.js` |
| Account deletion | Done: deleting an account (an admin's delete or the person's own) ends its Access Pro at Stripe at once, with no refund (`shared/billing/accountBilling.js`: each product registers `endBilling`); if Stripe refuses, the account is not deleted. Tests: `test/accessStripeFlow.test.js` |
| Checks | 311 of 311 tests pass on a throwaway MariaDB (264 before); `npm run lint` (oxlint and the module boundaries) passes. Stripe is faked in every test: nothing has run against real Stripe yet |

**For Mohit to do:**

1. Deploy the API before the website and the admin panel (deploy.md section 9, "Once, with the Nov 1 code"):
   `npm run migrate`, `npm run stripe:setup`, `npm run directory:geocode` once, `npm run check:server -- --online`.
2. In Stripe's dashboard, in test mode now and in live mode at the switch (deploy.md section 5): add the webhook's 8
   new events (15 in all); turn Link on (or ask, and `'link'` comes out of `PAYMENT_METHODS`); save a customer portal
   configuration; set Revenue recovery to cancel the subscription after its retries, with Stripe's failed-payment
   emails off; register the payment method domains.
3. Test on test.glamlink.net in Stripe test mode: Access Pro, the keychain alone, Pro + keychain, a 3-D Secure card, a
   declined card, Free and Free + keychain, a guest with an app account's email, a brand card with no location, a
   claim verified in the admin panel, an admin's Cancel order, and the billing portal. Then deploy the website and the
   admin panel.
4. App accounts: none were deleted. A clean-up only after Mohit confirms, and after a backup.

**Not done:** an admin's card delete still deletes the card's payment rows (soft deletes; BE-19); a card's
`access_orders` still come in database order (the website sorts them; BE-34); a fourth Instagram handle is still
dropped (BE-36); analytics days are UTC (W-ACC-8); the app and CRM code keep their own Stripe clients; other Stripe
errors elsewhere in the API still answer `PAYMENT_FAILED`; an admin's card create for an email that has an account
neither settles the type nor converts an app account; after a 100% first-month sale there is no card on file, so the
first renewal fails into past due (with the email and the billing portal).

## On the server (checked Oct 30)

Read-only checks of the live API on Oct 30, with what Mohit reported. "Check" means only the server can tell. What
comes next is in plan.md ("Next").

| Item | Status |
| --- | --- |
| api.glamlink.net in testing mode | Deployed Oct 17 (Mohit). Phase 6 was deployed later (date not recorded): on Oct 30 every public read answers, the phase 6 calls included, and 34 podcast episodes are imported. Which commit runs: check (`aadb56a` expected) |
| The migration run | Mohit: the server ran 23 pending migrations on Oct 17. The repo had 18 then and has 35 now, and the Oct 23 tables answer, so check with `npm run migrate:status` |
| Server layout | As reported: pm2 `glamlink-api` runs from `/var/www/backend` on port 5500 with database `glamlinkdb`. deploy.md and `ecosystem.config.json` still say `/var/www/api`, port 5001 and `glamlink_api` |
| `NODE_ENV` | The server `.env` says `test`; pm2's env runs the API as production (the `/search` rate-limit headers show it). Set `production` in `.env` too |
| Test-site settings (deploy.md section 7) | Partly applied: test.glamlink.net, www, admin.glamlink.net and localhost:3000 are allowed origins, and there is no `X-Powered-By`. The API serves a Stripe test key. Check: `WEBSITE_URL`, nginx `real_ip_header`, the Shippo test key |
| `YOUTUBE_API_KEY` | Set: 34 videos imported. The other three series still need their playlists |
| `npm run magazine:covers` | Not run: the 14 covers still load from glamlink.net |
| Cache refresh | Check: `WEBSITE_REFRESH_URL` and `WEBSITE_REFRESH_SECRET` here; the website's route exists and reads `REVALIDATE_SECRET` |

## Phase 6: the website's requests (Oct 23–24, branch `phase6/website-requests`; on `master` and deployed)

The website's list, "Glamlink Backend Requests — Home Page and Pending Work" (Claude Docs, Oct 22; link in
README.md): 22 requests for the new home page, the professional and brand pages, and the takeovers left from Phase
2b. The list grew to 31 rows on Oct 23 (the plans and Stripe) and 40 on Oct 30 (the audit's fixes); 22 are done.
Built in its order; each item lands with tests and an entry in the handoff notes, and its row in that list is
marked done.

Mohit's decisions (Oct 23):

- **Public pages:** every professional or brand with a live Access card gets one; admins can unlist any page, and
  create one for a brand that has no login yet (claimed later through the "Set your password" email). There is no
  "industry" yet; it may come later as a filter on the brands and professionals pages.
- **Brands:** a brand is a professional type, a professional who shows their business name rather than their own.
  Nothing else differs yet.
- **The directory application form stays:** it is how people without an account or an Access card get onto the
  directory. Its submissions are stored apart from cards, for admins to review; how approved ones show on
  /directory is settled with the directory search.
- **Newsletter:** subscribers are stored (admin list, delete, CSV export); Mailchimp sync comes once its key and
  audience are set.
- **The old API** (node.glamlink.net) has the same profile leak: Mohit handles the old server.
- **Every owner edits their page**, Free included; **a page shows while its account has a live card** (admin brand
  pages always).
- **The directory** shows our profiles first, then about 20 Google listings near the visitor, which owners claim
  through the apply form, prefilled from Google ("Find my business on Google" too).
- **Directory listings become accounts:** approval makes (or finds) the account for the application's email and sends
  a "Set your password" link; the person uses the Access dashboard to keep the listing up to date and manage their
  products, which show at once (admins can edit, unpublish or delete them); the account gets a page from the
  listing; approval does not make a card (they make their Free card themselves).

Development moved to Linux (Oct 23): a portable MariaDB 10.11 for the tests. No copy of the live data is on this
machine yet, so the contract check waits for one; the tests cover each change.

| Item | Status |
| --- | --- |
| The database port | Done: the app's connection reads `CENTRAL_MYSQL_PORT` (it always used 3306; the server uses 3306) (`7b7a2f6`) |
| Test-site settings and testing-mode keys (urgent; server settings) | Written for Mohit to apply: deploy.md section 7, "The website on test.glamlink.net" (the origin, `WEBSITE_URL`, test keys, Cloudflare real IP in nginx, the `www` redirect); `X-Powered-By` turned off in the code. Partly applied by Oct 30 (see "On the server") |
| Cards found by their handle (found while writing the test-site steps) | Done: migration `20261023-0600` (`business_cards.slug`, filled from the link; the model keeps it in step with `business_card_link`); `getBusinessCard/:slug` and new handles use it. Before, a card was found by its whole link, so with `WEBSITE_URL` on the test site no existing card opened and a new card could take an existing handle and overwrite its QR file. Tests: `test/cardSlugs.test.js` |
| Lock down `GET /user/profile/:userId` (urgent) | Done: guests and other accounts get the public profile, built from allowed fields (`shared/users/userPublic.js`); the owner and admins get the whole account; admins' tokens work there; Google geocodes the address only when the caller sends coordinates. The app's professional screen reads the address and coordinates: in the app phase, take them from the card's locations, which respect the owner's exact-or-city choice. Tests: `test/profilePrivacy.test.js` |
| Paged journal list with search and category (urgent) | Done: `GET /journal` with list parameters answers a page of light cards, newest first (`listJournals`); without them, as before; `count` counts articles (79 for 66: products and downloads multiplied the rows). `core/http/paging.js` (page, limit at most 50) and `core/utils/like.js` (search terms taken literally) for the lists to come. Drafts are no longer public by id or category (admins still get them). Tests: `test/journalList.test.js` |
| Featured article and category clean-up | Done: migration `20261023-0100` (`journals.is_featured`, the newest Cover Feature article featured; category titles trimmed, slugs made for URLs, originals in `journal_category_backup`; `journal_categories.sort_order`); `GET /journalCategory` adds `article_count`; admins set both. Same tests |
| Topic tile flags and home settings | Done: migration `20261023-0200` (`journal_topics.is_featured`, `featured_order`, `tile_image`; the mockup's six topics start as tiles where they exist; `site_settings` with `home` seeded with the mockup's five popular searches); `GET /journal/topic?featured=true`; `GET` and `PUT /settings/home` (`siteSettings.service.js`); images must be uploads on the API host (`core/http/uploadedFiles.js`). Tests: `test/homeSettings.test.js` |
| Product paging, filters, featured flag, single-product 404 | Done: migration `20261023-0300` (`shops.is_featured`, `featured_order`, `description`); `GET /discover/shop` with list parameters (`listShop`: category and brand by slug of their text, search, featured; the admins' order); `GET /discover/shop/filters`; `findById` answers 404 and serves drafts to admins only (all discover types). `core/utils/formValues.js` (`isYes`, `wholeNumber`) shared with the journal code. Tests: `test/shopList.test.js` |
| Newsletter and feature-request calls | Done: migration `20261023-0400` (`newsletter_subscribers`, one row per email; `feature_requests`); `POST /newsletter/subscribe`, `POST /feature-request` (20 an hour per address in production, `limitPublicForms`; fields checked in `inquiries/formInput.js`, `INVALID_INPUT` with the field); admin lists, CSV export (`core/utils/csv.js`, formulas shown, not run) and delete; support@glamlink.net emailed for each feature request. The guest application keeps `businessName` and `instagram` (dropped before). Tests: `test/publicForms.test.js` |
| Directory application form (decided: it stays) | Done: migration `20261023-0500` (`directory_applications`: the form's fields as sent, the photos, `wants_access_card`, `place_id`, a review status); `POST /directory/applications` (public, `limitPublicForms`), admin list, view, review and delete (photos removed with it, `removeUploadedFile`); support emailed. Tests: `test/directoryApplications.test.js` |
| Public account fields, slugs, brand pages in admin; profile list and detail; self-service page editing | Done (the pages' products and articles come with the next two items): migration `20261023-0700` (`profile_pages`: only what is set on a page); module `website/profiles` (`GET /profiles`, `GET /profiles/:slug`, `GET`/`PUT /my/profile`, admin list, edit, brand pages and claim emails). A page shows while its account has a live card, or always when an admin made it as a brand page (Mohit's rules); public shapes are built field by field (`profilePublic.js`); a new card's handle avoids other accounts' page slugs. Tests: `test/profiles.test.js` |
| Product owner and brand | Done: migration `20261023-0800` (`shops.owner_id`, `brand_id`, set by admins); product answers link to the owner's and brand's pages (`owner`, `brand_profile`); `brand=` takes a brand page's slug too, `owner=` a page's slug; pages list their products (`GET /profiles/:slug/products`). The content and profiles modules call each other through their index files, loaded on call (no load cycle). Tests: `test/productOwners.test.js` |
| Journal mention index | Done: migration `20261023-0900` (`journal_mentions`, every existing article indexed); handles kept on each save and matched to accounts when read (`mentions.service.js`), so a professional who joins later is found; `findJournalById` answers `mentions`; saving answers `unmatched_mentions`; editors add and set aside mentions; pages list their articles (`GET /profiles/:slug/articles`). Tests: `test/journalMentions.test.js` |
| Public-field allow-lists, image sizes | Done: public shapes listed field by field (pages, article cards, product cards, a public product); `/images/<file>?w=<width>` answers a WebP copy made on first request and kept (`core/http/imageSizes.js`; widths 200 to 1,600), for every image already uploaded, instead of new `{ url, thumb }` fields that would change the image fields the website reads. Tests: `test/imageSizes.test.js` |
| Videos by series with YouTube sync | Done: migration `20261023-1000` (`video_series` with the four series, the podcast's playlist known; `videos`, `video_people`, `journal_topic_video_mappings`); module `website/watch`; `integrations/youtube.js` with `YOUTUBE_API_KEY`; admin import of a pasted link and of every playlist (a button; the hourly job was dropped Oct 24, as episodes come rarely); public `GET /videos`, `/videos/:slug`, `/video-series`; profile and topic pages list videos. The server key is set (34 videos imported by Oct 30); the other three series' playlists are still an open question in the website's list. Tests: `test/videos.test.js` with a fake YouTube |
| Magazine issues and features | Done: migration `20261023-1100` (`magazine_issues` with the website's 14 issues, `magazine_features`); module `website/magazine` (`GET /magazine`, `/magazine/:slug`, admin issues and features); profile pages list their issues (`GET /profiles/:slug/magazine`); `npm run magazine:covers` copies the covers from the website to the API (deploy.md). Tests: `test/magazine.test.js` |
| Grouped site-wide search | Done: module `website/search` (`GET /search`, grouped or one group paged; each group is its module's own list with exact matches first, `core/db/searchOrder.js`); migration `20261023-1200` (`search_terms`) and `GET /search/admin/terms`; 60 searches a minute per address. Tests: `test/search.test.js` |
| Ad tracking and live ads | Done: migration `20261023-1300` (`ad_stats`, per ad and day); `POST /ads/track` (300 a minute per address); `GET /ads?live=true` with `slot` and `page`; admin totals and daily counts (`adStats.service.js`). Tests: `test/ads.test.js` |
| Directory search with geocoding | Done, as Mohit described (Oct 23): module `website/directory`: our profiles (`GET /directory/search`: live cards and approved applications, by distance, words, specialty, city, state) and listings (`GET /directory/listings/:id`); Google's listings near the visitor and the claim flow (`/directory/google`, `/google/search`, `/google/places/:placeId`, `/google/photo`) on Places API (New) (`integrations/googlePlaces.js`), answers cached six hours; card locations geocoded after each save (`cardGeocode.js`), applications' main location too (migration `20261023-1400`); `npm run directory:geocode` for the rest. `getCoordinates` returned the viewport's corner, now the place. Tests: `test/directory.test.js` with a fake Google |
| Product uploads by owners, as Mohit set it | Done: migration `20261023-1500` (`directory_applications.user_id`); approval makes the account, links it, gives it a page slug and sends the set-password email; pages and the directory read approved listings (`profileQuery.js`); `GET`/`PUT /my/directory`; admins edit and add listings; `/my/products` (shown at once; a brand's products are its make). Tests: `test/listingAccounts.test.js` |
| Calls by slug | Done: migration `20261023-1600` (every article and product a slug of its own: `shops.slug`, unique on both; an admin's typed slug kept); `GET /journal/slug/:slug`, `GET /discover/shop/slug/:slug`, topics by slug or id; a product gets its slug however it is added (admin, owner, CSV: `shop.model.js` hooks); the calls by id unchanged. Tests: `test/slugs.test.js` |
| Sitemap feed | Done: `GET /sitemap` (`search/sitemap.service.js`): each module lists its own public pages by its own rules (`sitemapArticles`, `sitemapTopics`, `sitemapProducts`, `sitemapPages`, `sitemapVideos`, `sitemapIssues`); a page's date is the latest of its page, card, listing and account profile. Tests: `test/sitemap.test.js` |
| Page analytics | Done: migration `20261023-1700` (`profile_page_events`: no address or browser string kept); `POST /profiles/:slug/events` (visible pages; robots not counted; 120 a minute per address in production); `GET /my/profile/analytics` and `GET /profiles/admin/:userId/analytics` in the card analytics' shape, plus `top_targets`; days are the database's. Tests: `test/pageAnalytics.test.js` |
| Cache-refresh hook | Done: `integrations/websiteRefresh.js` posts `{ tags }` with `Authorization: Bearer WEBSITE_REFRESH_SECRET` to `WEBSITE_REFRESH_URL` (one call per second of changes; failures logged); `core/http/afterChanges.js` runs it after each successful write by a signed-in admin or account on the website modules' mounts, each naming its data (`refresh` in `routes()`); paid cards going live and the YouTube import call it too. The website's route exists (web `src/app/api/revalidate/route.ts`); off until the server sets `WEBSITE_REFRESH_URL` and the secret (deploy.md section 3). Tests: `test/websiteRefresh.test.js` |
| Cleaner card responses (the list's "later, with both frontends") | Waiting for a date agreed with both frontends. Checked Oct 23: the website's card form and the admin panel's card screens already accept lists as arrays as well as JSON strings, and the backend already stores `GO_TO_BOOKING_LINK` (the odd casing is the website's own constant); true/false for `"1"` needs both frontends checked first |

## Go-live preparation (Oct 16, branch `phase5/security`)

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
