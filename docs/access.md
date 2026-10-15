# Access: the card, plans, pricing, payments and shipping

The design for Phase 2b's Access work (Oct 16, 2026). What Mohit asked for:

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
| `name`, `professional_title`, `business_name` | Required, text |
| `email` | Required. The card's public contact email (also the account email for a guest purchase) |
| `phone`, `is_phone_visible` | 10 digits; required while `is_phone_visible` (default true). Hidden phones are left out of every public response |
| `bio` | Required. Rich text from the bio editor, cleaned on save (allow-list), at most 80 characters of text |
| `color_code` | `#RRGGBB`, default `#24BBCB` |
| `specialties` | 1 to 5 |
| `locations` | At least one. `label`, `location_type` (`exact_address` with `address`, or `city_only` with `city` and `state`), `latitude`/`longitude`, one `is_primary` (`isPrimary` accepted too) |
| `business_hour` | Lines of free text: `[{ note }]` |
| `website`, `social_media` | `instagram`, `instagram1`, `instagram2`, `tiktok`, `linkedin`, `youtube`, `facebook` |
| `other_links` | `[{ title, url }]` |
| `featured_links` | `[{ title, url, image, is_featured, sort_order }]`, at most one featured |
| `preferred_booking_method` | One or more of `GO_TO_BOOKING_LINK`, `CALL_TEXT`, `DM_INSTAGRAM` (any letter case). A booking link (or website) is required for the first, an Instagram handle for the last |
| `booking_link`, `important_info` | Optional |
| `profile_image`, `images`, `videos` (+ `video_thumbnails`) | Profile image required. Up to 4 photos and 1 video (MP4, up to 60 s): the plan limits below. Captions per item |
| `offer_promotion`, `promotion_details` | Special offers: Access Pro only |

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
| Access Pro (`subscription_only`) | Pro features | $4.99 / month |
| Pro + keychain (`nfc_with_subscription`, "Most popular") | Pro features + keychain | $4.99 / month + $39.99 one-time |

Features (from the pricing page):

- **Free:** directory listing, digital card and QR code, 1 featured video, up to 4 photos, contact info and bio,
  specialties and booking link, social links, hours and location.
- **Pro (while the subscription is active):** swap the featured video anytime, refresh photos anytime, run special
  offers; performance analytics and priority placement in search are marked "soon".

The server enforces these as entitlements (admin setting, per tier):

| Entitlement | Free | Pro |
| --- | --- | --- |
| Photos / videos on the card | 4 / 1 | 4 / 1 |
| Edit details after the card is live (text, links, hours, locations) | **Default: yes** | yes |
| Change photos, video or profile image after the card is live | no | yes |
| Special offers (`offer_promotion`) saved and shown | no | yes |
| Analytics, priority in search | no (soon) | yes (when built) |

A card that is still a draft, waiting for review or rejected can always be edited by its owner. Admins can always
edit. A refused edit answers 403 `UPGRADE_REQUIRED` with the feature. **Default** note: the website today locks all
editing for Free cards; the pricing page only lists media changes and offers as Pro, so the server allows Free
owners to keep their details current. One setting switches Free editing off.

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
  (and keeps charging); the next card is Pro straight away, without paying again.
- The next card keeps the person's previous public link and QR code, so printed QR codes and the NFC keychain keep
  working.
- The keychain belongs to the person too: one per person (**Default**, admin setting).
- Deleting a card is a soft delete; Access card data is never erased.
- Existing data: Kate Sibley (account 194) has two live cards on one email ("Kate Sibley", accepted, and "Tiffany
  Adison Menzione", pending). The rule applies to new cards; this pair waits for Mohit's decision.

## 5. Buying: the flow and every situation

A card made by a guest is a **draft**: it is not public and not in the directory until a plan is chosen (Free) or
paid. Its card token (24 h) lets the guest continue. The flow:

1. Create the card (guest: `POST /businessCard`; signed in: `POST /businessCard/createBusinessCard`).
2. Plans with prices: `GET /access/plans`.
3. Free: `POST /businessCard/select-plan`. Paid: address (keychain plans), a quote with the shipping options,
   then payment (`/access/checkout`, below; the current calls keep working).
4. The browser confirms the payment with Stripe.js; Stripe's webhook activates the plan; the page polls the
   checkout until it is paid.

| Situation | What happens |
| --- | --- |
| Guest, new email | Draft card. Free: an account is made and gets a set-password email, the card goes live. Paid: the same after payment |
| Guest, the email has an account | Draft card; choosing a plan answers 409 `ACCOUNT_EXISTS` ("sign in to continue"). After signing in, `POST /access/cards/:id/claim` (with the card token) moves the draft to the account, and the purchase continues signed in. A card is never attached to an existing account without its owner signing in |
| Guest, the email's account already has a card | As above; the claim answers 409 `CARD_EXISTS`. The person keeps their card (the draft stays unused) or claims with `replace: true` |
| Signed in, no card | The card is theirs. With an active seat it is Pro at once; with a keychain already bought, it shows it |
| Signed in, has a card | 409 `CARD_EXISTS` (edit it, delete it, or replace it) |
| Free or keychain card, upgrades | Checkout for Access Pro (optionally with the keychain) |
| Pro, buys the keychain | Checkout for the keychain alone (one-time payment) |
| Pro cancels | Ends at the end of the paid month (**Default**: was immediate); `resume` undoes it until then; afterwards the card is Free |
| Renewal fails | Stripe retries; the card stays Pro while the subscription is past due; if Stripe gives up, the card becomes Free |
| Guest leaves before paying | The draft stays hidden; with the card token it can be resumed within 24 h |
| Payment confirmed after the page closed | The webhook does all the work and sends the emails |
| Admin creates a card for a client | Attached to the client's account if the email has one (admin is trusted), unless that account has a card (409, or replace); otherwise an account is made with a set-password email |

## 6. Payments: Stripe

- **SDK:** stripe-node 23 (pins API version `2026-09-30.endive`) for the website and shared billing. The app and
  CRM code keep the old stripe-node 12 until their phases (one app file calls Stripe in a way version 22+ no longer
  allows), so both are installed for now: `stripe` (old, app and CRM) and `stripe-current` (new).
- **Access Pro** (with or without the keychain): a Subscription created `default_incomplete`, with the Pro item,
  the keychain and shipping as one-off items on the first invoice, the discount or personal price applied per item,
  `billing_mode: flexible`, and the first invoice's `confirmation_secret` returned as `clientSecret`.
- **Keychain alone:** a PaymentIntent for the computed total (keychain, shipping, discount).
- Every checkout is stored (plan, lines, discount, shipping rate, totals) before Stripe is called, and Stripe calls
  carry an idempotency key, so a retried request never charges twice.
- **Webhook** (same URL): `invoice.paid` (first payment activates, renewals extend), `invoice.payment_failed`,
  `customer.subscription.updated` and `.deleted` (status, cancel at period end, end of period),
  `payment_intent.succeeded` (keychain), `charge.refunded`. The app and CRM's `charge.succeeded` handling stays as
  it is. The Access handlers live in the Access module and are registered with shared billing at start-up.
- **Stripe dashboard (runbook):** products Access Pro, NFC keychain and Shipping (a setup script creates them and
  their prices, or adopts the current price IDs from `.env`); the webhook endpoint on API version
  `2026-09-30.endive` with the events above.
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
  if it has expired); the order gets the tracking number, tracking link and label PDF. A label can be voided.
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
- Orders: buy and void labels; tracking status.
- Cards: drafts listed separately.

## 9. Data

New tables: `access_products`, `access_plans`, `access_settings`, `access_discounts`, `access_price_overrides`,
`access_subscriptions` (one seat per person), `access_checkouts`. New columns: Shippo and tracking fields on
`access_orders`; second street line, recipient, validation result on `user_address`; a `draft` card status.
The migration seeds the four plans and two products at today's prices, makes a seat for every existing subscriber,
and reports what it did. The current `users.subscription_*` and card `plan_type`/`nfc_status` fields stay up to date
for the website until it reads the new endpoints.

## 10. Build order (each a commit with tests; Stripe and Shippo are faked in tests)

1. The card's fields: one create and one edit path, the website's checks, media limits, phone privacy.
2. Drafts, one card per person, claim, owner delete and re-create on the same link.
3. Plans, products, prices, discounts, personal prices, settings: tables, admin endpoints, `GET /access/plans`.
4. Stripe: the new SDK, checkouts, subscriptions and keychain payments, the webhook handlers, seats, the existing
   calls moved onto it, the setup and reconcile scripts.
5. Shippo: address check, rates, labels, tracking webhook, settings.
6. Entitlements and the edit rules.
7. Handoff notes for the website and the admin panel, the runbook's Stripe and Shippo steps.

Not covered: sales tax (Stripe Tax), as today.
