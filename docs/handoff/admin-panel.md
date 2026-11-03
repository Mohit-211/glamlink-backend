# Admin panel: backend API changes for the cutover

For: the Claude working on the Glamlink admin panel.
Backend: `api.glamlink.net`, all routes under `/api/v1`. Backend branch: `master` (the code that deploys; it holds every earlier phase).

The backend and its clients ship together in one cutover. Admin sign-in itself is unchanged; what changed
is which endpoints exist, some field names, and the account model behind the user screens. Anything not
mentioned answers as before.

**Status (Oct 30):** the panel runs on this API at admin.glamlink.net (its `main`, built Oct 27); the checklist below
is done. This note is the reference for what the admin endpoints take and answer. The new backend runs at
`https://api.glamlink.net` (all routes under `/api/v1`), replacing `https://node.glamlink.net`.

**Nov 1–2:** the changes in the Nov 1 changelog row are built and tested in the backend but not deployed. The panel's
matching changes (on its `main`, Nov 4) rely on them: deploy the API first.

**Nov 3:** the profile pages' new fields, media and education (the Nov 3 row, section 8.6) are built and tested in the
backend, not deployed. The panel's screens for them come later; the endpoints are ready.

## Checklist before the switch

Found by reviewing the admin panel code (Oct 16) against the new backend; checked again on Oct 30 against the panel's
`main` (`d681084`). Details in the sections below.

- [x] One API client that sends the admin token on **every** call. Done: `utils/session.ts` adds
      `Authorization: Bearer` to every API call except sign-in (on Oct 16, 124 of 204 calls sent none). Every admin
      endpoint refuses a missing token; `x-access-token` and `Authorization: Bearer` both work.
- [x] Build URLs without a double slash. Done: none left in `services/`. The API treats `//` as `/` anyway.
- [x] `VITE_API_BASE_URL=https://api.glamlink.net/api/v1/`, `VITE_IMAGE_BASE_URL=https://api.glamlink.net/images/`,
      `VITE_VIDEO_BASE_URL=https://api.glamlink.net/videos/` (files are served at the root, not under `/api/v1`).
      Done: the panel's `.env.example`.
- [x] Three paths: deleting an admin is `DELETE admin/deleteAdmin`. Done (`services/Api/Api.ts`). The other two
      (`admin/getAllReferralByProfessionalId/:id`, `admin/getBookingsByProfessionalId`) no longer apply: the panel
      dropped the app screens that called them (`b75b38b`, Oct 28).
- [x] Request bodies: `getReviewsTakenByUserId` and `getAvailablityByUserId` send `professional_id`, not
      `counselor_id`. No longer applies: those app screens are gone (`b75b38b`).
- [x] "Add admin" sends `password`; `department_id` is optional. Done.
- [x] When an admin call answers 401 (`code: "ADMIN_SESSION_EXPIRED"` or `"ADMIN_SIGN_IN_REQUIRED"`), end the session
      and go to sign-in. Done: the panel ends the session on any 401 for its current token (`utils/session.ts`) and no
      longer matches the old `jwt expired` / `invalid token` messages. A 401 always means "sign in again" (no endpoint
      answers 401 for a role); the app's screens (posts, reels, services, appointments, categories) answer the same way.
- [x] Sign-in: a failure is 401 `INVALID_CREDENTIALS` "Invalid email or password." whatever the reason; show it, and
      don't treat a 401 from the login call as an ended session. Sign-out: call `POST /admin/auth/logout` with the
      token, then clear it. Sessions last 12 hours. Done (`Login.tsx`, `MainLayout.tsx`).
- [x] Card gallery: up to 20 photos for admins (not 4: that is the owners' limit), and as many videos as the Pro
      setting allows (`entitlements.pro.videos`, default 1). Done: the panel allows 20 photos and 1 video
      (`cardRules.ts`); it does not read the setting (A-ACC-9).
- [x] No template words left in the panel. Done: the founder messages say "Professional". The
      `appointment_professional`, `GetBookingsByCounsellorId` and `GetAllReferralByBeauticianId` items no longer apply:
      those app screens are gone (`b75b38b`).

## Changelog

Newest first. Each entry says what changed in the API and what the admin panel must (or can) do.

| Date | Change | Admin panel |
| --- | --- | --- |
| Nov 3 | **Profile pages in the owner's design** (section 8.6; built and tested, not deployed). `PUT /profiles/admin/:userId` also takes `intro`, `category` (a brand's: one of 8 keys; a professional's: a specialty's name), `shipping` and `about_image`, and, as the owner sends them, the images as files (`profile_image`, `images` the cover, `about_image`); the view's `page` answers the four fields. Thirteen new admin routes (275 in all) for any page's Media & Images (`/profiles/admin/:userId/media`: list, add, `import-card`, order, edit with `is_hidden`, delete), Education (`/profiles/admin/:userId/education`: list, one, add, edit, order, delete) and article images (`/profiles/admin/:userId/uploads`). Owners' media and education show at once; admins hide media (`is_hidden`) or unpublish education (`status: "draft"`) | **Done on Nov 3** in the panel (uncommitted on `main`, its `progress.md` pass 12): `/pages/:userId` in tabs, with the four fields (images upload through `POST /journal/upload` and are sent as links; the new file fields aren't used), Media & Images (Hide and Show, captions, order, delete, photos, MP4s with posters, links, the card import), Education (drafts, Publish and Unpublish, order, the editor's `article` mode with pictures through `.../uploads`) and a read-only Tagged in (`GET /profiles/:slug/articles` and `/videos?series=beauty-vault-podcast`). Page analytics name the five new events |
| Nov 1 | **Access orders, listing claims, card types** (Mohit's decisions of Nov 1; built and tested, not deployed). **Orders** (sections 7.4, 7.5): `GET /businessCard/access-orders` reads `page`, `limit` (10 by default, at most 100), `search`, `payment_status`, `fulfillment_status` and `cancelled=true\|false` from the query string (A-ACC-1 fixed), and an unknown status is 400 `INVALID_INPUT`; the order detail adds `checkout` and `cancelled_at`, `cancel_reason`, `refunded_amount`, `refunded_at`, `dispute_status`, `disputed_at`; new `POST /businessCard/access-orders/:id/cancel` `{ reason? }` cancels with no refund (a keychain not yet shipped won't ship, Access Pro bought with it ends now); order payment states add `partially_refunded` and `disputed`, fulfillment `cancelled`, payment rows `REFUNDED` and `DISPUTED` (refunds and disputes made in Stripe are recorded); a cancelled order's label is 409 `ORDER_CANCELLED`. **Claims** (8.14): the website's Access form can claim a Google listing (`claimed_place_id` on the card); new `GET /directory/claims` and `PUT /directory/claims/:cardId` `{ action: "verify" \| "reject" }` (409 `PLACE_ALREADY_CLAIMED`). **Cards** (section 7): `professional_type` (`individual` or `brand`) on create and edit; a brand's title, specialties and booking method are optional; locations are optional; special offers are no longer read or answered. **Directory applications** (8.5): the website's form is retired (`POST /directory/applications` answers 410 `FORM_RETIRED`); the admin endpoints stay. **Pricing and seats** (7.1, 7.2): Access Pro $9.99 for new purchases (subscribers keep their price); the new plan copy; `special_offers` gone from the entitlements (dropped if sent); a seat past due stays Pro at most 21 days; Stripe's refusals answer 502 `PAYMENT_UNAVAILABLE`. **Analytics** (8.13): an owner on Free is refused the card's and the page's numbers; admins are not. Deleting an account (`POST /admin/users/delete`) ends its Access Pro at Stripe at once, no refund; if Stripe refuses, the account is not deleted. Three new admin routes (262 in all) | **Done on Nov 1–2** in the panel (uncommitted on `main`): Access Orders pages on the server (50 a page) with Payment and Fulfillment filters and Cancel order (confirmation, optional reason); the dashboard's "Keychain orders to ship" counts paid orders that are pending or processing; a Type column, filter and select on cards; the new Listing Claims screen (`/directory-claims`); the applications screens say the form is retired. **Matched on Nov 2:** a cancelled order is read from `cancelled_at`, the "Cancelled" filter sends `cancelled=true`, a repeat cancel is handled like the first, and the payment filter offers `partially_refunded` and `disputed`. **Nov 3:** the order's details show its refund, dispute and cancellation; special offers left the pricing settings |
| Oct 30 | No API change. This note checked against the code (backend `master` `aadb56a`, audit of Oct 30): checklist ticked; limits, answer shapes and errors corrected in sections 2, 4, 5, 7 and 8; new section 9 (behaviour the sections left out); the appendix lists all 259 admin routes, with the 92 app back-office routes apart | **Panel fixes (contract audit):** A-OTH-1 expanding a user in Login History crashes the panel on a null IP: make the cell null-safe; A-ACC-2 Edit card sends `website` as `booking_link`; A-ACC-3 dragging featured links sends unsaved links and reloads the form on an error; A-ACC-4 a directory's empty `description` is sent as "undefined" or "null"; A-OTH-3 an ad slot without a height sends `height="null"`; A-OTH-10 the "ADMIN" option sends role 1, which is always refused; A-OTH-11 the form status PENDING is always refused; A-CNT-8 dragging while a search filter is on saves only the visible rows. **Known API gaps (backend fixes pending):** A-CNT-1 saving an article with topics answers 500 and soft-deletes its topic links (the FAQ change is lost too); A-ACC-1 the access-orders list reads paging from the body of a GET, so it always shows the newest 10; A-CNT-3 public topic pages show draft articles and products; A-CNT-4 after a topic is deleted, saving its products or podcasts ends in an error; A-CNT-5 a CSV typed `application/vnd.ms-excel` is refused; A-CNT-6 a large CSV import times out while rows keep being added; A-OTH-1 new logins save no IP; A-OTH-7 brand accounts (role 8) are on no list; A-OTH-9 user detail sends the password hash and tokens; X-1 Contact Us messages have no screen and email nobody; X-2 some "by id" calls answer 200 with a string (section 9) |
| Oct 24 | **YouTube import on request** (section 8.8): the playlists no longer import hourly; `POST /videos/admin/sync` is the only way new episodes come in. A playlist whose last page is empty and points at itself (the Beauty Vault's) is read once, no longer endlessly | **Must:** an import button (done on the Podcast Schedules screen) |
| Oct 23 | **Page analytics** (section 8.13): the website counts views of professional and brand pages and clicks on their links; `GET /profiles/admin/:userId/analytics` gives any page's numbers | **Can:** a numbers tab on the page screen |
| Oct 23 | **Slugs** (section 8.12): every article and product has its own slug, made from the title unless an admin gives one; a taken one is refused; an empty one no longer clears it | **Can:** show and edit the slug on the article and product forms |
| Oct 23 | **Listings become accounts** (section 8.5): approving a directory application makes (or finds) the person's account, links it and emails them how to sign in; they then edit their listing and their products themselves (shown at once). Admins also edit any listing (`PUT /directory/applications/:id`) and add one for someone (`POST /directory/applications/admin`). Products the owners add carry their `owner_id`; admins keep full edit, unpublish and delete | **New:** "Approve as brand", edit and add on the applications screen |
| Oct 23 | **Ad counts** (section 8.11): the website now reports each ad's views and clicks. New `GET /ads/admin/stats` (every ad's totals, with a date range) and `GET /ads/:id/stats` (one ad by day). `GET /ads` still lists every ad; `?live=true` is the website's | **New:** views, clicks and click rate on the ads list; a per-day view for one ad |
| Oct 23 | **What people search for** (section 8.10): `GET /search/admin/terms` lists the most searched terms, or (`?sort=empty`) the latest searches that found nothing | **New:** a search terms report, next to the home page's popular searches |
| Oct 23 | **The magazine** (section 8.9): issues (title, number, cover, date, Publuu ids or a flipbook link, description, status, order, featured) and who appears in each (cover, featured, mentioned, page); the website's 14 issues are already loaded | **New screens:** issues (list, add, edit, delete) and their featured people |
| Oct 23 | **Watch** (section 8.8): video series (name, YouTube playlist, order) and videos: the playlists import hourly once the server has `YOUTUBE_API_KEY` (superseded Oct 24: no hourly import, only the button), or now with "Import playlists"; paste a YouTube link to add one; set each video's series, status, featuring, people and topics | **New screens:** series; videos (list, edit, people, topics, "Add from YouTube", "Import playlists") |
| Oct 23 | **Who an article features** (section 8.7): saving an article (`POST /journal`, `PUT /journal/:id`) answers `unmatched_mentions`, the @handles that match no page or card; new `GET`/`POST /journal/:id/mentions` and `PUT`/`DELETE /journal/:id/mentions/:mentionId` to see, add and set aside the people an article features | **New:** after saving an article, show the unmatched handles (likely typos); a "Featured people" panel on the article form |
| Oct 23 | **Product owner and brand** (section 8.3): `POST /discover/shop` and `PUT /discover/shop/:id` take `owner_id` (a professional or brand account) and `brand_id` (a brand account), or `""` to clear; the product then shows on those accounts' pages | **New:** owner and brand pickers on the product form (accounts from `GET /profiles/admin/list`) |
| Oct 23 | **Professional and brand pages** (section 8.6): every account with a live Access card has a public page; admins list every page and how it stands, unlist, feature (with an order), give a page its own slug and fields, make a brand page for a brand with no login (it shows without a card) and email it a "Set your password" link | **New screens:** pages (list, edit, feature), "New brand page" with "Send claim email" |
| Oct 23 | **Directory applications** (section 8.5): the website's directory form now stores applications for review instead of making cards. New: `GET /directory/applications`, `GET /directory/applications/:id`, `PUT /directory/applications/:id/status` (approved, rejected or pending, with a note), `POST /directory/applications/delete`; support@glamlink.net is emailed for each | **New screen:** directory applications (list by status, view, approve or reject, delete) |
| Oct 23 | **Newsletter subscribers and feature requests** (section 8.4): the website's newsletter forms and "Apply for Feature" now store what they send. New: `GET /newsletter/list`, `GET /newsletter/export` (CSV), `POST /newsletter/delete`; `GET /feature-request/list`, `POST /feature-request/delete`. A new feature request also emails support@glamlink.net | **New screens:** newsletter subscribers (list, search, export, delete) and feature requests (list, search, delete) |
| Oct 23 | **Products for the home page** (section 8.3): `POST /discover/shop` and `PUT /discover/shop/:id` take `is_featured` (`"true"`/`"false"`), `featured_order` (a whole number) and `description` (the product page's longer text). `GET /discover/:type/findById/:id` (education, event, shop) answers 404 `NOT_FOUND` for a missing id (it answered 200 `"No Record Found"`) and serves drafts only with the admin token, which the panel sends. Article, category and author by id still answer 200 with a string (section 9) | **New:** "Featured on the home page", its order and a description on the product form. **Must:** read a 404 from `findById` as "not found" |
| Oct 23 | **The home page's tiles and settings** (section 8.2): topics take `is_featured`, `featured_order` and `tile_image` on create and edit (the "Explore Beauty + Wellness" tiles; the image is a link from `POST /journal/upload`). New `GET /settings/home` and `PUT /settings/home` (admin): the hero image, the popular searches under the search box (at most 10) and the "Find a Professional" image; a refusal is 400 `INVALID_SETTING` with `details.field` | **New:** "Show on the home page", an order and a tile image on the topic form; a "Home page" screen for the settings |
| Oct 23 | **Journal hero and categories** (section 8.1): articles take `is_featured` on create and edit (`"true"`/`"false"`), the Journal hero's article; on the live copy the newest Cover Feature article starts as featured. Categories take `sort_order` (a whole number; the Journal sidebar's order) on create and edit, and `description` on create too; titles are trimmed on save and the slug is made from the title for URLs (`What's New` is `whats-new`). `GET /journalCategory` adds `article_count` (published articles) and lists by `sort_order`, then title. `findJournalById` serves drafts to admins only (the panel sends its token) | **New:** a "Featured (Journal hero)" switch on the article form; a sort order on the category form |
| Oct 16 | A professional account made without a profession has none (`profession: null`); it used to get "Esthetician". The one app review that said "Counsellor" is removed, and Kate Sibley's second card (21, pending) is deleted (kept in the database, like an owner's delete) | **Can:** show an empty profession as blank |
| Oct 16 | **Template names gone from the data:** the admin permissions of the professionals section are now `professional`, `create-professional`, `view-professional`, `update-professional`, `delete-professional` ("Professional", was "Esthetician"); GlamCoin rules 11 and 12 are titled "Follow a Professional/User" and "Unfollow a Professional/User" (rules are still found by `action`) | **Must:** if the panel matches a permission slug, use the new ones (it does not today). Also the checklist's item on template words |
| Oct 16 | **Admin sign-in** (the panel's security questions, answered in that doc): a failed login is 401 `INVALID_CREDENTIALS` "Invalid email or password." for an unknown email, a wrong password and a deactivated admin alike (it was 400 "User not found." or another message). Tokens last 12 hours (`ADMIN_TOKEN_HOURS`; it was 5 days). New `POST /admin/auth/logout` ends every session of that admin; changing or resetting the password does too (the next call answers 401 `ADMIN_SESSION_EXPIRED`). `POST /admin/auth/otp` answers the same for any email. The app's admin screens (`/admin/posts`, `/admin/reels`, `/admin/services`, `/admin/home/appointments/all`, `/admin/user/promoted`, `/admin/service-list`, `/category` writes) now use the same check as every admin route: Bearer accepted, a deactivated admin refused, 401 with a code instead of 400 or 500 (`jwt expired`) | **Must:** show the login error; call logout on sign-out; after a password change, show sign-in |
| Oct 16 | **For the panel as it is:** a URL with a double slash (`/api/v1//journal/topic`) reaches its route; "Add admin" needs no `department_id` (`ADM_DEPT_ID` is used); the card gallery takes up to 20 photos from an admin (owners stay at their plan's 4; an owner can't add to a card over that), and as many videos as the Pro setting allows (`entitlements.pro.videos`, default 1, settable 0 to 20). Uploads take up to 20 `images` per request | **Must:** cap the gallery at 20 photos and 1 video (the 4-photo entry below was for owners). **Can:** read the video count from the settings (`GET /access/admin/catalog`) |
| Oct 16 | **Plan features enforced for owners** (the website note's section 9.6): on a live card, Free owners cannot change photos, video or the profile image or run offers; admins are not limited. What each plan allows is the `entitlements` setting (section 7.1) | **Can:** show the settings' entitlements on the pricing screen so they can be changed |
| Oct 16 | **Keychain labels and tracking with Shippo** (section 7.3): on an access order, `GET …/rates`, `POST …/label` (buys the label: the rate chosen at checkout, or today's), `POST …/label/void`. The order gains `carrier`, `service`, `label_url` (the PDF to print), `tracking_number`, `tracking_link`, `tracking_status`, `shipped_at`, `delivered_at`; Shippo's tracking moves it to shipped and delivered. Addresses gain `address_line_2`, `recipient_name`, `phone`, `city_name`, `purpose`, `address_type`, `validation_result` | **New on the order screen:** "Buy label" (and a rate picker from `…/rates`), "Print label" (`label_url`), "Void label", the tracking status. The manual fulfillment update still works |
| Oct 16 | **Subscriptions and payments** (section 7.2): every Access Pro subscription is a seat, paid through Stripe or complimentary (given by an admin; 23 accounts on the live copy have Pro without paying). New: `GET /access/admin/subscriptions`, `POST /access/admin/subscriptions/:userId/cancel`, `PUT /access/admin/subscriptions/:userId/comp`. A price change can move paying subscribers (`move_subscribers`; it now answers `{ product, moved, failed }`), a personal price can go on a live subscription (`apply_now`). Every paid purchase now makes an access order (Access Pro alone too, with no fulfillment status); the admin's order email links to the order in the panel | **New screen:** subscriptions (list, cancel, give or take back complimentary Pro). **Must:** the access orders list shows orders whose `fulfillment_status` is null (nothing to ship) |
| Oct 16 | **Access pricing screens** (section 7.1): plans, prices (with history), site-wide discounts, personal prices for one client, and settings (what Free and Pro may do, shipping), under `/access/admin/…` | **New screens** (none exist): see section 7.1 |
| Oct 16 | **Guest drafts and one card per person.** A card a guest makes on the website is a draft until a plan is chosen or paid. `GET /businessCard/getAllBusinessCards` leaves drafts out; `?status=draft` lists them (`?status=pending`, `accepted` or `rejected` filters too). `createBusinessCardByAdmin` for an email whose active account already has a card answers 409 `CARD_EXISTS` (`details.card_id`); send `replace=true` to replace it (the old card is deleted but kept, and the new one takes its link and QR code). The card's `status` can be `draft` | **Can:** a "Drafts" view (`?status=draft`). **Must:** handle `CARD_EXISTS` on "Create card" (offer replace) |
| Oct 16 | **Card create and edit use the website form's fields and checks** (the backend's `docs/access.md` section 1; the website handoff note's section 9.1 lists every rule). A refusal is 400 `INVALID_CARD` with `details: { field }`. Up to 4 photos and 1 MP4 video, a thumbnail per video; bio up to 80 characters of text; phone 10 digits while shown. No longer saved: `custom_handle`, `primary_specialty` (the first specialty is used), `elite_setup`, `excites_about_glamlink`, `biggest_pain_points`, per-location phone and description. Business hours: lines of text (`[{ note }]`). `getBusinessCardById/:id` returns the whole card only with an admin token (or the owner's); without one, the public card, and 404 for a card that is not live. The whole card's `specialties`, `social_media` and `important_info` come as JSON strings (`getBusinessCard/:slug` parses them) | **Must:** limit the gallery to 4 photos and 1 video (it allows 20; superseded the same day: admins get 20 photos, the "For the panel as it is" row above), drop the removed fields from the form, show `details.field` errors. Captions: send `new_images_gallery_meta` (one per new photo) and `existing_images_gallery_meta` (one per kept photo, in `existing_image_ids` order); `gallery_meta` is read only for new photos |
| Oct 16 | Coming (Phase 2b): the Access redesign in the backend's `docs/access.md`. Section 7 lists the new screens and changes; each part gets its own entry here when it lands (all landed Oct 16: the rows above) | Nothing yet |
| Oct 16 | The card bio is cleaned on save with the allow-list of the website's bio editor (paragraphs, bold, italic, underline, strike, h3, lists, quotes, links). The panel edits the bio with the journal editor (fonts, colours, alignment, tables, images, video); anything outside the list is removed when the card is saved | **Must:** edit the card bio with an editor limited to the website's formatting and its 80-character limit |
| Oct 16 | CORS: no `Access-Control-Allow-Origin: *` any more; only the origins in `ACCESSDOMAINS` (production: `https://admin.glamlink.net`) get CORS headers; others get 403 `ORIGIN_NOT_ALLOWED`. `PUT /ads/sort-order` now works (it was caught by `PUT /ads/:id`) | Nothing, as long as the panel runs on a listed origin (local: ask for its dev URL, e.g. `http://localhost:3000`) |
| Oct 16 | `GET /journal/topic/:id` returns professionals' emails only with an admin token (the panel's topic screens send one). Oct 30: the public answer still carries each featured professional's whole card (hidden phone, plan, subscription status; W-1) and draft articles and products (A-CNT-3); backend fixes pending | Nothing |
| Oct 16 | Errors: unexpected failures answer `500` with "An internal server error occurred." instead of the raw database message (website and shared endpoints). Admin 401s carry a code: `ADMIN_SIGN_IN_REQUIRED` (no token, "Admin authentication required") or `ADMIN_SESSION_EXPIRED` ("Invalid or expired admin token"), messages unchanged | **Can:** end the session on either code (see the checklist) |
| Oct 16 | One admin check on every admin route outside the app screens: the token is accepted as `x-access-token` or `Authorization: Bearer` everywhere (the old check on `/admin/*` refused Bearer). A deactivated admin can no longer sign in (`400 User not found.`; since the later Oct 16 row, 401 `INVALID_CREDENTIALS`) or verify an admin OTP. `POST /admin/auth/change-password` checks the token before the body, so a missing token answers 401 instead of 400 | Nothing required; Bearer can now be used on every call |
| Oct 16 | Editing a card nobody owns yet (`updateBusinessCard/:id`, `:id/featured-links/reorder`) now needs an admin token; before, anyone could. The panel's reorder call sends no token today | **Must:** send the admin token on these calls (covered by "token on every call" in the checklist) |
| Oct 16 | Internal restructure (code grouped by product). No API change | Nothing |
| Oct 14–15 | Removed and renamed endpoints, account model changes in the sections below | See the checklist |

## 1. What to change, in short

1. Delete the screens for removed features: counsellor fees and approvals, prices, keywords management,
   logs, and the CRM screens (customers, staff, vendors). See section 3.
2. Update two renamed endpoints and the renamed response fields (sections 3 and 4).
3. Show the new account fields on user screens (`account_type`, `professional_type`, `email_verified_at`),
   and expect fewer users: duplicate accounts were merged (section 5).
4. Creating a user: one account per email across all types (section 5).

## 2. Admin sign-in and access

- `POST /admin/auth/login` returns the admin token (12 hours); send it as `x-access-token` or
  `Authorization: Bearer` on every admin call. A failed login is 401 `INVALID_CREDENTIALS` "Invalid email or
  password.", whatever the reason.
- `POST /admin/auth/logout` (token required) ends every session of that admin, on every device. Changing the password
  (`/change-password`) or resetting it (`/forgot-password`) does the same.
- `POST /admin/auth/otp` answers "If this email belongs to an admin, an OTP has been sent to it." for any email;
  `/verify-otp` is unchanged. The panel has no screen for this flow (`otp`, `verify-otp`, `forgot-password`; its page
  was deleted in pass 3), and `verify-otp` answers a full 24-hour admin token. The Oct 30 audit recommends removing
  the three routes (SEC-01): don't build on them.
- `POST /admin/auth/register` (create another admin) needs an admin token; it is not open any more. `name`, `email`,
  `password`, `role_id` required; `department_id` optional. `role_id` 1 (Super Admin) is refused with 400 "You are
  not authorized to create this role."; the API checks no password rules for admins yet (SEC-05).
- Every admin endpoint (the appendix lists all 262) requires an active admin's token. Any active admin may call any
  of them: roles and permissions are stored but not checked (SEC-05). Website/app user tokens are refused on admin
  routes, and admin tokens are not user sessions.
- In production every `/admin/auth/*` call (login, logout, register, change-password and the OTP calls) counts
  toward 15 per 15 minutes per IP address, then 429. A refused logout leaves that session valid until it expires
  (A-OTH-20).
- Error responses keep `{ success: false, status, message, data: "" }`; some now add a `code` field. Exceptions:
  refusals from the admin validators (register, change-password, create user and others) answer 4xx with
  `success: true`, so read `status`; `POST /form/deleteForm/:id` answers `{ code: 204, message, data: "" }` with no
  `success`.

## 3. Removed and renamed endpoints

Renamed:

| Was | Now |
| --- | --- |
| `POST /admin/getBookingsByCounsellorId` | `POST /admin/getBookingsByProfessionalId` |
| `GET /admin/getAllReferralByBeauticianId/:id` | `GET /admin/getAllReferralByProfessionalId/:id` |
| `GET /review/:counselor_id` | `GET /review/:professional_id` |

Removed (features from the counselling template, or parked):

| Endpoints | Why |
| --- | --- |
| `GET /admin/counselor/pending/list` | Counsellor approval queue (template feature) |
| `GET /admin/counselor/fees/change/list`, `POST /admin/counselor/fees/change/approved`, `POST /admin/counselor/fees/change/reject` | Counsellor fee changes (template feature; tables dropped) |
| `GET /admin/appointment/prices`, `GET/POST /price`, `PUT /price/:priceId` | Session prices (template feature; tables dropped) |
| `GET/POST /keywords`, `GET/PUT/DELETE /keywords/:id` | Keyword management. The keyword list for promotions is still `GET /promotion/getAllKeywords` |
| `GET/DELETE /logs`, `GET /test` | Debug endpoints that exposed server logs |
| `/customer/*`, `/staff/*`, `/vendor/*`, `/payment/crm/*` | CRM, parked until the CRM is rebuilt |
| `POST /order/createOrder` | Created orders without payment |

## 4. Response fields that changed

| Where | Was | Now |
| --- | --- | --- |
| User objects from `GET /admin/users/getUserById/:id` (not the rows of `/admin/users/list/:roleId`) | | adds `account_type` (`user` \| `professional` \| `staff`), `professional_type` (`individual` \| `brand`, professionals only), `email_verified_at`, `downgraded_at`, `merged_into_user_id` |
| User objects | `square_customer_id` | removed (never used) |
| User objects | emails as typed | emails stored lowercase |
| Profiles (`user_profile`) | `no_of_beautician_associated` | `no_of_professionals_associated` |
| Bookings, appointments, availability, cases, reviews | `counselor_id` | `professional_id` |
| Bookings, appointments | `is_counselor_joined`, `is_counselor_canceled` | `is_professional_joined`, `is_professional_canceled` |
| Bookings, appointments | `call_type`, `call_end_by`, `call_start_time`, `call_end_time`, `call_duration_in_minuites`, `counselor_zego_id`, `user_zego_id`, `zego_call_id` | removed (video calls were never part of Glamlink) |
| Included user on bookings (`getBookingsByProfessionalId`, user booking views, most-booked dashboard) | `appointment_counselor` | `appointment_professional` |
| Other included lists | `counselor_reviews`, `counselor_cases`, `counselor_slots`, `slot_counselor`, `counselor_appointments` | `professional_reviews`, `professional_cases`, `professional_slots`, `slot_professional`, `professional_appointments` |
| Brand associations | `beautician_brand_associations`, `brand_beautician_associations`, `brand_association_beautician` | `professional_brand_associations`, `brand_professional_associations`, `brand_association_professional` |
| Roles (`GET /role`, `user_role` on users) | id 7: `Estheticians` / `ESTI` | id 7: `Professional` / `PRO` |
| Dashboard `getMostBookedProfessional` | `counselor_id` | `professional_id` |

Request bodies follow the same renames (`counselor_id` → `professional_id`).

## 5. The account model behind the user screens

- **One account per email.** Types: `user` (app), `professional` (`individual` or `brand`), and `staff`
  (CRM staff, kept for the CRM). Role ids still exist and stay consistent with the type: 6 user,
  7 professional, 8 brand, 9 staff. `GET /admin/users/list/:roleId` lists professionals for 7 and app users
  (role 6) for any other id, so brand accounts (8) are on no list (A-OTH-7).
- **Duplicate accounts were merged.** Where one email had several accounts (an app account and a
  professional account for the same person: 12 accounts across 10 emails), everything moved to the
  professional account. The merged accounts are soft-deleted with `merged_into_user_id` set, so they
  disappear from lists and user counts drop accordingly.
- **Email verification** is `email_verified_at` (set for everyone whose `status` was `ACCEPTED`). `status`
  still exists.
- **Creating a user** (`POST /admin/user/create`): `role_id` must be 6, 7 or 8 (user, professional, brand);
  the account is created verified. An email already used by any account is refused (`400 Email already
  taken`; it used to be allowed once per role). It also needs `confirm_password`, a password of at least 8
  characters with 2 digits and no spaces, and a US `state_id` and `city_id`. The panel has no screen for it.
- **Access card buyers without an account** get a professional account with no password and a welcome
  email to set one (valid 7 days). Until they set it, they cannot sign in; an admin does not need to do
  anything.
- **Deleting a user** also ends all of their sign-in sessions immediately. Since Nov 1 it first ends their Access Pro
  at Stripe at once, with no refund or proration; if Stripe refuses, the user is not deleted.

## 6. Not changed on Oct 14–15, and what changed since

At the cutover's start (Oct 14–15) these kept their endpoints and payloads, apart from the field renames above
where they include users or bookings: journal, journal categories, authors, blog, podcast schedule, discover
(shop, education, events), ads, FAQ, contact, guest applications, partnership inquiries, Access card and
access-order management, the app's products and orders, categories, professions, departments, roles.

Many changed after that; the changelog dates each change:

- Access cards, access orders, pricing and subscriptions: section 7 (cancelling an order, 7.5, Nov 1).
- Directory applications (the public form retired Nov 1) and listing claims: 8.5, 8.14.
- Journal: `is_featured`, category `sort_order` and `article_count` (8.1), mentions (8.7), slugs (8.12), and
  `faq_ids` / `topic_ids` on save (section 9).
- Topics: home tiles (8.2); renaming one changes its slug, and adding one with a deleted topic's name brings that
  topic back (section 9).
- Discover: product owner, brand, featured and description (8.3), slugs (8.12); `GET /discover/:type/findById/:id`
  answers 404 `NOT_FOUND` for a missing id.
- Ads: counts (8.11).

Still as on Oct 14: partnership inquiries and professions; contact, guest applications, blog, departments and roles
(none has a screen in the panel; the Oct 30 audit proposes removing the blog); and the app's FAQ, service
categories, products and orders.

## 7. Access cards, plans and payments (Phase 2b, done Oct 16)

Designed and built Oct 16 (the backend's `docs/access.md`, section 8); the changelog logs each part.

- **The card form** shows exactly the website's fields (`docs/access.md` section 1). No longer saved:
  `custom_handle`, `primary_specialty` (it is the first specialty), `elite_setup`, `excites_about_glamlink`,
  `biggest_pain_points`, per-location phone and description. `location_type` is `exact_address` or `city_only`.
  Gallery: up to 20 photos for an admin (owners: their plan's 4), and as many videos as the Pro setting allows
  (`entitlements.pro.videos`, default 1, settable 0 to 20; with 0 an admin's video is refused).
- **The card's type** (Nov 1): `professional_type`, `individual` (a professional; the default) or `brand`, on
  `createBusinessCardByAdmin` and `updateBusinessCard/:id`; anything else is 400 `INVALID_CARD` (`details.field:
  "professional_type"`). Cards made before Nov 1 took their owner's type (migration `20261101-0100`). A brand's
  `professional_title`, `specialties` and `preferred_booking_method` are optional; every card's `locations` are
  optional (`[]` clears them). Every card answer carries `professional_type`. On a create for a new email, the account
  is made with the card's type; for an email that already has an account, that account keeps its own type (an app
  account is not converted). An admin's edit of the type changes the account's type and role with the card's (Nov 2):
  pages, products, `/brands` and the directory read the account's. An owner's edit can't change the type, nor add a
  claim: both are dropped from the request. `claimed_place_id` and
  `claim_verified_at` belong to listing claims (section 8.14); the card form never sends them. `offer_promotion` and
  `promotion_details` are ignored and no longer answered.
- **New screens:** plans (name, tagline, badge, features, order), prices (with "move subscribers at their next
  renewal"), site-wide discounts, personal prices for one client, settings (Free and Pro features, keychains per
  person, shipping mode, countries and parcel), subscriptions (status, cancel). The ship-from address is not a
  setting: it is the server's `SHIP_FROM_*` configuration.
- **Access orders:** buy and void the shipping label, tracking status from Shippo; since Nov 1 the list pages and
  filters from the query string (7.4), and an order can be cancelled, never refunded (7.5).
- **Cards:** guest drafts listed apart from live cards; creating a card for an email whose active account already
  has a card answers `CARD_EXISTS` (or replaces it when asked).

### 7.1 Pricing (done Oct 16)

All under `/api/v1/access/admin`, admin token required. Amounts are whole cents (USD). Errors: 400 `INVALID_INPUT`
with `details.field`, 404, 409 `DISCOUNT_OVERLAPS`.

| Method | Path | Body / query | What it does |
| --- | --- | --- | --- |
| GET | `/catalog` | | Products (list prices), plans, settings, discounts, the running discount: everything the pricing screens show |
| PUT | `/plans/:code` | any of `name`, `label`, `badge`, `tagline`, `features` (`[{ text, soon?, highlight? }]`), `products` (`["pro","keychain"]`), `sort_order`, `is_active` | Edits a plan as the website shows it |
| PUT | `/products/:code/price` | `{ amount_cents }` (at least 50) | New list price for `pro` (monthly) or `keychain`. New purchases pay it; subscribers keep their price unless `move_subscribers: true` is sent (section 7.2) |
| GET | `/price-changes` | | Price change history (who, when, before, after): the latest 200, newest first |
| GET | `/discounts` | | Discounts: the latest 200, by start date (newest first) |
| POST | `/discounts` | `name`, `percent_off` or `amount_off_cents`, `applies_to` (`["pro"]`, `["keychain"]` or both), `duration` (`once`, `repeating` with `duration_in_months`, `forever`: how long it lasts on Access Pro), `starts_at` (default now), `ends_at` (optional) | A site-wide sale. Only one runs at a time (409 `DISCOUNT_OVERLAPS`) |
| PATCH | `/discounts/:id` | `name`, `ends_at` | Rename, or move the end. To change what it takes off, end it and make a new one |
| POST | `/discounts/:id/end` | | Ends it now |
| GET | `/custom-prices` | `?user_id=`, `?email=`, `?active=true` | Personal prices: at most 500, newest first |
| POST | `/custom-prices` | `user_id` or `email`, `product_code`, `amount_cents`, `note`, `ends_at` (optional) | A price for one client (an email works before they have an account). Replaces their earlier one for that product; beats a running sale |
| POST | `/custom-prices/:id/end` | | Ends it |
| PUT | `/settings` | any of `entitlements` (`{ free, pro }` each with `photos`, `videos`, `edit_details`, `edit_media`, `analytics`, `priority_search`; `special_offers` is dropped if sent, since Nov 1), `keychains_per_person`, `shipping` (`mode` live/flat/free, `flat_amount_cents`, `countries` US/CA, `parcel` dimensions and weight) | Each setting sent replaces the stored one whole; answers all settings. `entitlements` needs both `free` and `pro`, each with every key (`photos` and `videos` 0 to 20). A refusal is 400 `INVALID_INPUT` with `details.field` naming the whole setting (`entitlements`, `shipping`), not the key. `analytics` is enforced since Nov 1 (owners on Free are refused their numbers); `priority_search` is stored, not built |

### 7.2 Subscriptions (done Oct 16)

| Method | Path | Body / query | What it does |
| --- | --- | --- | --- |
| GET | `/access/admin/subscriptions` | `?status=active`, `?source=stripe` or `comp` (exact matches) | Seats: `user_id`, `source`, `status` (Stripe's: active, past_due, canceled, …), `amount_cents`, `current_period_end`, `cancel_at_period_end`, and since Nov 1 `past_due_since` and `last_payment_failed_at`. The latest 1,000 by last change; no name or email (look the person up by `user_id`). Pro means `active` or `trialing`, or `past_due` for at most 21 days after the first failed renewal (since Nov 1; before, `past_due` was Pro for as long as it lasted) |
| POST | `/access/admin/subscriptions/:userId/cancel` | `{ now: true }` to end at once | Ends a person's Access Pro at the end of their paid month, or now with no proration and no refund. Since Nov 1 it also cancels a subscription past due beyond the 21 days, and Stripe's refusals answer 502 `PAYMENT_UNAVAILABLE` |
| PUT | `/access/admin/subscriptions/:userId/comp` | `{ active: true\|false }` | Gives or takes back complimentary Pro (409 `SUBSCRIPTION_PAID` for someone who pays) |
| PUT | `/access/admin/products/:code/price` | add `move_subscribers: true` | Also moves paying subscribers without a personal price to the new price from their next renewal |
| POST | `/access/admin/custom-prices` | add `apply_now: true` | Also puts the personal price on the client's live subscription from their next renewal |

### 7.3 Labels and tracking (done Oct 16)

| Method | Path | Body | What it does |
| --- | --- | --- | --- |
| GET | `/businessCard/access-orders/:id/rates` | | Today's Shippo rates for the order's parcel, cheapest first: `{ order_id, shipment_id, rates: [{ rate_id, amount_cents, currency, provider, service, service_token, estimated_days, duration_terms, attributes }] }`. 400 `NOTHING_TO_SHIP` for an order with nothing to ship |
| POST | `/businessCard/access-orders/:id/label` | `{ rate_id }` optional | Buys the label: `rate_id`, else the rate chosen at checkout, else today's rate for the same service (or the cheapest). The order moves to `processing` with its tracking number and `label_url`; answers the order. 409 `LABEL_EXISTS`, 502 `LABEL_FAILED` (with Shippo's reasons), 400 `NOTHING_TO_SHIP` or `NO_SHIPPING_RATES` |
| POST | `/businessCard/access-orders/:id/label/void` | | Voids an unused label (Shippo refunds it); the order goes back to `pending`. Answers `{ order, refund: { refund_id, status } }`. 400 `NO_LABEL` when there is none; 409 `LABEL_IN_USE` once shipped |

Shippo's webhook then updates `tracking_status` (PRE_TRANSIT, TRANSIT, DELIVERED, RETURNED, FAILURE) and moves
the order to `shipped` and `delivered` (never backwards).

A cancelled order (7.5) ships nothing: buying its label answers 409 `ORDER_CANCELLED`; a label bought before can still
be voided (Shippo refunds it) and the order stays `cancelled`; tracking no longer moves it.

### 7.4 The access orders list (checked Oct 30; fixed Nov 1)

| Method | Path | Query | Answers |
| --- | --- | --- | --- |
| GET | `/businessCard/access-orders` | `page`, `limit` (10 by default, at most 100), `search` (order number, customer name or email), `payment_status` (`paid`, `failed`, `refunded`, `partially_refunded`, `disputed`), `fulfillment_status` (`pending`, `processing`, `shipped`, `delivered`, `cancelled`), `cancelled` (`true` or `false`, Nov 1) | `{ data: [order with business_card { id, name, business_name, business_card_link }], pagination: { page, limit, total, totalPages } }`, newest first |

Since Nov 1 (not deployed) the API reads these from the query string. Before, it read them from the request body,
which a GET does not carry, so every call answered the newest 10 orders (A-ACC-1). An unknown status is 400
`INVALID_INPUT` with `details.field`. A cancelled order keeps its `payment_status` (usually `paid`): it is the one with
`cancelled_at`, listed with `cancelled=true`; `payment_status=cancelled` is refused.

**One order:** `GET /businessCard/access-orders/:id` answers the order with `business_card` and `payment`, as before,
and since Nov 1 also `checkout` (`{ id, plan_type, status, stripe_subscription_id, stripe_payment_intent_id,
stripe_invoice_id }`, null without one) and the order's `cancelled_at`, `cancel_reason`, `refunded_amount`,
`refunded_at`, `dispute_status` and `disputed_at`.

**Order states** (Nov 1). `payment_status`: `paid`, `failed`, `refunded`, `partially_refunded` (a refund made in
Stripe's dashboard, recorded by the webhook with `refunded_amount` and `refunded_at`), `disputed` (a chargeback open
or lost; `dispute_status` is Stripe's; back to what it was when the dispute is won). `fulfillment_status`: null
(nothing to ship), `pending`, `processing`, `shipped`, `delivered`, or `cancelled` (a keychain that won't ship). The
order's payment row (`payment`): `SUCCESS`, `CANCELLED` (the order was cancelled), `REFUNDED` (refunded in full) or
`DISPUTED`. Refunds and disputes change no plan, seat or shipping. A purchase that could not be given (a second Access
Pro or keychain paid at the same moment, or Pro paid on a subscription cancelled meanwhile) is still an order, with
`cancel_reason` "Paid but not given (…): refund it in Stripe." (and `cancelled_at` when nothing of it was given);
support@glamlink.net is emailed to refund it by hand, and so is the opening of a dispute.

### 7.5 Cancel an order (Nov 1)

`POST /businessCard/access-orders/:id/cancel` `{ reason? }` (at most 500 characters) answers 200 with the order in
the detail's shape, "Access order cancelled."; 404 for an unknown order. **Nothing is refunded** (Mohit): a keychain
is refunded by hand in Stripe's dashboard if needed, and subscriptions never are. What it does:

- the order gets `cancelled_at` and `cancel_reason`;
- a keychain not yet shipped (`pending` or `processing`) becomes `fulfillment_status: "cancelled"`; a shipped or
  delivered one keeps its status;
- the keychain stops being the person's (their cards' `nfc_status` goes back to `not_purchased`) unless another
  keychain order of theirs stands;
- Access Pro bought with the order ends at Stripe at once (no proration, no final invoice), and the seat follows; the
  card stays live on Free;
- the order's payment row becomes `CANCELLED` and its checkout `cancelled`; the order's own `payment_status` stays.

Cancelling again answers the order unchanged (there is no 409). If Stripe refuses to end the subscription, the order is
left as it was and the call fails (a Stripe 4xx answers `PAYMENT_FAILED` with Stripe's message).

## 8. The website's requests (Phase 6)

What the backend added for the website's new pages that admins set. Each part is logged in the changelog when it
lands.

### 8.1 Journal hero and categories (done Oct 23)

| Where | Field | What it does |
| --- | --- | --- |
| `POST /journal`, `PUT /journal/:id` | `is_featured` (`"true"` / `"false"`) | The Journal hero shows the newest featured article |
| `POST /journalCategory`, `PUT /journalCategory/:id` | `sort_order` (whole number, default 0), `description` | The order of the Journal page's category list (lowest first, then by title). An empty `description` on `PUT` is ignored, so a description can't be cleared |
| `GET /journalCategory` | `article_count`, `sort_order` in each row | Published articles in the category |

### 8.2 The home page's tiles and settings (done Oct 23)

**Tiles:** the home page shows the topics with `is_featured`, by `featured_order` (lowest first, then by name). On
`POST /journal/topic` and `PUT /journal/topic/:id`:

| Field | Value |
| --- | --- |
| `is_featured` | `"true"` / `"false"` |
| `featured_order` | A whole number |
| `tile_image` | A square image for the tile: the `location` that `POST /journal/upload` answers for an uploaded image (field `images`), or `""` to remove it (the tile then uses the cover). Another site's link is refused (400) |

**Settings:** `GET /settings/home` shows them; `PUT /settings/home` (admin token) changes the fields it is sent:

| Field | Value |
| --- | --- |
| `hero_image`, `find_professional_image` | An uploaded image's `location` (as above), or `""` to remove it |
| `popular_searches` | A list of search terms (or that list as a JSON string): trimmed, repeats dropped, at most 10, each at most 60 characters |

It answers the settings as saved. Refusals: 400 `INVALID_SETTING`, `details.field` naming the field.

### 8.3 Products for the home page (done Oct 23)

On `POST /discover/shop` and `PUT /discover/shop/:id`:

| Field | Value |
| --- | --- |
| `is_featured` | `"true"` / `"false"`: shown in the home page's Shop Products row |
| `featured_order` | A whole number: the row's order (lowest first) |
| `description` | The product page's longer text (the page shows `short_description` without it) |
| `owner_id` | The account that put the product up: a professional or brand account's id, or `""` for none (Glamlink's own pick) |
| `brand_id` | The brand account that makes it: a brand account's id, or `""`. The free-text `brand` stays the name shown |

The shop page follows the order set with `POST /discover/shop/sort-order` (then title); it used to ignore it. Only the
paged list (`GET /discover/shop?page=…`, what the website's shop uses) follows it: the unpaged `GET /discover/:type`
lists by title, so the order of education and events shows nowhere (no website page reads them). A wrong
owner or brand is 400 `INVALID_PRODUCT` with `details.field`. Pick the accounts from `GET /profiles/admin/list`
(section 8.6; `?type=brand` for brands).

### 8.4 Newsletter subscribers and feature requests (done Oct 23)

| Method | Path | Query or body | Answers |
| --- | --- | --- | --- |
| GET | `/newsletter/list` | `page`, `limit` (50, at most 50), `search` (email or name), `source` (`popup`, `footer`, `podcast`, …) | `{ count, rows: [{ id, email, first_name, last_name, source, created_at, updated_at }] }`, newest first |
| GET | `/newsletter/export` | the same `search` and `source` | A CSV file of every match (`Email`, `First name`, `Last name`, `Source`, `Signed up`) |
| POST | `/newsletter/delete` | `{ ids: [...] }` | `{ deleted }`; the emails are removed from the list |
| GET | `/feature-request/list` | `page`, `limit`, `search` (name, email, specialty or city), `interest` | `{ count, rows: [{ id, name, specialty, email, phone, city, interest, created_at }] }`, newest first |
| POST | `/feature-request/delete` | `{ ids: [...] }` | `{ deleted }` |

### 8.5 Directory applications (done Oct 23; public form retired Nov 1)

Since Nov 1 the website's directory form is retired (Mohit: one form): `POST /directory/applications` answers 410
`FORM_RETIRED` and stores nothing. People join through the Access form as a professional or a brand, are listed as
soon as their card is live, and claim a Google listing from there (section 8.14). The admin endpoints below stay, for
the applications still pending and for listings admins add.

| Method | Path | Query or body | Answers |
| --- | --- | --- | --- |
| GET | `/directory/applications` | `page`, `limit` (50, at most 50), `status` (`pending`, `approved`, `rejected`), `search` (name, email, handle, title, specialty) | `{ count, rows }`, newest first |
| GET | `/directory/applications/:id` | | The application: the form's fields (lists and objects parsed), `profile_image`, `gallery` (`[{ url, caption, is_thumbnail, sort_order }]`), `wants_access_card`, `place_id`, `status`, `review_note`, `reviewed_by`, `reviewed_at`; from the main location `business_name`, `city`, `state` (and its coordinates); `user_id` once approved. 404 `NOT_FOUND` |
| PUT | `/directory/applications/:id/status` | `{ status, note?, professional_type? }` | The application, with who reviewed it and when. Approving makes (or finds) the account for its email (`professional_type: "brand"` makes a new or app account a brand's, which goes by the business at the listing's main location, `business_name`), links it (`user_id`) and emails the person how to sign in, once. An account that is already a professional's keeps its type |
| PUT | `/directory/applications/:id` | Any of the form's fields; photos as on the form: `profile_image` (a file replaces it, `""` removes it), `images` (added, with `gallery_meta` for their captions, cover and order), `remove_photos` (a JSON list of photo links); at most 10 photos in all. `createAccessCard` is read as `wants_access_card` | The listing |
| POST | `/directory/applications/admin` | A listing's fields (`name`, `email` required), `status` (`approved` by default), `professional_type` | 201, the listing; approved, it makes the account as approval does |
| POST | `/directory/applications/delete` | `{ ids: [...] }` | `{ deleted }`; the photos are deleted too |

Approving lists the applicant on /directory (since Oct 23: the website's directory shows approved applications among
its profiles), and an application with `place_id` claims that Google listing (it leaves the Google results). Check
that the claim is genuine before approving: the applicant's email and phone are in the application. New claims come
through the Access form and are verified under Listing Claims (section 8.14).

### 8.6 Professional and brand pages (done Oct 23; the owner's design Nov 3)

| Method | Path | Body or query | Answers |
| --- | --- | --- | --- |
| GET | `/profiles/admin/list` | `search`, `type` (`brand`, `individual`), `featured`, `page`, `limit` (50) | `{ count, rows }` by name: the public row plus `featured_order`, `is_listed`, `created_by_admin`, `has_live_card`, `visible`, `claimed` (the account has a password) |
| GET | `/profiles/admin/:userId` | | `{ user_id, slug, page, visible, hidden_because, public }`: what is set on the page, whether it shows (`hidden_because`: `no_live_card`, `unlisted`) and the page as the public sees it |
| PUT | `/profiles/admin/:userId` | `slug` (3 to 60 letters, digits and dashes; free), `is_listed`, `is_featured`, `featured_order`, `tagline`, `about`, `website`, `social` (`[{ title, url }]`), `image`, `cover_image` (links from `POST /journal/upload`, or `""`); since Nov 3 `intro` (300 characters), `category`, `shipping` (`local`, `nationwide`, `international`), `about_image`, and the images as files as the owner sends them (`profile_image`, `images` the cover, `about_image`) | The same view |
| POST | `/profiles/admin/brands` | `name`, `email` (required), and any field above | 201, the view. The brand's account has no password; its page shows without a card. 409 `ACCOUNT_EXISTS` (`details.user_id`) when the email has an account: edit that account's page |
| POST | `/profiles/admin/:userId/invite` | | Emails a "Set your password" link (7 days) so the brand can sign in. 409 `ALREADY_CLAIMED` when the account has a password |

Refusals: 400 `INVALID_PAGE` with `details.field`.

**The owner's design (Mohit, Nov 3).** Pages get an `intro` for the hero, a Quick Info `category` (a brand's is one of
`skincare`, `haircare`, `makeup`, `nails`, `body`, `fragrance`, `wellness`, `devices`, shown "Skincare Brand"; a
professional's is a specialty's name, 60 characters) and `shipping`, and an `about_image`; the view's `page` answers
them (null when unset). Everything an owner edits, an admin edits on any professional or brand account's page with the
same fields and answers as the website's `/my/profile/...` calls (the website handoff, section 10.6.1): 404
`NOT_FOUND` for another kind of account or another page's item. Owners' items show at once; admins hide media and
unpublish education.

| Method | Path | Body or query | Answers |
| --- | --- | --- | --- |
| GET | `/profiles/admin/:userId/media` | `page`, `limit` (24, at most 100) | `{ count, rows }`: every item, hidden too, in order: `{ id, kind (image, video), source (upload, youtube, vimeo), url, thumbnail, embed_url, caption, alt, width, height, is_hidden, sort_order, from_card, created_at }` |
| POST | `/profiles/admin/:userId/media` | A form: `images` (up to 20), `videos` (MP4) with `video_thumbnails` (one each, or none), `captions` (JSON list); or JSON `{ url, caption?, alt? }` (YouTube or Vimeo) | 201 `{ rows }`, the items added (first on the page; marked as an admin's). The page's first add copies its card's gallery in first |
| POST | `/profiles/admin/:userId/media/import-card` | | `{ rows }`: the live card's gallery items the page lacks, added last |
| PUT | `/profiles/admin/:userId/media/order` | `{ ids }`: every item once | `{ ok: true }` |
| PUT | `/profiles/admin/:userId/media/:id` | `caption`, `alt`, `is_hidden` (`true` hides the item from the page) | The item |
| DELETE | `/profiles/admin/:userId/media/:id` | | `{ deleted: true }`: an upload's file goes too, unless something else shows it; a card file never |
| GET | `/profiles/admin/:userId/education` | `page`, `limit` (12, at most 100) | `{ count, rows }`: drafts too, in order, without `body`: `{ id, slug, kind (video, article), title, summary, cover_image, video, published_at, status, sort_order, created_at, updated_at }` |
| GET | `/profiles/admin/:userId/education/:id` | | The item with `body` |
| POST | `/profiles/admin/:userId/education` | `kind`, `title` (150), `summary` (300), `status` (`published` or `draft`), `body` (HTML, cleaned), `video_url` (YouTube or Vimeo) or the files `videos` + `video_thumbnails`, the cover as the file `images` or `cover_image` (a link) | 201, the item with `body` |
| PUT | `/profiles/admin/:userId/education/:id` | The same fields, each optional (`status: "draft"` takes an item off the page) | The item with `body` |
| PUT | `/profiles/admin/:userId/education/order` | `{ ids }`: every item once | `{ ok: true }` |
| DELETE | `/profiles/admin/:userId/education/:id` | | `{ deleted: true }` |
| POST | `/profiles/admin/:userId/uploads` | One image as the file `images` | 201 `{ location }`: its link, for an article's text or any image field |

### 8.7 Who an article features (done Oct 23)

Saving an article answers `unmatched_mentions`: the @handles in its text that match no page slug or card handle
(likely typos). The people it features:

| Method | Path | Body | Answers |
| --- | --- | --- | --- |
| GET | `/journal/:id/mentions` | | `{ mentions: [{ id, source, handle, excluded, account }], unmatched: [handle] }`. `source`: `text` (an @handle in the article) or `editor` (added here); `account`: `{ id, slug, name, type, visible }`, null when the handle matches no one |
| POST | `/journal/:id/mentions` | `{ user_id }` (a professional or brand account) | The same, with the account added: for an article about someone it never @mentions |
| PUT | `/journal/:id/mentions/:mentionId` | `{ excluded }` | The same. A text mention set aside stays aside when the article is saved again; `false` brings it back |
| DELETE | `/journal/:id/mentions/:mentionId` | | The same: an added account is removed; a text mention is set aside |

Refusals: 400 `INVALID_MENTION` with `details.field`; 404 `NOT_FOUND`.

### 8.8 Watch: series and videos (done Oct 23)

| Method | Path | Body or query | Answers |
| --- | --- | --- | --- |
| GET | `/video-series/admin` | | Every series, active or not |
| POST | `/video-series/admin` | `name`, `slug`?, `playlist_id` (an id or a playlist link), `sort_order`, `is_active` | 201, the series |
| PUT | `/video-series/admin/:id` | the same | The series |
| GET | `/videos/admin/list` | `series` (id or slug), `status` (`draft`, `published`), `search`, `page`, `limit` (50) | `{ count, rows }`: cards with `status` and `source` (`sync` or `admin`) |
| GET | `/videos/admin/:id` | | The video with `description`, `status`, `source`, `featured_order`, `people` (`[{ user_id, role }]`), `topic_ids` |
| PUT | `/videos/admin/:id` | `title`, `slug`, `description`, `series_id` (`""` for none), `status`, `is_featured`, `featured_order` | The video. A video taken off the site is `status: "draft"` (an imported one would come back if deleted) |
| PUT | `/videos/admin/:id/people` | `{ people: [{ user_id, role }] }`, role `host`, `guest` or `featured` | The video |
| PUT | `/videos/admin/:id/topics` | `{ topic_ids: [...] }`, in order | The video |
| POST | `/videos/admin/import` | `{ url, series_id? }`: a YouTube link | 201 `{ created: true, video }` with YouTube's title, description, thumbnail and duration; 200 `{ created: false, video }` when it is already here |
| POST | `/videos/admin/sync` | | Imports every active series' playlist now: `{ imported, series: [{ series, imported, error? }] }` |

Refusals: 400 `INVALID_VIDEO` with `details.field`; 503 `YOUTUBE_NOT_CONFIGURED` (no key on the server); 502
`YOUTUBE_UNAVAILABLE`.

### 8.9 The magazine (done Oct 23)

| Method | Path | Body or query | Answers |
| --- | --- | --- | --- |
| GET | `/magazine/admin/list` | `status`, `search` (title), `page`, `limit` (50) | `{ count, rows }`: issues with `status` and `sort_order` |
| GET | `/magazine/admin/:id` | | The issue with `features` (`[{ user_id, role, page_number }]`). The flipbook comes as the public card shows it (`flipbook`), not as the raw `publuu_account_id`, `publuu_flipbook_id` and `flipbook_url` that POST and PUT take: an issue that has both a link and Publuu ids (or only one id) comes back without its ids, and saving the form then erases them (A-OTH-6, backend fix pending) |
| POST | `/magazine/admin` | A form: `title` (required), `slug`?, `issue_number`, `publish_date` (YYYY-MM-DD), `publuu_account_id`, `publuu_flipbook_id`, `flipbook_url`, `short_description`, `status`, `sort_order` (the list runs highest first; the issue number when not given), `is_featured`; the cover as `images` (one file) or `cover_image` (an uploaded image's link) | 201, the issue |
| PUT | `/magazine/admin/:id` | The same fields | The issue |
| DELETE | `/magazine/admin/:id` | | `{ deleted: true }` |
| PUT | `/magazine/admin/:id/features` | `{ features: [{ user_id, role, page_number? }] }`, role `cover`, `featured` or `mentioned`: professional or brand accounts | The issue |

Refusals: 400 `INVALID_ISSUE` with `details.field`; 404 `NOT_FOUND`.

### 8.10 What people search for (done Oct 23)

`GET /search/admin/terms` (`sort` `top` or `empty`, `page`, `limit` 50): `[{ term, searches, last_results, last_searched_at }]`,
the most searched first, or with `sort=empty` the latest searches that found nothing (worth a page, a topic or a popular
search). Terms are lower-cased; nothing about who searched is kept.

### 8.11 Ad counts (done Oct 23)

| Method | Path | Query | Answers |
| --- | --- | --- | --- |
| GET | `/ads/admin/stats` | `from`, `to` (YYYY-MM-DD, optional) | `[{ ad_id, impressions, clicks, click_rate }]` (click rate in percent; null without views), for ads with any count |
| GET | `/ads/:id/stats` | the same | `{ ad_id, impressions, clicks, days: [{ day, impressions, clicks }] }` |

An impression is counted once an ad is half in view on the website. Refusals: 400 `INVALID_AD_EVENT`; 404.

### 8.12 Slugs for articles and products (done Oct 23)

Articles (`POST /journal`, `PUT /journal/:id`) and products (`POST /discover/shop`, `PUT /discover/shop/:id`) take an
optional `slug`, the page's address: written as a slug ("My Post" is my-post) and refused with 400 when another article
(`INVALID_INPUT`) or product (`INVALID_PRODUCT`) has it, `details.field: "slug"`. Without one, an article or product
gets one from its title when it is added, and keeps it when the title changes; an empty `slug` on an edit changes
nothing (it used to clear it). Worth showing next to the title, with a field to change it. Topics work differently:
renaming one makes a new slug unless `slug` is sent (section 9).

### 8.13 Page analytics (done Oct 23)

| Method | Path | Query | Answers |
| --- | --- | --- | --- |
| GET | `/profiles/admin/:userId/analytics` | `from`, `to` (YYYY-MM-DD; today when not given) | The page's views, unique visitors and clicks, as its owner sees them in the dashboard: `page`, `date_range`, `summary`, `events`, `daily_views`, `daily_clicks`, `device_breakdown`, `top_targets` (the website handoff, section 10.17) |

Since Nov 1 an owner on Free is refused their own numbers (403 `UPGRADE_REQUIRED`, `analytics`: profile analytics are
Access Pro's); this admin call, and the card analytics with an admin token, answer for every page and card.

### 8.14 Listing claims (Nov 1)

"Claim This Profile" on one of the directory's Google listings now opens the website's Access form, which fills itself
from the listing and keeps its `place_id` on the new card (`claimed_place_id`). The claim is never shown publicly. An
admin checks it; only a verified claim takes the Google listing out of the directory's Google results (as an
approved application's `place_id` does).

| Method | Path | Query or body | Answers |
| --- | --- | --- | --- |
| GET | `/directory/claims` | `status` (`pending` or `verified`; every claim without it), `page`, `limit` (12, at most 50) | `{ count, rows }`, claims to verify first, then newest: `{ business_card_id, name, business_name, email, professional_type, status, user_id, place_id, verified_at, created_at, maps_url }`. `status` is the card's own (a guest's draft too); `verified_at` is null while it waits; `maps_url` opens the listing on Google Maps, to compare with the card |
| PUT | `/directory/claims/:cardId` | `{ action: "verify" \| "reject" }` | The claim as it is now. Verify sets `verified_at` and takes the listing out of the Google results; 409 `PLACE_ALREADY_CLAIMED` ("Card N already has this listing.") when another card's verified claim has it. Reject clears the claim from the card and answers it with `place_id: null`, `verified_at: null` and `rejected: true`; the listing stays (or comes back). 404 `NOT_FOUND` for a card with no claim; 400 `INVALID_DIRECTORY_QUERY` for another `action` |

Check that the claim is genuine before verifying: the card's email and phone against the listing's.

## 9. Behaviour the sections above leave out (checked Oct 30)

**Answers**

- A missing id answers 200 with a string as `data` on these older calls: `GET /journal/findJournalById/:id`
  ("No Journal Found"), `GET /journalCategory/:id` ("No Category Found"), `GET /author/:id` ("No Author Found"),
  `GET /ads/findAdById/:id` ("No Ad Found"), `GET /admin/users/getUserById/:id` ("No User Found With this Id") and
  `GET /profession/:id` ("No Profession Found"). The newer calls answer 404 `NOT_FOUND`. Treat a string `data` as
  not found (X-2; the audit proposes 404 everywhere).
- Some older lists answer a plain array, not `{ count, rows }`: `GET /journal/topic`, `GET /podcast-schedule/list`,
  `GET /search/admin/terms`.

**Uploads**

- Each file may be up to 50 MB (more only if the server sets `UPLOAD_MAX_MB`; the runbook's nginx allows 100 MB a
  request); a bigger one is refused with "File is too large.". Each text field may be up to 1 MB, so an article body
  over 1 MB answers 400 "Field value too long" (A-CNT-20).
- Files are accepted only under these field names: `profile_image` (1), `images` (20), `videos` (10),
  `video_thumbnails` (10), `featured_link_images` (20), `gifs` (10), `docs` (10), `audios` (10), `csv_file` (1). A file
  under any other name answers 400 "Unexpected field".

**CSV import** (`POST /discover/:type/csv-upload`)

- The file goes in `csv_file`. Only the type `text/csv` is accepted today: a browser that types the file
  `application/vnd.ms-excel` (Windows with Excel) gets 400 "Error: Invalid file type! Allowed: Images, Videos, Audio,
  Docs." (A-CNT-5, backend fix pending).
- Answers `{ totalRows, inserted, skipped: [{ row, reason }] }`.
- Each row's image is downloaded inside the request, one at a time, so a large file can outlast Cloudflare (about
  100 s) and answer 524 or 504 while rows keep being added. Reload the list before trying again, or products are added
  twice (A-CNT-6).

**Journal, topics and products**

- `POST /journal` and `PUT /journal/:id` also take `faq_ids` and `topic_ids` (lists of ids), as
  `POST /journal/:id/faqs` and `/topics` do.
- `PUT /journal/topic/:id` makes a new slug from the name whenever `slug` is not sent, so renaming a topic changes its
  public address and old links break; send the current `slug` to keep it. Renaming a topic to a deleted topic's name
  answers 500 (A-CNT-13).
- `POST /journal/topic` with the name of a deleted topic brings that topic back (the same record, with what it linked
  before) instead of making a new one.
- `GET /journal/topic` takes `search` and `featured=true`. `GET /journal/topic/:id/paragraphs` takes the numeric id
  only (a slug answers 404), unlike `GET /journal/topic/:id`.
- Sending `""` to clear a field is ignored on most older edits: a category's description, podcast schedule fields, an
  article's image, author fields (A-CNT-15). A product's `price: ""` does clear it (`PUT /discover/shop/:id`).

**Card analytics**

- `GET /access-card/analytics/:businessCardId/events` pages with `limit` (default 100, at most 500) and `offset`,
  filters by `event_type`, and answers `{ count, rows }`.
- Days are UTC and the `timezone` header is ignored: an admin east of UTC who sends their local "today" as `to`
  between local and UTC midnight gets 400 "To date cannot be in the future" (A-ACC-12).

## Appendix: every admin endpoint

Checked against the code on Oct 30 (backend `master`, `aadb56a`): 259 routes need an admin token, sent as
`Authorization: Bearer <token>` (what the panel sends) or `x-access-token`; 262 since Nov 1 (the three new ones are
marked Nov 1) and 275 since Nov 3 (thirteen more for profile pages, marked Nov 3). Any active admin may call any of
them: roles and permissions are not checked yet (SEC-05). "(no screen)" marks a route the panel (`main`, Oct 30) never
calls: 38 of the 167 website and shared routes of Oct 30 (the panel's Nov 1–2 changes call the three new ones; no
screen calls the Nov 3 ones yet).

### Website and shared (183)

**/access** (`src/website/access-card/access.route.js`)

- `GET /access/admin/catalog`
- `PUT /access/admin/plans/:code`
- `PUT /access/admin/products/:code/price`
- `GET /access/admin/price-changes`
- `GET /access/admin/discounts`
- `POST /access/admin/discounts`
- `PATCH /access/admin/discounts/:id`
- `POST /access/admin/discounts/:id/end`
- `GET /access/admin/custom-prices`
- `POST /access/admin/custom-prices`
- `POST /access/admin/custom-prices/:id/end`
- `PUT /access/admin/settings`
- `GET /access/admin/subscriptions`
- `POST /access/admin/subscriptions/:userId/cancel`
- `PUT /access/admin/subscriptions/:userId/comp`

**/access-card** (`src/website/access-card/accessCardAnalytics.route.js`)

- `GET /access-card/analytics/overview`

**/admin** (`src/shared/admin/admin.route.js`)

- `GET /admin/profile`
- `PUT /admin/profile/:id` (no screen)
- `DELETE /admin/deleteAdmin`
- `GET /admin/list`
- `GET /admin/users/list/:roleId`
- `GET /admin/users/getUserById/:id`
- `POST /admin/users/delete`
- `GET /admin/user/login/timings`
- `DELETE /admin/user/login/timings/clear`
- `GET /admin/home/counts` (no screen)
- `GET /admin/home/payments` (no screen)
- `GET /admin/home/payments/all` (no screen)
- `POST /admin/user/approved` (no screen)
- `GET /admin/permissions` (no screen)
- `POST /admin/permissions` (no screen)
- `POST /admin/user/create` (no screen)
- `POST /admin/foundersToogle`

**/admin/auth** (`src/shared/admin/adminAuth.route.js`)

- `POST /admin/auth/register`
- `POST /admin/auth/logout`
- `POST /admin/auth/change-password`

**/ads** (`src/website/content/ad.route.js`)

- `POST /ads`
- `GET /ads/admin/stats`
- `GET /ads/:id/stats`
- `PUT /ads/sort-order` (no screen)
- `PUT /ads/:id`
- `POST /ads/delete`
- `PUT /ads/status/:id` (no screen)

**/author** (`src/website/content/author.route.js`)

- `POST /author`
- `PUT /author/:id`
- `POST /author/delete`

**/blog** (`src/website/content/blog.route.js`)

- `POST /blog` (no screen)
- `PUT /blog/update/:id` (no screen)
- `POST /blog/delete` (no screen)

**/blog-category** (`src/website/content/blogCategory.route.js`)

- `POST /blog-category` (no screen)
- `PUT /blog-category/:id` (no screen)
- `POST /blog-category/delete` (no screen)

**/businessCard** (`src/website/access-card/businessCard.route.js`)

- `POST /businessCard/createBusinessCardByAdmin`
- `POST /businessCard/delete`
- `GET /businessCard/getAllBusinessCards`
- `PUT /businessCard/updateBusinessCardStatus`
- `POST /businessCard/createCategory` (no screen)
- `PUT /businessCard/updateCategory/:id` (no screen)
- `POST /businessCard/deleteCategory` (no screen)
- `POST /businessCard/createDirectory`
- `PUT /businessCard/updateDirectory/:id`
- `POST /businessCard/deleteDirectory`
- `GET /businessCard/access-orders`
- `GET /businessCard/access-orders/:id`
- `PATCH /businessCard/access-orders/:id/fulfillment`
- `POST /businessCard/access-orders/:id/cancel` (Nov 1)
- `GET /businessCard/access-orders/:id/rates`
- `POST /businessCard/access-orders/:id/label`
- `POST /businessCard/access-orders/:id/label/void`

**/contactUs** (`src/website/inquiries/contactUs.route.js`)

- `PUT /contactUs/:id` (no screen)
- `GET /contactUs` (no screen)
- `GET /contactUs/all` (no screen)
- `DELETE /contactUs/:id` (no screen)

**/department** (`src/shared/admin/department.route.js`)

- `POST /department` (no screen)
- `PUT /department/:id` (no screen)
- `DELETE /department/:id` (no screen)

**/directory** (`src/website/inquiries/directoryApplication.route.js`)

- `GET /directory/applications`
- `POST /directory/applications/delete`
- `POST /directory/applications/admin`
- `GET /directory/applications/:id`
- `PUT /directory/applications/:id`
- `PUT /directory/applications/:id/status`

**/directory** (`src/website/directory/directory.route.js`)

- `GET /directory/claims` (Nov 1)
- `PUT /directory/claims/:cardId` (Nov 1)

**/discover** (`src/website/content/discover.route.js`)

- `POST /discover/:type`
- `GET /discover/:type/admin`
- `PUT /discover/:type/:id`
- `POST /discover/:type/delete`
- `POST /discover/:type/sort-order`
- `POST /discover/:type/csv-upload`

**/feature-request** (`src/website/inquiries/featureRequest.route.js`)

- `GET /feature-request/list`
- `POST /feature-request/delete`

**/form** (`src/website/professional-form/professionalForm.route.js`)

- `POST /form/createQuestions` (no screen)
- `PUT /form/editQuestion/:id` (no screen)
- `DELETE /form/deleteQuestion/:id` (no screen)
- `POST /form/updateStatus/:id`
- `POST /form/deleteForm/:id`
- `GET /form/getPendingFormCount`
- `GET /form/getUsersWhoSubmittedForm`
- `GET /form/getAllAnswersByUserId/:id`

**/guest-application** (`src/website/inquiries/guestApplication.route.js`)

- `GET /guest-application/list` (no screen)
- `GET /guest-application/:id` (no screen)
- `POST /guest-application/delete` (no screen)

**/journal** (`src/website/content/journal.route.js`)

- `POST /journal`
- `GET /journal/admin`
- `PUT /journal/:id`
- `POST /journal/delete`
- `POST /journal/upload`
- `POST /journal/sort-order`
- `POST /journal/faq`
- `PUT /journal/faq/:id`
- `POST /journal/faq/delete`
- `POST /journal/topic`
- `PUT /journal/topic/:id`
- `POST /journal/topic/delete`
- `POST /journal/:id/faqs`
- `GET /journal/:id/mentions`
- `POST /journal/:id/mentions`
- `PUT /journal/:id/mentions/:mentionId`
- `DELETE /journal/:id/mentions/:mentionId`
- `POST /journal/:id/topics`
- `PUT /journal/topic/:id/professionals`
- `PUT /journal/topic/:id/shops`
- `PUT /journal/topic/:id/podcasts`
- `PUT /journal/topic/:id/paragraphs`

**/journalCategory** (`src/website/content/journalCategory.route.js`)

- `POST /journalCategory`
- `PUT /journalCategory/:id`
- `POST /journalCategory/delete`

**/magazine** (`src/website/magazine/magazine.route.js`)

- `GET /magazine/admin/list`
- `POST /magazine/admin`
- `GET /magazine/admin/:id`
- `PUT /magazine/admin/:id`
- `DELETE /magazine/admin/:id`
- `PUT /magazine/admin/:id/features`

**/newsletter** (`src/website/inquiries/newsletter.route.js`)

- `GET /newsletter/list`
- `GET /newsletter/export`
- `POST /newsletter/delete`

**/notification** (`src/shared/notifications/notification.route.js`)

- `POST /notification` (no screen)

**/partnership-inquiry** (`src/website/inquiries/partnershipInquiry.route.js`)

- `GET /partnership-inquiry`
- `GET /partnership-inquiry/:id`
- `POST /partnership-inquiry/delete`

**/payment** (`src/shared/billing/payment.route.js`)

- `GET /payment/count` (no screen)
- `GET /payment/sum` (no screen)

**/podcast-schedule** (`src/website/content/podcastSchedule.route.js`)

- `POST /podcast-schedule/create`
- `PUT /podcast-schedule/update/:id`
- `DELETE /podcast-schedule/delete`

**/profession** (`src/shared/reference/profession.route.js`)

- `POST /profession`
- `PUT /profession/:id`
- `POST /profession/delete`

**/profiles** (`src/website/profiles/profile.route.js`)

- `GET /profiles/admin/list`
- `POST /profiles/admin/brands`
- `GET /profiles/admin/:userId`
- `PUT /profiles/admin/:userId`
- `POST /profiles/admin/:userId/invite`
- `GET /profiles/admin/:userId/analytics`
- `GET /profiles/admin/:userId/media` (Nov 3)
- `POST /profiles/admin/:userId/media` (Nov 3)
- `POST /profiles/admin/:userId/media/import-card` (Nov 3)
- `PUT /profiles/admin/:userId/media/order` (Nov 3)
- `PUT /profiles/admin/:userId/media/:id` (Nov 3)
- `DELETE /profiles/admin/:userId/media/:id` (Nov 3)
- `GET /profiles/admin/:userId/education` (Nov 3)
- `POST /profiles/admin/:userId/education` (Nov 3)
- `PUT /profiles/admin/:userId/education/order` (Nov 3)
- `GET /profiles/admin/:userId/education/:id` (Nov 3)
- `PUT /profiles/admin/:userId/education/:id` (Nov 3)
- `DELETE /profiles/admin/:userId/education/:id` (Nov 3)
- `POST /profiles/admin/:userId/uploads` (Nov 3)

**/role** (`src/shared/admin/role.route.js`)

- `POST /role` (no screen)
- `PUT /role/:id` (no screen)
- `DELETE /role/:id` (no screen)

**/search** (`src/website/search/search.route.js`)

- `GET /search/admin/terms`

**/settings** (`src/website/content/siteSettings.route.js`)

- `PUT /settings/home`

**/video-series** (`src/website/watch/videoSeries.route.js`)

- `GET /video-series/admin`
- `POST /video-series/admin`
- `PUT /video-series/admin/:id`

**/videos** (`src/website/watch/video.route.js`)

- `GET /videos/admin/list`
- `POST /videos/admin/import`
- `POST /videos/admin/sync`
- `GET /videos/admin/:id`
- `PUT /videos/admin/:id`
- `PUT /videos/admin/:id/people`
- `PUT /videos/admin/:id/topics`

### App back-office (92): the panel no longer calls these

The app's moderation, statistics, products, orders and payouts (`src/mobile`). The panel dropped these screens on
Oct 28 (`b75b38b`); the routes stay for the app phase, behind the same admin check.

**/admin** (`src/mobile/backoffice/backoffice.route.js`)

- `POST /admin/user/promoted`
- `POST /admin/user/unpromoted`
- `POST /admin/user/unpromotedAll`
- `GET /admin/user/getUserPromotions/:id`
- `GET /admin/user/getAllPromotionRequest`
- `GET /admin/home/appointments/all`
- `GET /admin/posts`
- `POST /admin/posts/delete`
- `GET /admin/reels`
- `POST /admin/reels/delete`
- `GET /admin/services`
- `DELETE /admin/services/:id`
- `POST /admin/service-list`
- `PUT /admin/updateServiceList/:id`
- `POST /admin/deleteServiceList`
- `POST /admin/create-service-list`
- `GET /admin/getAllReferral`
- `GET /admin/getAllReferralByProfessionalId/:id`
- `GET /admin/getAllGlamCoinRules`
- `PUT /admin/editGlamCoinRules/:id`
- `POST /admin/posts/getLikesByPostId`
- `POST /admin/posts/getCommentsByPostId`
- `POST /admin/reels/getLikessByReelId`
- `POST /admin/reels/getCommentsByReelId`
- `POST /admin/getFollowersByUserId`
- `POST /admin/getFollowByUserId`
- `POST /admin/getPostByUserId`
- `POST /admin/getPostLikeByUserId`
- `POST /admin/getPostCommentByUserId`
- `POST /admin/getClipsByUserId`
- `POST /admin/getClipsLikeByUserId`
- `POST /admin/getClipsCommentByUserId`
- `POST /admin/getReviewsGivenByUserId`
- `POST /admin/getReviewsTakenByUserId`
- `POST /admin/getServicesByUserId`
- `POST /admin/getBookingsByProfessionalId`
- `POST /admin/getBookingsByUserId`
- `POST /admin/getAvailablityByUserId`

**/admin/dashboard** (`src/mobile/backoffice/dashboard.route.js`)

- `GET /admin/dashboard/getUserCount`
- `GET /admin/dashboard/getProfessionalsCount`
- `GET /admin/dashboard/getPostsCount`
- `GET /admin/dashboard/getClipsCount`
- `GET /admin/dashboard/getAverageLikesPerPostCount`
- `GET /admin/dashboard/getAverageLikesPerClipCount`
- `GET /admin/dashboard/getAverageCommentPerPostCount`
- `GET /admin/dashboard/getAverageCommentPerClipCount`
- `GET /admin/dashboard/getAverageFollowersPerUser`
- `GET /admin/dashboard/getAverageFollowingPerUser`
- `GET /admin/dashboard/getAverageFollowingPerProfessional`
- `GET /admin/dashboard/getAverageFollowersPerProfessional`
- `GET /admin/dashboard/getAveragePostByUser`
- `GET /admin/dashboard/getAveragePostByProfessional`
- `GET /admin/dashboard/getAverageServicesPerProfessional`
- `GET /admin/dashboard/getMostPostedService`
- `GET /admin/dashboard/getMostBookedService`
- `GET /admin/dashboard/getMostBookedProfessional`
- `GET /admin/dashboard/getAverageBookingsPerProfessional`
- `GET /admin/dashboard/getMostBookedTimeSlots`
- `POST /admin/dashboard/getNewUsersRegistered`
- `POST /admin/dashboard/getNewProfessionalsRegistered`
- `POST /admin/dashboard/postUploadedStatistics`
- `POST /admin/dashboard/clipsUploadedStatistics`

**/brand** (`src/mobile/commerce/brand.route.js`)

- `GET /brand/getBrandById/:id`
- `PUT /brand/updateBrand/:id`
- `POST /brand/delete`

**/category** (`src/mobile/bookings/category.route.js`)

- `POST /category`
- `PUT /category/:id`
- `POST /category/delete`

**/faq** (`src/mobile/content/faq.route.js`)

- `POST /faq`
- `PUT /faq/:id`
- `DELETE /faq/:id`

**/order** (`src/mobile/commerce/order.route.js`)

- `GET /order/getAllOrders`
- `GET /order/getOrderById/:id`
- `POST /order/updateOrderStatus/:id`

**/product** (`src/mobile/commerce/productCategory.route.js`, `src/mobile/commerce/product.route.js`)

- `POST /product/category/createProductCategoryHeading`
- `POST /product/category/createProductCategory`
- `PUT /product/category/updateProductCategoryHeading/:id`
- `PUT /product/category/updateProductCategory/:id`
- `POST /product/category/delete`
- `POST /product/category/deleteProductCategory`
- `GET /product/getAllProductsForAdmin`
- `GET /product/getPendingProductCount`
- `POST /product/updateProductStatus/:id`

**/productType** (`src/mobile/commerce/productType.route.js`)

- `GET /productType/getProductTypeById/:id`
- `PUT /productType/updateProductType/:id`
- `POST /productType/delete`

**/service** (`src/mobile/bookings/service.route.js`)

- `POST /service/deleteServiceByAdmin`

**/stripe** (`src/mobile/commerce/payout.route.js`)

- `GET /stripe/getProfessionalPayoutSummary/:id`
- `POST /stripe/payout/professional`

**/taxCategory** (`src/mobile/commerce/numeralTaxCategory.route.js`)

- `POST /taxCategory/createTaxCategory`
- `PUT /taxCategory/updateTaxCategory/:id`
- `POST /taxCategory/delete`
