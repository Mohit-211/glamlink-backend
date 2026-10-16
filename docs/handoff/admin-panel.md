# Admin panel: backend API changes for the cutover

For: the Claude working on the Glamlink admin panel.
Backend: `api.glamlink.net`, all routes under `/api/v1`. Backend branch: `phase5/security` (it holds every earlier phase).

The backend and its clients ship together in one cutover. Admin sign-in itself is unchanged; what changed
is which endpoints exist, some field names, and the account model behind the user screens. Anything not
mentioned answers as before.

**Status:** the admin panel (the local TS/Vite refactor) is frozen until the backend is ready; this note collects
everything to do then. The new backend runs at `https://api.glamlink.net` (all routes under `/api/v1`), replacing
`https://node.glamlink.net`.

## Checklist before the switch

Found by reviewing the admin panel code (Oct 16) against the new backend. Details in the sections below.

- [ ] One API client that sends the admin token on **every** call. Today 124 of 204 calls send none (41 of them
      change data), and every admin endpoint now refuses a missing token. `x-access-token` and
      `Authorization: Bearer` both work.
- [ ] When convenient: build URLs without a double slash. 26 calls produce `/api/v1//journal/...`; the API now
      treats `//` as `/`, so they work.
- [ ] `VITE_API_BASE_URL=https://api.glamlink.net/api/v1/`, `VITE_IMAGE_BASE_URL=https://api.glamlink.net/images/`,
      `VITE_VIDEO_BASE_URL=https://api.glamlink.net/videos/` (files are served at the root, not under `/api/v1`).
- [ ] Three paths: `admin/getAllReferralByBeauticianId/:id` is `admin/getAllReferralByProfessionalId/:id`;
      `admin/getBookingsByCounsellorId` is `admin/getBookingsByProfessionalId`; deleting an admin is
      `DELETE admin/deleteAdmin` (the panel calls `admin/auth/deleteAdmin`, which does not exist).
- [ ] Request bodies: `getReviewsTakenByUserId` and `getAvailablityByUserId` send `professional_id`, not `counselor_id`.
- [ ] "Add admin" must send `password`; `department_id` is optional now.
- [ ] When an admin call answers 401 (`code: "ADMIN_SESSION_EXPIRED"` or `"ADMIN_SIGN_IN_REQUIRED"`), end the session and go
      to sign-in. The panel currently looks for the messages `jwt expired` / `invalid token`, which the API no longer sends.
      A 401 always means "sign in again" (no endpoint answers 401 for a role); the app's screens (posts, reels,
      services, appointments, categories) answer the same way now.
- [ ] Sign-in: a failure is 401 `INVALID_CREDENTIALS` "Invalid email or password." whatever the reason; show it, and
      don't treat a 401 from the login call as an ended session. Sign-out: call `POST /admin/auth/logout` with the
      token, then clear it. Sessions last 12 hours.
- [ ] Card gallery: up to 20 photos and 1 video for admins (not 4: that is the owners' limit).
- [ ] No template words left in the panel: read `appointment_professional` instead of `appointment_counselor`
      (Appointments, ProfessionalBooking, UserBookings, Dashboard), rename `GetBookingsByCounsellorId` and
      `GetAllReferralByBeauticianId` with their endpoints (above), and say "Professional" in the founder messages
      ("Beautician is marked as Founder.").

## Changelog

Newest first. Each entry says what changed in the API and what the admin panel must (or can) do.

| Date | Change | Admin panel |
| --- | --- | --- |
| Oct 16 | **Template names gone from the data:** the admin permissions of the professionals section are now `professional`, `create-professional`, `view-professional`, `update-professional`, `delete-professional` ("Professional", was "Esthetician"); GlamCoin rules 11 and 12 are titled "Follow a Professional/User" and "Unfollow a Professional/User" (rules are still found by `action`) | **Must:** if the panel matches a permission slug, use the new ones (it does not today). Also the checklist's item on template words |
| Oct 16 | **Admin sign-in** (the panel's security questions, answered in that doc): a failed login is 401 `INVALID_CREDENTIALS` "Invalid email or password." for an unknown email, a wrong password and a deactivated admin alike (it was 400 "User not found." or another message). Tokens last 12 hours (`ADMIN_TOKEN_HOURS`; it was 5 days). New `POST /admin/auth/logout` ends every session of that admin; changing or resetting the password does too (the next call answers 401 `ADMIN_SESSION_EXPIRED`). `POST /admin/auth/otp` answers the same for any email. The app's admin screens (`/admin/posts`, `/admin/reels`, `/admin/services`, `/admin/home/appointments/all`, `/admin/user/promoted`, `/admin/service-list`, `/category` writes) now use the same check as every admin route: Bearer accepted, a deactivated admin refused, 401 with a code instead of 400 or 500 (`jwt expired`) | **Must:** show the login error; call logout on sign-out; after a password change, show sign-in |
| Oct 16 | **For the panel as it is:** a URL with a double slash (`/api/v1//journal/topic`) reaches its route; "Add admin" needs no `department_id` (`ADM_DEPT_ID` is used); the card gallery takes up to 20 photos from an admin (owners stay at their plan's 4; an owner can't add to a card over that). Uploads take up to 20 `images` per request | **Must:** cap the gallery at 20 photos and 1 video (the 4-photo entry below was for owners) |
| Oct 16 | **Plan features enforced for owners** (the website note's section 9.6): on a live card, Free owners cannot change photos, video or the profile image or run offers; admins are not limited. What each plan allows is the `entitlements` setting (section 7.1) | **Can:** show the settings' entitlements on the pricing screen so they can be changed |
| Oct 16 | **Keychain labels and tracking with Shippo** (section 7.3): on an access order, `GET …/rates`, `POST …/label` (buys the label: the rate chosen at checkout, or today's), `POST …/label/void`. The order gains `carrier`, `service`, `label_url` (the PDF to print), `tracking_number`, `tracking_link`, `tracking_status`, `shipped_at`, `delivered_at`; Shippo's tracking moves it to shipped and delivered. Addresses gain `address_line_2`, `recipient_name`, `phone`, `city_name`, `purpose`, `address_type`, `validation_result` | **New on the order screen:** "Buy label" (and a rate picker from `…/rates`), "Print label" (`label_url`), "Void label", the tracking status. The manual fulfillment update still works |
| Oct 16 | **Subscriptions and payments** (section 7.2): every Access Pro subscription is a seat, paid through Stripe or complimentary (given by an admin; 23 accounts on the live copy have Pro without paying). New: `GET /access/admin/subscriptions`, `POST /access/admin/subscriptions/:userId/cancel`, `PUT /access/admin/subscriptions/:userId/comp`. A price change can move paying subscribers (`move_subscribers`; it now answers `{ product, moved, failed }`), a personal price can go on a live subscription (`apply_now`). Every paid purchase now makes an access order (Access Pro alone too, with no fulfillment status); the admin's order email links to the order in the panel | **New screen:** subscriptions (list, cancel, give or take back complimentary Pro). **Must:** the access orders list shows orders whose `fulfillment_status` is null (nothing to ship) |
| Oct 16 | **Access pricing screens** (section 7.1): plans, prices (with history), site-wide discounts, personal prices for one client, and settings (what Free and Pro may do, shipping), under `/access/admin/…` | **New screens** (none exist): see section 7.1 |
| Oct 16 | **Guest drafts and one card per person.** A card a guest makes on the website is a draft until a plan is chosen or paid. `GET /businessCard/getAllBusinessCards` leaves drafts out; `?status=draft` lists them (`?status=pending`, `accepted` or `rejected` filters too). `createBusinessCardByAdmin` for an email whose account already has a card answers 409 `CARD_EXISTS` (`details.card_id`); send `replace=true` to replace it (the old card is deleted but kept, and the new one takes its link and QR code). The card's `status` can be `draft` | **Can:** a "Drafts" view (`?status=draft`). **Must:** handle `CARD_EXISTS` on "Create card" (offer replace) |
| Oct 16 | **Card create and edit use the website form's fields and checks** (the backend's `docs/access.md` section 1; the website handoff note's section 9.1 lists every rule). A refusal is 400 `INVALID_CARD` with `details: { field }`. Up to 4 photos and 1 MP4 video, a thumbnail per video; bio up to 80 characters of text; phone 10 digits while shown. No longer saved: `custom_handle`, `primary_specialty` (the first specialty is used), `elite_setup`, `excites_about_glamlink`, `biggest_pain_points`, per-location phone and description. Business hours: lines of text (`[{ note }]`). `getBusinessCardById/:id` returns the whole card only with an admin token (or the owner's); without one, the public card | **Must:** limit the gallery to 4 photos and 1 video (it allows 20), drop the removed fields from the form, show `details.field` errors. Captions: send `new_images_gallery_meta` (one per new photo) and `existing_images_gallery_meta` (one per kept photo, in `existing_image_ids` order); `gallery_meta` is read only for new photos |
| Oct 16 | Coming (Phase 2b): the Access redesign in the backend's `docs/access.md`. Section 7 lists the new screens and changes; each part gets its own entry here when it lands | Nothing yet |
| Oct 16 | The card bio is cleaned on save with the allow-list of the website's bio editor (paragraphs, bold, italic, underline, strike, h3, lists, quotes, links). The panel edits the bio with the journal editor (fonts, colours, alignment, tables, images, video); anything outside the list is removed when the card is saved | **Must:** edit the card bio with an editor limited to the website's formatting and its 80-character limit |
| Oct 16 | CORS: no `Access-Control-Allow-Origin: *` any more; only the origins in `ACCESSDOMAINS` (production: `https://admin.glamlink.net`) get CORS headers; others get 403 `ORIGIN_NOT_ALLOWED`. `PUT /ads/sort-order` now works (it was caught by `PUT /ads/:id`) | Nothing, as long as the panel runs on a listed origin (local: ask for its dev URL, e.g. `http://localhost:3000`) |
| Oct 16 | `GET /journal/topic/:id` returns professionals' emails only with an admin token (the panel's topic screens send one) | Nothing |
| Oct 16 | Errors: unexpected failures answer `500` with "An internal server error occurred." instead of the raw database message (website and shared endpoints). Admin 401s carry a code: `ADMIN_SIGN_IN_REQUIRED` (no token, "Admin authentication required") or `ADMIN_SESSION_EXPIRED` ("Invalid or expired admin token"), messages unchanged | **Can:** end the session on either code (see the checklist) |
| Oct 16 | One admin check on every admin route outside the app screens: the token is accepted as `x-access-token` or `Authorization: Bearer` everywhere (the old check on `/admin/*` refused Bearer). A deactivated admin can no longer sign in (`400 User not found.`) or verify an admin OTP. `POST /admin/auth/change-password` checks the token before the body, so a missing token answers 401 instead of 400 | Nothing required; Bearer can now be used on every call |
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
  `/verify-otp` is unchanged.
- `POST /admin/auth/register` (create another admin) needs an admin token; it is not open any more. `name`, `email`,
  `password`, `role_id` required; `department_id` optional.
- Every admin endpoint (the appendix lists all 199) requires an active admin's token. Website/app user
  tokens are refused on admin routes, and admin tokens are not user sessions.
- Error responses keep `{ success: false, status, message, data: "" }`; some now add a `code` field.

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
| User objects (e.g. `GET /admin/users/getUserById/:id`) | | adds `account_type` (`user` \| `professional` \| `staff`), `professional_type` (`individual` \| `brand`, professionals only), `email_verified_at`, `downgraded_at`, `merged_into_user_id` |
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
  7 professional, 8 brand, 9 staff, so `GET /admin/users/list/:roleId` works as before.
- **Duplicate accounts were merged.** Where one email had several accounts (an app account and a
  professional account for the same person: 12 accounts across 10 emails), everything moved to the
  professional account. The merged accounts are soft-deleted with `merged_into_user_id` set, so they
  disappear from lists and user counts drop accordingly.
- **Email verification** is `email_verified_at` (set for everyone whose `status` was `ACCEPTED`). `status`
  still exists.
- **Creating a user** (`POST /admin/user/create`): `role_id` must be 6, 7 or 8 (user, professional, brand);
  the account is created verified. An email already used by any account is refused (`400 Email already
  taken`; it used to be allowed once per role).
- **Access card buyers without an account** get a professional account with no password and a welcome
  email to set one (valid 7 days). Until they set it, they cannot sign in; an admin does not need to do
  anything.
- **Deleting a user** also ends all of their sign-in sessions immediately.

## 6. Not changed

Journal, journal categories, authors, blog, podcast schedule, discover (shop/education/events), ads, FAQ,
contact, guest applications, partnership inquiries, Access card and access-order management, products and
orders for admins, categories, professions, departments, roles: same endpoints and payloads (apart from the
field renames above where those objects include users or bookings).

## 7. Coming: Access cards, plans and payments (Phase 2b)

Designed Oct 16 in the backend's `docs/access.md` (section 8); each part is logged in the changelog when it lands.

- **The card form** shows exactly the website's fields (`docs/access.md` section 1). No longer saved:
  `custom_handle`, `primary_specialty` (it is the first specialty), `elite_setup`, `excites_about_glamlink`,
  `biggest_pain_points`, per-location phone and description. `location_type` is `exact_address` or `city_only`.
  Gallery: up to 20 photos and 1 video for an admin (owners: their plan's 4).
- **New screens:** plans (name, tagline, badge, features, order), prices (with "move subscribers at their next
  renewal"), site-wide discounts, personal prices for one client, settings (Free and Pro features, shipping,
  ship-from address and parcel), subscriptions (status, cancel).
- **Access orders:** buy and void the shipping label, tracking status from Shippo.
- **Cards:** guest drafts listed apart from live cards; creating a card for an email whose account already has a
  card answers `CARD_EXISTS` (or replaces it when asked).

### 7.1 Pricing (done Oct 16)

All under `/api/v1/access/admin`, admin token required. Amounts are whole cents (USD). Errors: 400 `INVALID_INPUT`
with `details.field`, 404, 409 `DISCOUNT_OVERLAPS`.

| Method | Path | Body / query | What it does |
| --- | --- | --- | --- |
| GET | `/catalog` | | Products (list prices), plans, settings, discounts, the running discount: everything the pricing screens show |
| PUT | `/plans/:code` | any of `name`, `label`, `badge`, `tagline`, `features` (`[{ text, soon?, highlight? }]`), `products` (`["pro","keychain"]`), `sort_order`, `is_active` | Edits a plan as the website shows it |
| PUT | `/products/:code/price` | `{ amount_cents }` (at least 50) | New list price for `pro` (monthly) or `keychain`. New purchases pay it; subscribers keep their price (moving them comes with the Stripe step) |
| GET | `/price-changes` | | Price change history (who, when, before, after) |
| GET | `/discounts` | | Discounts, newest first |
| POST | `/discounts` | `name`, `percent_off` or `amount_off_cents`, `applies_to` (`["pro"]`, `["keychain"]` or both), `duration` (`once`, `repeating` with `duration_in_months`, `forever`: how long it lasts on Access Pro), `starts_at` (default now), `ends_at` (optional) | A site-wide sale. Only one runs at a time (409 `DISCOUNT_OVERLAPS`) |
| PATCH | `/discounts/:id` | `name`, `ends_at` | Rename, or move the end. To change what it takes off, end it and make a new one |
| POST | `/discounts/:id/end` | | Ends it now |
| GET | `/custom-prices` | `?user_id=`, `?email=`, `?active=true` | Personal prices |
| POST | `/custom-prices` | `user_id` or `email`, `product_code`, `amount_cents`, `note`, `ends_at` (optional) | A price for one client (an email works before they have an account). Replaces their earlier one for that product; beats a running sale |
| POST | `/custom-prices/:id/end` | | Ends it |
| PUT | `/settings` | any of `entitlements` (`{ free, pro }` each with `photos`, `videos`, `edit_details`, `edit_media`, `special_offers`, `analytics`, `priority_search`), `keychains_per_person`, `shipping` (`mode` live/flat/free, `flat_amount_cents`, `countries` US/CA, `parcel` dimensions and weight) | Each setting sent replaces the stored one whole; answers all settings |

### 7.2 Subscriptions (done Oct 16)

| Method | Path | Body / query | What it does |
| --- | --- | --- | --- |
| GET | `/access/admin/subscriptions` | `?status=active`, `?source=stripe` or `comp` | Seats: `user_id`, `source`, `status` (Stripe's: active, past_due, canceled, …), `amount_cents`, `current_period_end`, `cancel_at_period_end` |
| POST | `/access/admin/subscriptions/:userId/cancel` | `{ now: true }` to end at once | Ends a person's Access Pro at the end of their paid month (or now) |
| PUT | `/access/admin/subscriptions/:userId/comp` | `{ active: true\|false }` | Gives or takes back complimentary Pro (409 `SUBSCRIPTION_PAID` for someone who pays) |
| PUT | `/access/admin/products/:code/price` | add `move_subscribers: true` | Also moves paying subscribers without a personal price to the new price from their next renewal |
| POST | `/access/admin/custom-prices` | add `apply_now: true` | Also puts the personal price on the client's live subscription from their next renewal |

### 7.3 Labels and tracking (done Oct 16)

| Method | Path | Body | What it does |
| --- | --- | --- | --- |
| GET | `/businessCard/access-orders/:id/rates` | | Today's Shippo rates for the order's parcel: `[{ rate_id, amount_cents, provider, service, estimated_days }]` |
| POST | `/businessCard/access-orders/:id/label` | `{ rate_id }` optional | Buys the label: `rate_id`, else the rate chosen at checkout, else today's rate for the same service (or the cheapest). The order moves to `processing` with its tracking number and `label_url`. 409 `LABEL_EXISTS`, 502 `LABEL_FAILED` (with Shippo's reasons), 400 `NOTHING_TO_SHIP` |
| POST | `/businessCard/access-orders/:id/label/void` | | Voids an unused label (Shippo refunds it); the order goes back to `pending`. 409 `LABEL_IN_USE` once shipped |

Shippo's webhook then updates `tracking_status` (PRE_TRANSIT, TRANSIT, DELIVERED, RETURNED, FAILURE) and moves
the order to `shipped` and `delivered` (never backwards).

## Appendix: every admin endpoint

All need an admin token in `x-access-token`.

**/access-card**

- `GET /access-card/analytics/overview`

**/admin**

- `GET /admin/profile`
- `PUT /admin/profile/:id`
- `DELETE /admin/deleteAdmin`
- `GET /admin/list`
- `GET /admin/users/list/:roleId`
- `GET /admin/users/getUserById/:id`
- `POST /admin/users/delete`
- `GET /admin/user/login/timings`
- `DELETE /admin/user/login/timings/clear`
- `POST /admin/user/promoted`
- `POST /admin/user/unpromoted`
- `POST /admin/user/unpromotedAll`
- `GET /admin/user/getUserPromotions/:id`
- `GET /admin/user/getAllPromotionRequest`
- `GET /admin/home/counts`
- `GET /admin/home/payments`
- `GET /admin/home/payments/all`
- `GET /admin/home/appointments/all`
- `POST /admin/user/approved`
- `GET /admin/permissions`
- `POST /admin/permissions`
- `POST /admin/user/create`
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
- `POST /admin/foundersToogle`
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

**/admin/auth**

- `POST /admin/auth/register`
- `POST /admin/auth/change-password`
- `POST /admin/auth/logout`

**/admin/dashboard**

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

**/ads**

- `POST /ads`
- `PUT /ads/:id`
- `POST /ads/delete`
- `PUT /ads/status/:id`
- `PUT /ads/sort-order`

**/author**

- `POST /author`
- `PUT /author/:id`
- `POST /author/delete`

**/blog**

- `POST /blog`
- `PUT /blog/update/:id`
- `POST /blog/delete`

**/blog-category**

- `POST /blog-category`
- `PUT /blog-category/:id`
- `POST /blog-category/delete`

**/brand**

- `GET /brand/getBrandById/:id`
- `PUT /brand/updateBrand/:id`
- `POST /brand/delete`

**/businessCard**

- `POST /businessCard/createBusinessCardByAdmin`
- `POST /businessCard/delete`
- `GET /businessCard/getAllBusinessCards`
- `PUT /businessCard/updateBusinessCardStatus`
- `POST /businessCard/createCategory`
- `PUT /businessCard/updateCategory/:id`
- `POST /businessCard/deleteCategory`
- `POST /businessCard/createDirectory`
- `PUT /businessCard/updateDirectory/:id`
- `POST /businessCard/deleteDirectory`
- `GET /businessCard/access-orders`
- `GET /businessCard/access-orders/:id`
- `PATCH /businessCard/access-orders/:id/fulfillment`

**/category**

- `POST /category`
- `PUT /category/:id`
- `POST /category/delete`

**/contactUs**

- `PUT /contactUs/:id`
- `GET /contactUs`
- `GET /contactUs/all`
- `DELETE /contactUs/:id`

**/department**

- `POST /department`
- `PUT /department/:id`
- `DELETE /department/:id`

**/discover**

- `POST /discover/:type`
- `GET /discover/:type/admin`
- `PUT /discover/:type/:id`
- `POST /discover/:type/delete`
- `POST /discover/:type/sort-order`
- `POST /discover/:type/csv-upload`

**/faq**

- `POST /faq`
- `PUT /faq/:id`
- `DELETE /faq/:id`

**/form**

- `POST /form/createQuestions`
- `PUT /form/editQuestion/:id`
- `DELETE /form/deleteQuestion/:id`
- `POST /form/updateStatus/:id`
- `POST /form/deleteForm/:id`
- `GET /form/getPendingFormCount`
- `GET /form/getUsersWhoSubmittedForm`
- `GET /form/getAllAnswersByUserId/:id`

**/guest-application**

- `GET /guest-application/list`
- `GET /guest-application/:id`
- `POST /guest-application/delete`

**/journal**

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
- `POST /journal/:id/topics`
- `PUT /journal/topic/:id/professionals`
- `PUT /journal/topic/:id/shops`
- `PUT /journal/topic/:id/podcasts`
- `PUT /journal/topic/:id/paragraphs`

**/journalCategory**

- `POST /journalCategory`
- `PUT /journalCategory/:id`
- `POST /journalCategory/delete`

**/notification**

- `POST /notification`

**/order**

- `GET /order/getAllOrders`
- `GET /order/getOrderById/:id`
- `POST /order/updateOrderStatus/:id`

**/partnership-inquiry**

- `GET /partnership-inquiry`
- `GET /partnership-inquiry/:id`
- `POST /partnership-inquiry/delete`

**/payment**

- `GET /payment/count`
- `GET /payment/sum`

**/podcast-schedule**

- `POST /podcast-schedule/create`
- `PUT /podcast-schedule/update/:id`
- `DELETE /podcast-schedule/delete`

**/product**

- `POST /product/category/createProductCategoryHeading`
- `POST /product/category/createProductCategory`
- `PUT /product/category/updateProductCategoryHeading/:id`
- `PUT /product/category/updateProductCategory/:id`
- `POST /product/category/delete`
- `POST /product/category/deleteProductCategory`
- `GET /product/getAllProductsForAdmin`
- `GET /product/getPendingProductCount`
- `POST /product/updateProductStatus/:id`

**/productType**

- `GET /productType/getProductTypeById/:id`
- `PUT /productType/updateProductType/:id`
- `POST /productType/delete`

**/profession**

- `POST /profession`
- `PUT /profession/:id`
- `POST /profession/delete`

**/role**

- `POST /role`
- `PUT /role/:id`
- `DELETE /role/:id`

**/service**

- `POST /service/deleteServiceByAdmin`

**/stripe**

- `GET /stripe/getProfessionalPayoutSummary/:id`
- `POST /stripe/payout/professional`

**/taxCategory**

- `POST /taxCategory/createTaxCategory`
- `PUT /taxCategory/updateTaxCategory/:id`
- `POST /taxCategory/delete`
