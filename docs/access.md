# Access: the card, plans, pricing, payments and shipping

The design for Phase 2b's Access work (Oct 16, 2026), now built (steps 1 to 6 in progress.md; what each frontend
does with it is in the handoff notes). Changed on Nov 1–2 (built and tested, not deployed; progress.md): the card says
whether it is a professional's or a brand's, locations and a brand's title, specialties and booking method are optional,
a card can claim a Google listing, special offers are retired, Access Pro is $9.99, and the purchase follows Stripe
itself instead of waiting on the webhook alone (sections 1, 2, 5, 6 and 12). What Mohit asked for:

- The card has precisely the fields of the website's card form, and the admin panel edits the same fields.
- The plans work as the website lists them (Free, Keychain, Access Pro, Pro + keychain), and plans can change later.
- The features of each plan are the ones on the pricing page (below).
- The keychain is a one-time purchase of a physical NFC keychain, shipped to the buyer.
- Guests build their card on /access to see what they get, then pay. Every situation is covered: signed in with
  or without a card, signed out with an email that already has an account, and so on.
- One person has one Access card. They can delete it and make another on the same subscription ("seat").
- Admins can raise or lower prices, give one client a personal price, and run a site-wide discount.
- Stripe and Shippo are updated to their current SDK and API and used as their documentation recommends:
  subscriptions, address checks, shipping rates, labels, tracking.

Items marked **Default** are choices made here that can be changed: most are admin settings.

## 1. The card: the website's fields

The API accepts these fields on create and edit (public, owner and admin alike), checks them the way the website
form does, and ignores anything else. The admin panel shows exactly these.

| Field | Rules |
| --- | --- |
| `professional_type` | Who the card is for (Nov 1): `individual` (a beauty or wellness professional; the default when none is sent) or `brand`; anything else is 400 `INVALID_CARD` [`professional_type`]. Brands and professionals use the same form; a brand's title, specialties and booking method are optional. The account takes the card's type when it is made or converted for the card, or, for an existing professional, while nothing depends on its own type yet (section 5). An edit that sends it changes the card's type only, not the account's (pages, products and the directory read the account's) |
| `claimed_place_id` | Create only (Nov 1): the Google listing the person claims from the directory ("Claim This Profile"), 10 to 255 letters, digits, `_` or `-` (else 400 `INVALID_CARD` [`claimed_place_id`]). Never in a public answer. An admin verifies it (section 8); then the listing leaves the directory's Google results |
| `name`, `business_name` | Required, text |
| `professional_title` | Required for a professional; optional for a brand (Nov 1) |
| `email` | Required. The card's public contact email (also the account email for a guest purchase) |
| `phone`, `is_phone_visible` | 10 digits; required while `is_phone_visible` (default true). Hidden phones are left out of every public response |
| `bio` | Required. Rich text from the bio editor, cleaned on save (allow-list), at most 80 characters of text |
| `color_code` | `#RRGGBB`, default `#24BBCB` |
| `specialties` | 1 to 5; 0 to 5 for a brand (Nov 1) |
| `locations` | Optional since Nov 1: 0 to 10, and `[]` clears them; a card with none shows no location. Each one: `label`, `location_type` (`exact_address` with `address`, or `city_only` with `city` and `state`), `latitude`/`longitude`, one `is_primary` (`isPrimary` accepted too) |
| `business_hour` | Lines of free text: `[{ note }]` |
| `website`, `social_media` | `instagram`, `instagram1`, `instagram2`, `tiktok`, `linkedin`, `youtube`, `facebook` |
| `other_links` | `[{ title, url }]` |
| `featured_links` | `[{ title, url, image, is_featured, sort_order }]`, at most one featured |
| `preferred_booking_method` | One or more of `GO_TO_BOOKING_LINK`, `CALL_TEXT`, `DM_INSTAGRAM` (any letter case); none is allowed for a brand (Nov 1). A booking link (or website) is required for the first, an Instagram handle for the last |
| `booking_link`, `important_info` | Optional |
| `profile_image`, `images`, `videos` (+ `video_thumbnails`) | Profile image required. Up to 4 photos and 1 video (MP4, up to 60 s): the plan limits below. Captions per item |
| `offer_promotion`, `promotion_details` | Retired: special offers ended Oct 23, and since Nov 1 the API ignores these on input and leaves them out of every card answer (the stored values stay) |

No longer accepted (the stored values stay): `custom_handle`, `elite_setup`, `excites_about_glamlink`,
`biggest_pain_points`, and per-location `phone`, `description`, `business_name`. `primary_specialty` is the first
specialty (the directory pages group cards by it).

## 2. Plans and features

Plans are stored, not hard-coded: name, tagline, badge, the feature list shown, the order, and which products they
include. `GET /access/plans` serves them with current prices; admins edit them.

| Plan (code) | Includes | Price today |
| --- | --- | --- |
| Free access (`free`) | Free features | $0 |
| Keychain (`nfc_only`) | Free features + keychain | $39.99 one-time |
| Access Pro (`subscription_only`) | Free and Pro features | $9.99 / month |
| Pro + keychain (`nfc_with_subscription`, "Most popular") | Free and Pro features + keychain | $9.99 / month + $39.99 one-time |

Access Pro is $9.99 a month since Nov 1 (Mohit's decision of Oct 23; migration `20261101-1100`, recorded in the price
history like an admin's change). New purchases pay it; existing subscribers keep the price they signed up at unless an
admin moves them (section 3). The Stripe Price for $9.99 is made by `npm run stripe:setup` or the first Pro checkout,
and the earlier list prices are then archived (subscriptions on them keep billing).

Features (the plan copy, migration `20261101-1200`, Nov 1). Each plan's list holds the one before it, Free → Access Pro
→ Pro + keychain (and Free → Keychain), so the website shows the first card's list, then "Everything in <previous
plan>, plus:" with only what a plan adds:

- **Free:** Directory listing · Digital card & QR code · 1 featured video · Up to 4 photos · Contact info & bio ·
  Specialties & booking link · Social links, hours & location.
- **Keychain:** the Free list + "NFC keychain — tap to share your profile" (`highlight: "keychain"`).
- **Access Pro (while the subscription is Pro):** the Free list + Swap your featured video anytime · Refresh your photos
  anytime · Profile analytics.
- **Pro + keychain:** the Access Pro list + the keychain line.

Removed: "Run special offers" (offers are retired), "Priority placement in search" (not built), and "Directory listing
& digital card" (Free's own two lines replace it). "Performance analytics" is now "Profile analytics". No feature is
marked "soon".

The server enforces these as entitlements (admin setting, per tier). `GET /access/plans` answers them too
(`entitlements`, Nov 1), so the website can read the photo and video limits:

| Entitlement | Free | Pro |
| --- | --- | --- |
| Photos / videos on the card | 4 / 1 | 4 / 1 |
| Edit details after the card is live (text, links, hours, locations) | **Default: yes** | yes |
| Change photos, video or profile image after the card is live | no | yes |
| Analytics: the card's numbers (`/access-card/analytics/…`) and the page's (`GET /my/profile/analytics`) | no: 403 `UPGRADE_REQUIRED` `analytics` (Nov 1) | yes |
| Priority in search | no | stored only: not built |

Special offers were an entitlement until Nov 1; the setting no longer has them (migration `20261101-1200`), and a
`special_offers` key sent to the settings is dropped.

A card that is still a draft, waiting for review or rejected can always be edited by its owner. Admins can always
edit. A refused edit answers 403 `UPGRADE_REQUIRED` with the feature. **Default** note: the website today locks all
editing for Free cards; the pricing page only lists media changes as Pro, so the server allows Free owners to keep
their details current. One setting switches Free editing off.

## 3. Prices, discounts and personal prices

- **List prices** are stored per product (Access Pro monthly, keychain), each with its Stripe Price. An admin
  changes a price; the server creates the new Stripe Price and archives the old one. **Default:** existing
  subscribers keep the price they signed up at; the admin can choose to move them to the new price from their next
  renewal (no proration).
- **Site-wide discount:** a percentage or an amount off, for Access Pro and/or the keychain, from a start to an end
  date; on Access Pro for the first payment, a number of months, or forever. One discount runs at a time. It is a
  Stripe coupon, and the plans endpoint shows the sale price and when it ends.
- **Personal price:** for one client (an account, or an email for someone who has not signed up yet), a price for
  Access Pro and/or the keychain, optionally until a date. It applies at their next checkout; for a client who
  already subscribes, the admin can apply it to the live subscription from the next renewal.
- **Default:** a personal price replaces the site-wide discount for that product; they do not add up.
- Shipping is charged at the rate shown at checkout (section 7); admins can set shipping to free or a flat amount.

The server computes every amount; the browser never sends prices.

## 4. One card per person, the subscription seat

- A person (account) has at most one live card. Creating a second answers 409 `CARD_EXISTS` with the existing
  card's id; the owner can delete their card, or create the new one with `replace: true`.
- The Access Pro subscription belongs to the person, not the card: the seat. Deleting the card keeps the seat
  (and keeps charging); the next card is Pro straight away, without paying again. Deleting the account (an admin's
  delete or the person's own) ends the seat's subscription at Stripe at once, with no refund or proration (Nov 1); if
  Stripe refuses, the account is not deleted.
- The next card keeps the person's previous public link and QR code, so printed QR codes and the NFC keychain keep
  working.
- The keychain belongs to the person too: one per person (**Default**, admin setting).
- Deleting a card is a soft delete; Access card data is never erased.
- Existing data: Kate Sibley (account 194) has two cards on one email ("Kate Sibley", 16, accepted, and "Tiffany
  Adison Menzione", 21, pending). Mohit: keep "Kate Sibley", delete card 21 (Oct 16): migration `20261016-1100`
  soft-deletes it (the row stays).

## 5. Buying: the flow and every situation

A card made by a guest is a **draft**: it is not public and not in the directory until a plan is chosen (Free) or
paid. Its card token (24 h) lets the guest continue. A card that goes live is listed in the directory at once, with no
admin approval (Mohit, Nov 1). The flow:

1. Create the card (guest: `POST /businessCard`; signed in: `POST /businessCard/createBusinessCard`, which answers
   `business_card_id` as the guest create does since Nov 1).
2. Plans with prices: `GET /access/plans`.
3. Free: `POST /businessCard/select-plan`. Free + keychain (`nfc_only`): `select-plan` makes the card live on Free now
   (Nov 1), then the keychain is paid. Paid: address (keychain plans), a quote with the shipping options, then payment
   (`/access/checkout`, below; the current calls keep working).
4. The browser confirms the payment with Stripe.js and polls the checkout. Whoever learns first that Stripe has the
   money activates the plan, once: the webhook, the poll, `/pay`, or the sweeper job (section 6, Nov 1).

| Situation | What happens |
| --- | --- |
| Guest, new email | Draft card. Free: an account is made and gets a set-password email, the card goes live. Paid: the same after payment |
| Guest, the email has an app account | Since Nov 1, as for a new email (Mohit: no app users yet; only website professionals matter): `account_exists: false`, no `ACCOUNT_EXISTS`. When the card goes live the app account becomes a professional account of the card's type and gets the set-password email. Nothing is deleted |
| Guest, the email has a website account | Draft card; choosing a plan answers 409 `ACCOUNT_EXISTS` ("sign in to continue"). After signing in, `POST /access/cards/:id/claim` (with the card token) moves the draft to the account, and the purchase continues signed in. A card is never attached to an existing account without its owner signing in |
| Guest, the email's account already has a card | As above; the claim answers 409 `CARD_EXISTS`. The person keeps their card (the draft stays unused) or claims with `replace: true` |
| Signed in, no card | The card is theirs. With an active seat it is Pro at once; with a keychain already bought, it shows it. The account takes the card's type (professional or brand) while it has no other live card and no products; otherwise the card takes the account's (Nov 1; a claim settles it the same way) |
| Signed in, has a card | 409 `CARD_EXISTS` (edit it, delete it, or replace it) |
| Free or keychain card, upgrades | Checkout for Access Pro (optionally with the keychain) |
| Pro, buys the keychain | Checkout for the keychain alone (one-time payment). Pro + keychain with the keychain owned sells Pro alone |
| A payment for the card is already under way | The quote asks Stripe first (Nov 1): paid or being confirmed, 409 `CHECKOUT_IN_PROGRESS` with its `checkout_id`; still payable and the same plan, rate and address, that checkout again (with its client secret); another plan, rate or address, the old payment is stopped at Stripe and a new quote made |
| Nothing to pay (a $0 first invoice, a free keychain with free shipping) | `/pay` answers `{ paid: true }` and the card is live (Nov 1) |
| Paid twice (two checkouts at once), or Pro paid on a subscription cancelled meanwhile | The payment and the order are recorded, nothing is given twice: a second subscription ends at once, a second keychain does not ship. support@glamlink.net is emailed to refund it by hand (Nov 1) |
| Pro cancels | Ends at the end of the paid month (**Default**: was immediate); `resume` undoes it until then; afterwards the card is Free. Never refunded |
| Renewal fails | Stripe retries. The owner is emailed the invoice's Stripe page, and the seat shows `past_due` (the website offers Stripe's billing portal to update the card). Pro stays for at most 21 days after the first failure (Nov 1). When Stripe gives up it cancels the subscription (deploy.md, Revenue recovery) and the card becomes Free |
| Guest leaves before paying | The draft stays hidden; with the card token it can be resumed within 24 h |
| Payment confirmed after the page closed | The webhook (or the poll, `/pay` or the sweeper) does all the work and sends the emails |
| Refund or dispute | Made in Stripe's dashboard, never by the API. Since Nov 1 the webhook records it on the payment and the order; plan, seat and shipping stay as they are |
| An admin cancels an order | Section 8 (Nov 1): no refund; a keychain not shipped won't ship; Access Pro bought with it ends now; the card stays live on Free |
| Admin creates a card for a client | Attached to the client's account if the email has one (admin is trusted), unless that account has a card (409, or replace); otherwise an account is made with a set-password email. Only a new account takes the card's type: an existing account keeps its own (an app account is not converted) |

## 6. Payments: Stripe

- **SDK:** stripe-node 23, the only Stripe package (it pins API version `2026-09-30.endive`). The app and CRM
  code use the same package with API version `2022-11-15` until their phases (architecture.md, "Stripe").
- **Access Pro** (with or without the keychain): a Subscription created `default_incomplete`, with the Pro item,
  the keychain and shipping as one-off items on the first invoice, the discount or personal price applied per item,
  `billing_mode: flexible`, and the first invoice's `confirmation_secret` returned as `clientSecret`.
- **Keychain alone:** a PaymentIntent for the computed total (keychain, shipping, discount). A keychain-only total of 1
  to 49 cents is refused (400 `AMOUNT_TOO_SMALL`: Stripe's smallest card payment is 50 cents); $0 needs no payment.
- **Ways to pay** (Mohit, Nov 1): cards, which include Apple Pay and Google Pay, and Link; no bank debits or other
  methods. PaymentIntents send `allowed_payment_method_types: ['card', 'link']` and subscriptions
  `payment_settings.payment_method_types: ['card', 'link']` (`PAYMENT_METHODS` in `checkout.js`). Link must be on in
  Stripe's dashboard (deploy.md section 5).
- Every checkout is stored (plan, lines, discount, shipping rate, totals) before Stripe is called, and Stripe calls
  carry an idempotency key made from the checkout and a hash of what is asked (BE-14), so a retried request never
  charges twice while a changed quote gets a new object.
- **Customer:** the account's Stripe customer, else the one an earlier checkout of the same card made for the guest's
  email, else a new one. A stored customer Stripe no longer knows (deleted, or from the other mode on a test copy of
  live data) is made again.
- **Stripe's refusals** on these calls (quote, pay, the subscription's cancel and resume, the billing portal) are
  logged with Stripe's words and answer 502 `PAYMENT_UNAVAILABLE` ("Payments are not available right now. Please try
  again in a few minutes."). A card decline happens in the browser (Stripe.js). Other Stripe calls in the API still
  answer `PAYMENT_FAILED`.

**A checkout's states** (Nov 1):

| Status | Meaning |
| --- | --- |
| `open` | Quoted, not sent to Stripe yet. A quote lasts 24 hours |
| `pending` | Stripe waits for the buyer (a payment method, 3-D Secure). From `/pay`, the buyer has 24 hours to pay |
| `failed` | Shown, never stored: the last attempt was declined (Stripe says so when asked). Still payable with the same client secret |
| `processing` | The bank is confirming the payment (stored). The webhook, the poll or the sweeper finishes it |
| `paid` | The card is live |
| `expired` | The quote or its payment window ran out, or Stripe gave up on the first invoice |
| `cancelled` | A newer quote for another plan, rate or address replaced it, or an admin cancelled its order |

The quote and the poll answer the checkout with `client_secret` while it is `pending` or `failed`, and with `card`
(`business_card_id`, `status`, `business_card_link`) once it is `paid`.

**Following Stripe, not only the webhook** (BE-01, Nov 1; `checkoutSync.js`). While a checkout is `pending` or
`processing`, Stripe is asked what became of its payment (the PaymentIntent, or the subscription's first invoice):

- by the poll (`GET /access/checkout/:id`), at most every 3 seconds per checkout; Stripe out of reach, the stored
  state is answered;
- by `/pay` (paying again while pending gives the same secret once Stripe has said it is not paid; a payment being
  confirmed answers 409 `CHECKOUT_IN_PROGRESS`);
- by the quote, which allows one payment under way per card (the "already under way" situation in section 5);
- by the sweeper job `access-checkout-sweep`, every 5 minutes: up to 50 checkouts made more than 10 minutes ago and
  not asked about in the last 5. It activates the paid ones, and stops at Stripe and expires those still unpaid after
  their payment window. It runs only when `JOBS_ENABLED` is not `false` (off in testing mode).

A paid one is activated (`activate()`, once per checkout, whoever comes first): the account for a guest is made (or an
app account converted) inside the activation's transaction, the seat, card, payment and order are saved, and the
emails go after the answer. A $0 first invoice (a 100% sale or a $0 personal price) or a free keychain with free
shipping is activated by `/pay` itself, which answers `{ paid: true, checkout_id }`.

**The seat when a renewal fails** (BE-18): Pro while `active`, `trialing`, or `past_due` for at most 21 days after the
first failure (`past_due_since`). `GET /access/subscription` adds `past_due` (Stripe's `past_due` or `unpaid`) and
`last_payment_failed_at`. `POST /access/billing-portal` (a signed-in professional; `return_url` on the website's or
an allowed origin) answers `{ url }`, a Stripe billing portal session where the person updates their card and pays;
404 `NO_CUSTOMER` before any Stripe payment, 502 `PAYMENT_UNAVAILABLE` while the portal is not set up in that Stripe
mode.

**Never refunded by the API** (Mohit, Nov 1): nothing calls Stripe's refunds. A person's own cancel ends Pro at the end
of the paid month; an admin's `now` cancel, an admin's order cancel (section 8) and an account delete end it at once
with no proration and no refund. Any refund is made by hand in Stripe's dashboard; subscriptions are never refunded.

- **Webhook** (same URL; `npm run stripe:setup` prints the list, and `npm run check:server -- --online` fails while
  the endpoint misses one or is on another API version). Each event is processed once: its claim is marked done after
  a 2xx answer, a repeat answers 200 `duplicate: true`, a delivery while another one is processing the same event
  answers 409 so Stripe retries later, and a claim left unprocessed for 5 minutes is taken over. The Access handlers
  live in the Access module and are registered with shared billing at start-up. The 15 events:

  | Event | What happens |
  | --- | --- |
  | `invoice.paid` | A first invoice activates the checkout (found by its subscription, or by the subscription's `access_checkout_id` for a $0 invoice paid during `/pay`); a later one records the renewal and extends the seat |
  | `invoice.payment_failed` | A renewal: the seat's `last_payment_failed_at`, and the owner is emailed the invoice's Stripe page. A first payment: acknowledged (the payment page shows the decline) |
  | `invoice.payment_action_required` | A renewal needing 3-D Secure: the owner is emailed the invoice's page |
  | `customer.subscription.updated` | The seat takes the subscription as Stripe has it now (asked fresh: events arrive out of order). An unpaid checkout whose subscription ended expires |
  | `customer.subscription.deleted` | The same, then the "ended" email; its own wording when Stripe ended it after failed payments |
  | `payment_intent.succeeded` | A keychain bought alone is activated |
  | `payment_intent.processing` | A keychain's checkout shows `processing` |
  | `payment_intent.payment_failed` | A `processing` checkout is payable again (`pending`) |
  | `charge.succeeded` | Acknowledged for Access charges; the app's payments are handled as before |
  | `charge.refunded` | Recorded only: the payment `REFUNDED` when refunded in full; the order `refunded` or `partially_refunded`, with `refunded_amount` and `refunded_at` |
  | `charge.dispute.created`, `.updated`, `.closed`, `.funds_withdrawn`, `.funds_reinstated` | Recorded only: the payment `DISPUTED` and the order `disputed` (with `dispute_status`) while open or lost; back as they were when won. support@glamlink.net is emailed when one opens |

- **Stripe dashboard (runbook):** products Access Pro, NFC keychain and Shipping (a setup script creates them and
  their prices, or adopts the current price IDs from `.env`); the webhook endpoint on API version
  `2026-09-30.endive` with the events above; since Nov 1 also Link, the customer portal (in test and live mode) and
  Revenue recovery (deploy.md section 5).
- **Existing subscribers** become seats in the migration; a reconcile script compares every seat with Stripe
  (status, renewal date) and fixes the database, for the rehearsal and the switch.
- Stripe.js: `confirmCardPayment` still works with the returned `clientSecret`, so the website's current payment
  step keeps working; the Payment Element (`confirmPayment`) adds Apple Pay, Google Pay and Link.

## 7. Shipping: Shippo

- **Address check:** one call. Shippo's newer validation (`/v2/addresses/validate`: valid, partially valid with a
  recommended address, or invalid, plus residential or commercial) when enabled for the account
  (`SHIPPO_ADDRESS_VALIDATION=v2`; Shippo enables it through sales), otherwise the standard check
  (`POST /addresses` with `validate`). A corrected address comes back for the customer to accept. Addresses gain a
  second street line.
- **Rates:** `POST /shipments` with the validated address and the keychain parcel; the customer picks from the
  returned services (cheapest first). **Default:** live rates; admins can set shipping to free or a flat amount.
- **Where it ships:** **Default** United States only, as today. Canada can be switched on in settings (the
  shipment then carries a customs declaration).
- **Ship-from address and parcel** come from settings and `.env` (the warehouse address is hard-coded today).
- **Labels:** an admin buys the label from the order screen (`POST /transactions` with the chosen rate, re-rated
  if it has expired); the order gets the tracking number, tracking link and label PDF. A label can be voided. A
  cancelled order ships nothing (Nov 1): buying its label answers 409 `ORDER_CANCELLED`, a label bought before can
  still be voided (the order stays cancelled), and tracking no longer moves it.
- **Tracking:** Shippo's `track_updated` webhook moves the order to shipped and delivered. The webhook URL carries
  a secret token (`SHIPPO_WEBHOOK_TOKEN`); Shippo's HMAC signature is checked too once Shippo sets it up
  (`SHIPPO_WEBHOOK_HMAC_SECRET`).
- Every Shippo call sends `Shippo-API-Version: 2018-02-08`.

## 8. Admin

New endpoints (the admin panel needs new screens for them; see its handoff note):

- Plans: edit name, tagline, badge, features, order, on/off.
- Prices: change a product's price, optionally moving subscribers at their next renewal.
- Site-wide discounts and personal prices: create, list, end.
- Settings: entitlements per tier, shipping (countries, live/flat/free, ship-from, parcel), keychains per person.
- Subscriptions: list seats with their status; cancel (now or at period end).
- Orders: buy and void labels; tracking status. Since Nov 1: the list pages and filters from the query string (it read
  the body of a GET: A-ACC-1), an order shows its checkout and any refund or dispute, and **Cancel order**
  (`POST /businessCard/access-orders/:id/cancel`, `{ reason? }`): no refund ever; the order gets `cancelled_at` and
  `cancel_reason`; a keychain not yet shipped will not ship, and the keychain stops being the person's unless another
  order of theirs stands; Access Pro bought with it ends at Stripe now; the card stays live on Free; the order's
  payment becomes `CANCELLED` and its checkout `cancelled`. Cancelling again answers the order unchanged.
- Cards: drafts listed separately; the card's type (professional or brand) on create and edit (Nov 1).
- Listing claims (Nov 1): `GET /directory/claims` lists the cards that claim a Google listing, those to verify first;
  `PUT /directory/claims/:cardId` `{ action: verify | reject }`. A verified claim takes the listing out of the
  directory's Google results (409 `PLACE_ALREADY_CLAIMED` when another card's verified claim has it); a rejected one
  is cleared from the card.
- Directory applications: the website's form is retired (Nov 1: `POST /directory/applications` answers 410
  `FORM_RETIRED`); the admin screens stay for the applications still pending and for listings admins add.

## 9. Data

New tables: `access_products`, `access_plans`, `access_settings`, `access_discounts`, `access_price_overrides`,
`access_subscriptions` (one seat per person), `access_checkouts`. New columns: Shippo and tracking fields on
`access_orders`; second street line, recipient, validation result on `user_address`; a `draft` card status.
The migration seeds the four plans and two products at today's prices, makes a seat for every existing subscriber,
and reports what it did. The current `users.subscription_*` and card `plan_type`/`nfc_status` fields stay up to date
for the website until it reads the new endpoints.

Nov 1 (each migration has a `down`; that of `20261101-0300` does nothing):

- `20261101-0100-card-professional-type`: `business_cards.professional_type` (`individual` | `brand`, default
  `individual`); brand accounts' cards become `brand`; professional accounts with no type become `individual`.
- `20261101-0200-card-place-claims`: `business_cards.claimed_place_id` and `claim_verified_at`, with an index.
- `20261101-0300-unplace-typed-addresses`: clears the coordinates 36.1699, -115.1398 (central Las Vegas, which the
  website's "Confirm" used to save for a typed address) on exact-address locations; `npm run directory:geocode` then
  places them from the address.
- `20261101-1000-access-payment-states`: checkout statuses `processing` and `cancelled`, and `synced_at`; order
  `payment_status` `partially_refunded` and `disputed`, `fulfillment_status` `cancelled`, and `cancelled_at`,
  `cancel_reason`, `refunded_amount`, `refunded_at`, `dispute_status`, `disputed_at`; payment statuses `REFUNDED` and
  `DISPUTED`; seat `past_due_since` and `last_payment_failed_at`; `stripe_events.processed_at` (older events marked
  processed).
- `20261101-1100-access-pro-price`: Access Pro 499 → 999 cents, recorded in `access_price_changes`.
- `20261101-1200-access-plan-copy`: the plan copy in section 2; `special_offers` removed from the stored
  entitlements.

## 10. Build order (each a commit with tests; Stripe and Shippo are faked in tests)

1. The card's fields: one create and one edit path, the website's checks, media limits, phone privacy.
2. Drafts, one card per person, claim, owner delete and re-create on the same link.
3. Plans, products, prices, discounts, personal prices, settings: tables, admin endpoints, `GET /access/plans`.
4. Stripe: the new SDK, checkouts, subscriptions and keychain payments, the webhook handlers, seats, the existing
   calls moved onto it, the setup and reconcile scripts.
5. Shippo: address check, rates, labels, tracking webhook, settings.
6. Entitlements and the edit rules.
7. Handoff notes for the website and the admin panel, the runbook's Stripe and Shippo steps.

Not covered: sales tax (Stripe Tax), as today; refunds by the API (they are made by hand in Stripe's dashboard; since
Nov 1 the webhook records them on the payment and the order); emails to the buyer when the keychain ships.

## 11. Setting up (for the deploy runbook)

The whole runbook is deploy.md; these are its Access steps.

1. `.env`: `ADMIN_URL`; the warehouse `SHIP_FROM_NAME`, `SHIP_FROM_COMPANY`, `SHIP_FROM_STREET1`, `SHIP_FROM_STREET2`,
   `SHIP_FROM_CITY`, `SHIP_FROM_STATE`, `SHIP_FROM_ZIP`, `SHIP_FROM_PHONE`, `SHIP_FROM_EMAIL` (the address the
   old code had written in); `SHIPPO_WEBHOOK_TOKEN` (a long random string); `SHIPPO_ADDRESS_VALIDATION=legacy`
   (`v2` once Shippo enables its newer check for the account).
2. `npm run stripe:setup`: makes (or adopts from the old price IDs in `.env`) the Stripe products and list prices,
   and prints the webhook to create.
3. Stripe webhook endpoint `https://api.glamlink.net/api/v1/payment/stripe/charge-intent/webhooks` on API version
   `2026-09-30.endive`, with the events `stripe:setup` lists (15 since Nov 1); its signing secret in
   `STRIPE_WEBHOOK_SECRET_INTENT_CHARGE`. Turn the old endpoint off at the switch. In both Stripe modes, also: Link on,
   a saved customer portal configuration, and Revenue recovery set to cancel the subscription after its retries
   (deploy.md section 5).
4. Shippo webhook (API portal > Webhooks): `track_updated` to
   `https://api.glamlink.net/api/v1/access/shippo/webhook?token=<SHIPPO_WEBHOOK_TOKEN>`. Ask Shippo for HMAC signing
   when convenient, then set `SHIPPO_WEBHOOK_HMAC_SECRET`.
5. `npm run stripe:reconcile` (then `-- --apply`) after restoring the live data: seats take Stripe's status and
   renewal dates, and Stripe subscriptions without a seat are listed.

## 12. Decisions taken with defaults (Oct 16)

Each can be changed: most are settings an admin changes. Mohit's answers (Oct 16) are marked.

- Free owners can keep their details current; photos, video and offers need Pro (`entitlements` setting).
- A price change applies to new purchases; subscribers keep theirs unless the admin moves them.
- A personal price replaces the site-wide discount for that product.
- Cancelling ends Access Pro at the end of the paid month; a failed renewal keeps Pro while Stripe retries.
- One keychain per person (`keychains_per_person`); the keychain ships to the US (Canada in `shipping.countries`).
- Guest drafts are kept, hidden, never erased. On the live copy, two old unpaid guest cards (14 "Polished Nails &
  Spa", accepted, and 59 "Jessica Leigh", pending) became drafts; their old status is in
  `business_card_status_backup`. **Mohit: fine.**
- Kate Sibley (account 194): **Mohit: keep "Kate Sibley", delete card 21** (soft, migration `20261016-1100`).
- 23 accounts have Pro without a Stripe subscription (bulk-set on Oct 8): they are complimentary seats. **Mohit:
  keep them;** admins give or take back Pro with `PUT /access/admin/subscriptions/:userId/comp`.
- **Mohit: admins may put up to 20 photos on a card** (the admin panel's gallery); owners keep their plan's count.

**Mohit's decisions of Nov 1** (built Nov 1–2, not deployed; they change some of the defaults above, and a failed
renewal now keeps Pro for at most 21 days, section 5):

- Access Pro is $9.99 a month; Free with the keychain keeps the card live on Free; profile analytics are Pro's;
  special offers are retired. Each plan card lists only what it adds to the one before it.
- No automatic refunds. Admins cancel an order (section 8); any refund is made by hand in Stripe's dashboard;
  subscriptions are never refunded.
- App accounts: there are no app users yet, so an app account's email never blocks a website purchase: the account is
  converted to a professional one, not deleted (deleting app accounts waits for Mohit's go-ahead, after a backup).
- Ways to pay: cards, Apple Pay, Google Pay and Link; no bank debits.
- Business locations are optional; a card with none shows no location.
- One form: the Access form asks Professional or Brand, and the directory form is retired; the rest of a profile is
  filled in from the dashboard. A brand's title, specialties and booking method are optional.
- A profile is listed in the directory as soon as its card goes live, with no admin approval.
- Brands get their own list on the website (`/brands`, from `GET /profiles?type=brand`), apart from the professionals
  near a place (`GET /directory/search?type=individual`).
- "Claim This Profile" on a Google listing goes through the Access form; an admin verifies the claim before the
  Google listing leaves the directory.
