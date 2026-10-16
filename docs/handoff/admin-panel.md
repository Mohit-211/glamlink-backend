# Admin panel: backend API changes for the cutover

For: the Claude working on the Glamlink admin panel.
Backend: `api.glamlink.net`, all routes under `/api/v1`. Backend branch: `phase3/identity`.

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
- [ ] Build URLs without a double slash: 26 calls produce `/api/v1//journal/...`, which the API answers with 404.
- [ ] `VITE_API_BASE_URL=https://api.glamlink.net/api/v1/`, `VITE_IMAGE_BASE_URL=https://api.glamlink.net/images/`,
      `VITE_VIDEO_BASE_URL=https://api.glamlink.net/videos/` (files are served at the root, not under `/api/v1`).
- [ ] Three paths: `admin/getAllReferralByBeauticianId/:id` is `admin/getAllReferralByProfessionalId/:id`;
      `admin/getBookingsByCounsellorId` is `admin/getBookingsByProfessionalId`; deleting an admin is
      `DELETE admin/deleteAdmin` (the panel calls `admin/auth/deleteAdmin`, which does not exist).
- [ ] Request bodies: `getReviewsTakenByUserId` and `getAvailablityByUserId` send `professional_id`, not `counselor_id`.
- [ ] "Add admin" must send `password` and `department_id`; the backend requires both.
- [ ] When an admin call answers 401 (`code: "ADMIN_SESSION_EXPIRED"` or `"ADMIN_SIGN_IN_REQUIRED"`), end the session and go
      to sign-in. The panel currently looks for the messages `jwt expired` / `invalid token`, which the API no longer sends.

## Changelog

Newest first. Each entry says what changed in the API and what the admin panel must (or can) do.

| Date | Change | Admin panel |
| --- | --- | --- |
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

- Unchanged: `POST /admin/auth/login` returns the admin token; send it as `x-access-token` on every admin
  call. `POST /admin/auth/otp`, `/verify-otp`, `/forgot-password` and `/change-password` are unchanged.
- `POST /admin/auth/register` (create another admin) needs an admin token; it is not open any more.
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
  Gallery: up to 4 photos and 1 video (the panel allows 20 today).
- **New screens:** plans (name, tagline, badge, features, order), prices (with "move subscribers at their next
  renewal"), site-wide discounts, personal prices for one client, settings (Free and Pro features, shipping,
  ship-from address and parcel), subscriptions (status, cancel).
- **Access orders:** buy and void the shipping label, tracking status from Shippo.
- **Cards:** guest drafts listed apart from live cards; creating a card for an email whose account already has a
  card answers `CARD_EXISTS` (or replaces it when asked).

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
