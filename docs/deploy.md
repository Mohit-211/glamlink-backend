# Deploying the API on api.glamlink.net

The new API runs beside the old one on the same server: its own folder (`/var/www/api`), its own pm2 process
(`glamlink-api`), port (5001), database (`glamlink_api`) and uploads folder (`/var/www/storage`). The old backend
(`glamlink-backend` in `/var/www/backend`, `node.glamlink.net`) and its database are not touched by any step here,
so going back is pointing the website and admin panel at the old URL again.

## As deployed (Oct 30)

The live server does not use the folder, port and database this runbook names. As reported (progress.md, "On the
server"):

| | This runbook | Live |
| --- | --- | --- |
| Folder | `/var/www/api` | `/var/www/backend` |
| pm2 process | `glamlink-api` | `glamlink-api` |
| Port | 5001 | 5500 |
| Database | `glamlink_api` | `glamlinkdb` |
| Old backend's folder | `/var/www/backend` | `/var/www/old-backend` (pm2 `glamlink-backend`, database `glamlink`) |

The steps below are unchanged: use the live values when you run them. `ecosystem.config.json` still says
`cwd: /var/www/api`, so check what pm2 really runs first: `pm2 describe glamlink-api` (exec cwd, script, `NODE_ENV`).

`/var/www/backend` swapped meaning: in the steps below it is the old backend, on the live server it is the new API.
Read every `/var/www/backend` path below as `/var/www/old-backend`: its `.env` (sections 0 and 2) and its
`public/uploads` (sections 1, 2 and 8). Section 8 step 2 matters most: run as written, it would copy from the new API's
folder and miss the files uploaded to the old site since the first copy.

Three things to fix on the server (audit of Oct 30):

1. **`NODE_ENV=production` in `.env` itself** (OPS-01). The server's `.env` says `test`. The API runs as production
   today only because pm2's env sets it; config reads `.env` only for variables not already set
   (`src/core/config/paths.js:16`). Started any other way (`pm2 start index.js`, a re-created pm2 app,
   `node index.js`), it runs in test mode: no rate limits, no jobs, no Secure cookie, no captcha requirement, no
   secret checks, and every email kept in memory instead of sent. Set `production` in `.env` with the intended
   `MAIL_TRANSPORT` and `JOBS_ENABLED`.
2. **SQL dumps and backups** (OPS-02). Dumps with personal data sit in the server's root folder. Move them off the
   server (or `chmod 600` them while they are needed), then delete them. Then start the nightly backup in section
   11 and test one restore.
3. **The health check is `https://api.glamlink.net/api/healthcheck`**, outside `/api/v1`. It answers a static
   `{"response":"ok"}`: it shows the process is up, not that the database answers (OPS-04).

Two stages:

1. **Testing mode** (sections 1 to 7): the API on a copy of the live data, with Stripe and Shippo test keys, no
   emails, no scheduled jobs. The website and admin panel are changed against it and tested.
2. **The switch** (section 8): a fresh copy of the live data, live keys, and the website and admin panel move over.

`npm run check:server` checks the settings, storage, database and migrations at any point; `-- --online` also
asks Stripe and Shippo whether the keys and the webhook work.

## 0. Before you start

- The code that deploys is the `master` branch on GitHub.
- On the server: Node 24 (`node -v`), pm2 (`pm2 -v`), MariaDB 10.11, nginx, certbot. A user with sudo.
- At hand: the old backend's `.env` (`/var/www/backend/.env`: SMTP, Stripe, Shippo, Google values to copy), the
  Stripe dashboard (test mode), Shippo, Cloudflare Turnstile, DNS for glamlink.net.

## 1. One time: DNS, folders, code

1. DNS: an `A` record for `api.glamlink.net` pointing at the server's IP (the one `node.glamlink.net` uses).
2. Folders and code:

   ```bash
   sudo mkdir -p /var/www/api /var/www/storage/uploads /var/www/storage/logs
   sudo chown -R $USER:$USER /var/www/api /var/www/storage
   git clone -b master https://github.com/Mohit-211/glamlink-backend.git /var/www/api
   cd /var/www/api
   npm ci --omit=dev
   cp .env.example .env
   ```

   `/var/www/storage` must be new: check that nothing else uses it (`ls /var/www/storage`). The old backend keeps
   its files in `/var/www/backend/public/uploads`.

## 2. One time: the database

1. Create the new database and a user that can reach only it:

   ```bash
   sudo mariadb
   ```
   ```sql
   CREATE DATABASE glamlink_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'glamlink_api'@'localhost' IDENTIFIED BY 'a-long-random-password';
   GRANT ALL PRIVILEGES ON glamlink_api.* TO 'glamlink_api'@'localhost';
   EXIT;
   ```

2. Copy the live data into it. The old database's name is `CENTRAL_MYSQL_DB` in `/var/www/backend/.env`:

   ```bash
   sudo mariadb-dump --single-transaction --quick --routines --triggers --default-character-set=utf8mb4 \
     <old-database> > ~/glamlink-$(date +%F).sql
   sudo mariadb glamlink_api < ~/glamlink-$(date +%F).sql
   ```

   The dump holds personal data: delete it once restored (`rm ~/glamlink-*.sql`), or keep it outside web folders.

3. Copy the uploaded files:

   ```bash
   rsync -a /var/www/backend/public/uploads/ /var/www/storage/uploads/
   ```

## 3. `.env`

Fill in `/var/www/api/.env` (every variable is described in the file). For testing mode:

| Variable | Testing mode | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Both stages, in `.env` itself: pm2's env sets it too, but a start without that env falls back to `.env` ("As deployed") |
| `PORT` | `5001` | The old backend has 5000 |
| `API_BASE_URL` | `https://api.glamlink.net` | Stored file links are rewritten to it by the migrations: set it before migrating |
| `WEBSITE_URL`, `ADMIN_URL` | `https://test.glamlink.net` while the website is tested there, `https://admin.glamlink.net` | Links in emails (verify email, reset password) and new cards' public links open on `WEBSITE_URL`. Live: `https://glamlink.net` |
| `WEBSITE_REFRESH_URL`, `WEBSITE_REFRESH_SECRET` | `https://test.glamlink.net/api/revalidate` (the website has the route) and a secret shared with the website's `REVALIDATE_SECRET`, in its `.env.local` (`openssl rand -hex 32`) | After each change the API tells the website which data changed (website handoff, section 10.18). Empty: off, and cached pages wait for their own expiry |
| `ACCESSDOMAINS` | `https://glamlink.net,https://www.glamlink.net,https://admin.glamlink.net,https://test.glamlink.net` | The website's origins: without `https://test.glamlink.net` the API refuses the test site with 403. Add `http://localhost:3000` (and the admin panel's dev URL) while the frontends are tested from a laptop |
| `JOBS_ENABLED` | `false` | Live: `true`. Off means no scheduled job runs, the Access checkout sweeper included (section 5) |
| `MAIL_TRANSPORT` | `log` | Emails are written to the log, never sent. Live: `smtp` |
| `CENTRAL_MYSQL_HOST/PORT/DB/USER/PASSWORD` | `127.0.0.1`, `3306`, `glamlink_api`, `glamlink_api`, the password from step 2 | |
| `JWT_SECRET` | `openssl rand -hex 32` | A new one: everyone signs in again on the new API. Production refuses anything shorter than 64 hex characters |
| `SUP_ADM_ROLE_ID`, `USR_ROLE_ID`, `PROFESSIONAL_ROLE_ID`, `BRND_ROLE_ID`, `ADM_DEPT_ID`, `DEFAULT_TIMEZONE` | Copy from the old `.env` | `PROFESSIONAL_ROLE_ID` is the old `CLLR_ROLE_ID` (7) |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | Test keys (`sk_test_…`, `pk_test_…`) | Live: the live keys. Both from the same mode |
| `STRIPE_WEBHOOK_SECRET_INTENT_CHARGE` | From the test webhook (section 5) | |
| `STRIPE_GLAMLINK_MONTHLY_PRICE_ID`, `STRIPE_GLAMLINK_SETUP_PRICE_ID`, `STRIPE_SHIPPING_PRICE_ID` | Copy from the old `.env` | `stripe:setup` adopts them when they match its mode |
| `SHIPPO_API_KEY` | `shippo_test_…` | Live: `shippo_live_…` |
| `SHIPPO_WEBHOOK_TOKEN` | `openssl rand -hex 24` | The secret at the end of the Shippo webhook URL |
| `SHIP_FROM_*` | The warehouse the keychains ship from | Without it a keychain shipping quote fails |
| `TURNSTILE_SECRET_KEY` | Cloudflare's always-pass test secret `1x0000000000000000000000000000000AA` | Live: the real secret. Production refuses sign-ups without it. The website needs the matching site key (test: `1x00000000000000000000AA`) |
| `SMTP_*`, `EMAIL_FROM` | Copy from the old `.env` | Used only when `MAIL_TRANSPORT=smtp` |
| `GOOGLE_API_KEY` | The rotated server key | Restricted to Geocoding, Places, Places API (New), Routes and the server's IP. The directory uses Places API (New) (enable it in Google Cloud for this key) and Geocoding |
| `YOUTUBE_API_KEY` | A key with YouTube Data API v3 | Restricted to that API and the server's IP. Imports each video series' playlist when an admin presses the import button, and the links admins paste; the website then drops its own key |
| `FIREBASE_*` | Leave empty | Push notifications off. Live: from the service account file |
| `OPENAI_API_KEY`, `FACEPP_*`, `NUMERAL_*` | Copy from the old `.env` | App features only |

Leave `STORAGE_DIR` unset (it defaults to `/var/www/storage`), or set it to the folder from step 1.

## 4. Migrate, check, start

```bash
cd /var/www/api
npm run migrate
npm run check:server
```

`npm run migrate` prints what it changed. Keep the output: it lists the accounts merged by email, the guest cards
that became drafts, the people with more than one card, and the file links moved to `API_BASE_URL` (about 2,600 on
the Oct 14 copy). `check:server` should end with `Ready`; fix every `FAIL` first. A `warn` that a card photo's file is
missing means the uploads were not copied (step 2.3).

Start it, and keep it running across reboots:

```bash
pm2 start ecosystem.config.json
pm2 save
pm2 startup          # once: prints a command to run with sudo
pm2 ls               # glamlink-backend (old) and glamlink-api (new), both online
```

Logs: `pm2 logs glamlink-api`, and `/var/www/storage/logs`.

## 5. Stripe and Shippo

1. `npm run stripe:setup`: creates (or adopts) the Stripe products and prices for the keys in `.env`, archives a
   product's earlier list prices once its current one exists (subscriptions on them keep billing), and prints the
   webhook to create with its events. It first names the Stripe account, and forgets the ids the database saved
   that this account doesn't have (the test ones, after the switch to live keys), so they are made again.
2. Stripe dashboard, test mode: Developers > Webhooks > Add endpoint
   - URL `https://api.glamlink.net/api/v1/payment/stripe/charge-intent/webhooks`
   - API version `2026-09-30.endive`
   - events (15 since Nov 1; `stripe:setup` prints the same list):
     - `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`;
     - `customer.subscription.updated`, `customer.subscription.deleted`;
     - `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`;
     - `charge.succeeded`, `charge.refunded`;
     - `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`,
       `charge.dispute.funds_reinstated`.
   - its signing secret goes in `STRIPE_WEBHOOK_SECRET_INTENT_CHARGE`.
   - An endpoint made before Nov 1 has 7 of these: add the other 8 (Developers > Webhooks > the endpoint > Update
     details). Refunds and disputes are only recorded (access.md section 6); the API never refunds.
3. Stripe dashboard, the rest (since Nov 1; in test mode now, and again in live mode at the switch):
   - **Payment methods** (Settings > Payments > Payment methods, the default configuration): Cards on, with Apple Pay
     and Google Pay; **Link on**; everything else off (US bank account/ACH, Cash App, Affirm, Klarna, Afterpay,
     Amazon Pay …). The API asks for cards and Link by name (`PAYMENT_METHODS` in
     `src/website/access-card/checkout.js`): if Link is to stay off, take `'link'` out of that list first. Register the
     payment method domains `glamlink.net`, `www.glamlink.net` and `test.glamlink.net` in both modes (Apple Pay
     needs them).
   - **Customer portal** (Settings > Billing > Customer portal): save a configuration in each mode; until then
     `POST /access/billing-portal` (the website's "Manage billing") answers 502 `PAYMENT_UNAVAILABLE`. On: update payment methods, invoice history.
     Subscription cancellation: off (the website has its own Cancel), or at the end of the billing period with
     proration off. Switching plans: off. Default return URL `https://glamlink.net/dashboard` (the API sends its own).
     Add the business name and the terms and privacy links.
   - **Revenue recovery** (Billing > Revenue recovery > Retries): Smart Retries (Stripe's default, up to 2 weeks), then
     **cancel the subscription**, not "leave past due" or "mark as unpaid". The API keeps Pro at most 21 days after a
     renewal first fails, as a safety net. Under Revenue recovery > Emails, leave Stripe's failed-payment emails off:
     the API sends its own for failed renewals and 3-D Secure (the expiring-card reminders may stay on).
   - Optional: Settings > Customer emails > Successful payments, for Stripe's receipts of invoices (the keychain's
     payment already asks Stripe for a receipt).
4. Shippo: Settings > API > Webhooks: event `track_updated`, URL
   `https://api.glamlink.net/api/v1/access/shippo/webhook?token=<SHIPPO_WEBHOOK_TOKEN>`.
5. `pm2 reload glamlink-api --update-env`, then `npm run check:server -- --online`: Stripe and Shippo accept the keys,
   and the webhook is found and enabled. Since Nov 1 it also fails when the endpoint is on another API version or
   misses one of the 15 events.

Checkouts waiting for Stripe are also asked about every 5 minutes by the `access-checkout-sweep` job, so a paid card
goes live even if its webhook never comes. Like every scheduled job, it runs only when `JOBS_ENABLED` is not `false`:
in testing mode (section 3) it is off, and only the website's checkout poll and `/pay` ask Stripe.

## 6. nginx and HTTPS

`/etc/nginx/sites-available/api.glamlink.net`:

api.glamlink.net is behind Cloudflare, so nginx sees Cloudflare's addresses, not the visitors'. Take the visitor's
address from Cloudflare's `CF-Connecting-IP` header, trusted only from Cloudflare's own ranges (published at
cloudflare.com/ips), so the API's per-visitor limits (sign-in attempts, guest cards) see visitors:

```bash
{ for ip in $(curl -s https://www.cloudflare.com/ips-v4) $(curl -s https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"; done; echo "real_ip_header CF-Connecting-IP;"; } \
  | sudo tee /etc/nginx/snippets/cloudflare-real-ip.conf
```

`/etc/nginx/sites-available/api.glamlink.net`:

```nginx
server {
    listen 80;
    server_name api.glamlink.net;

    # The visitor's address from Cloudflare (above).
    include snippets/cloudflare-real-ip.conf;

    # Card forms and admin galleries send several photos and a video in one request.
    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.glamlink.net /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.glamlink.net
```

The API trusts exactly one proxy in front of it (nginx), which gives it the visitor's address for rate limits.
Check: requests in today's log (`/var/www/storage/logs/<date>.log`) start with visitors' addresses, not
Cloudflare's (`104.x`, `172.64.x`–`172.71.x`, `162.158.x`, …).

Cloudflare's ranges change rarely; run the command again if Cloudflare announces new ones.

## 7. Check it works

```bash
curl https://api.glamlink.net/api/healthcheck                 # {"response":"ok"}
curl https://api.glamlink.net/api/v1/access/plans             # the four plans
curl -I https://api.glamlink.net/images/<a file in /var/www/storage/uploads/images>   # 200
curl -i -H 'Origin: https://admin.glamlink.net' https://api.glamlink.net/api/v1/access/plans | grep -i access-control-allow-origin
curl -X POST https://api.glamlink.net/api/v1/admin/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<an admin email>","password":"<its password>"}'   # a token
```

Then the frontends are changed against it (the handoff notes in `docs/handoff/`): base URL
`https://api.glamlink.net/api/v1`, images `https://api.glamlink.net/images/`. The website's sign-in keeps its
refresh token in a cookie for glamlink.net only: test sign-in with the website on a glamlink.net address or with the
API running locally. The admin panel can test against the API from a laptop (its origin in `ACCESSDOMAINS`).

### The website on test.glamlink.net

The website is tested on `https://test.glamlink.net` against this API before the switch. For sign-up, a payment and
a keychain address to work end to end there:

**First deploy the code from Oct 23 or later** (`git pull`, section 9). Before it, the API found a card by its whole
link (`https://glamlink.net/access/<handle>`), so with `WEBSITE_URL` on the test site every existing card answered
404 there, and a new card could take an existing card's handle and QR code. Now cards are found by their handle.

1. `.env`: `https://test.glamlink.net` in `ACCESSDOMAINS`, `WEBSITE_URL=https://test.glamlink.net` (section 3), and the
   test keys: `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` `sk_test_…`/`pk_test_…`, `SHIPPO_API_KEY` `shippo_test_…`,
   the Turnstile test secret, with `npm run stripe:setup` and the test webhook (section 5). Then
   `pm2 reload glamlink-api --update-env` and `npm run check:server -- --online` (it should say `test mode`).
2. nginx: the Cloudflare real-IP include (section 6).
3. `www.glamlink.net`: one address for the website. Either a Cloudflare redirect rule (Rules > Redirect Rules: host
   equals `www.glamlink.net` → `https://glamlink.net` + the same path and query, 301), or keep it in
   `ACCESSDOMAINS` (it is in the value above). The redirect is better: one address for search engines and visitors.
4. The website's test build uses the matching keys: Stripe's publishable key comes from the API; the Turnstile site
   key is Cloudflare's test key `1x00000000000000000000AA`.

Cards made while testing get `test.glamlink.net` links, and their QR codes point there. That is fine: the switch
(section 8) starts again from a fresh copy of the live data.

A test purchase: the website in test mode, Stripe's test card `4242 4242 4242 4242`; the card goes live and the seat
shows in `GET /access/admin/subscriptions`. With `MAIL_TRANSPORT=log` no email leaves the server: each one is logged
with its website links, so the verify-email and reset-password links are in
`pm2 logs glamlink-api --lines 200 | grep "Email not sent"`.

## 8. The switch to live

**Nov 5: the database stays.** The plan was a fresh copy of the old database at the switch. But since the Oct 23
copy, everything was done on the new system (product tags and categories, featured items, the testing), and nothing
on the old database (the owner's word, Nov 5), so the switch keeps `glamlinkdb` as it is. What must not go live from
it: the test purchases, the cards made on the test site (their links and QR codes name test.glamlink.net), and the
test-mode Stripe ids it saved. Before Nov 5 `stripe:setup` reused those ids, and every live checkout would have failed;
it now replaces them.

On the server (`/var/www/backend`, "As deployed"), late evening, in this order:

1. Back up the database (section 11) and keep a copy of `.env` (`cp .env ~/api-env-before-live`).
2. While the keys are still the test keys, in the admin panel: cancel the test keychain orders and the test Pro
   subscriptions, and delete the cards and accounts that were only tests (no account is deleted without the
   owner's say).
3. `git pull`, `npm ci --omit=dev`, `npm run migrate` (nothing is pending since Nov 4).
4. `.env` to live: the Stripe live keys (the account the old site's subscribers pay: the old backend's `.env`),
   `MAIL_TRANSPORT=smtp` with the `SMTP_*` values, `JOBS_ENABLED=true`, the Shippo live key, the real Turnstile
   secret, `WEBSITE_URL=https://glamlink.net`, and `WEBSITE_REFRESH_URL=https://glamlink.net/api/revalidate` with a
   new `WEBSITE_REFRESH_SECRET`, the live website's `REVALIDATE_SECRET`. Take the localhost origins out of
   `ACCESSDOMAINS`. `https://test.glamlink.net` stays in it until the test site has an API of its own: until then
   it reads and writes live data. `FIREBASE_*` stay empty: the mobile app still calls the old backend.
5. `npm run stripe:setup`: it names the account, forgets the ids these keys don't have, adopts the old live prices
   in `.env`, and prints the webhook. Adopting archives the old $4.99 Pro price once the $9.99 one exists, so from
   here the old site can't start a Pro subscription: go straight on to the website (step 9). Then the Stripe steps of
   section 5 in live mode: the webhook endpoint (its secret in `.env`), payment methods with Link and the domains,
   the customer portal, Revenue recovery.
6. `pm2 reload glamlink-api --update-env`, then `npm run check:server -- --online`. It should say `live mode`, name
   the right account, find the webhook, and find the Access products' prices in this account.
7. `npm run stripe:reconcile`, then `npm run stripe:reconcile -- --apply`: the seats take Stripe's statuses and
   renewal dates. A seat "not found in Stripe" is a test purchase that step 2 missed.
8. `npm run cards:relink` lists the cards whose link names another website. Delete the test ones in the admin panel,
   then `npm run cards:relink -- --apply` moves the rest to glamlink.net and draws their QR codes again.
9. The website: `main`, built for glamlink.net (the website's README, "Deploy the live site").
10. In Stripe (live), disable the old backend's webhook endpoint. Point the Shippo webhook at the new URL.
11. Smoke test: the home page, an article, a podcast, the directory, a public card; sign-up, the email link,
    sign-in, the dashboard; a real Access Pro purchase; admin sign-in and a journal edit.
12. Leave the old backend running (`glamlink-backend`): the mobile app still calls `node.glamlink.net`.

### Once, with the Oct 23 code: coordinates for the directory

Card locations are geocoded when saved; the ones saved before need it once (about 250 addresses, about $1.25):

```bash
npm run directory:geocode
```

### Once, with the Oct 23 code: the magazine covers

The website's 14 magazine issues are loaded with covers on the website's own host (`https://glamlink.net/magazine/…`).
Copy them to the API's uploads while the website still serves them:

```bash
npm run magazine:covers -- --dry-run   # what it would copy
npm run magazine:covers
```

## 9. After every later pull

```bash
cd /var/www/api
git pull
npm ci --omit=dev
npm run migrate
npm run check:server
pm2 reload glamlink-api
```

When a pull changes the Stripe products, prices or webhook events (the Nov 1 code does), run `npm run stripe:setup`
after `npm run migrate`, and update the webhook endpoint with the events it prints.

The next pull (Nov 4, product tags, on `master`) needs `npm run migrate`: `20261104-0100` adds the
`product_tags` table and the products' `tag_id` and `button_label`.

The Nov 5 pull (the switch, section 8) has no migration. `stripe:setup` replaces the ids saved with other keys,
`check:server -- --online` names the Stripe account and checks the saved prices, and `npm run cards:relink` moves the
cards made on the test site to `WEBSITE_URL`.

### Once, with the Nov 1 code: Access payments, one form, claims

Deploy this before the website and the admin panel's Nov 1–2 changes: both rely on its answers.

```bash
# after git pull and npm ci --omit=dev, as above
npm run migrate            # the six 20261101-* migrations (access.md section 9)
npm run stripe:setup       # the $9.99 Access Pro price; archives the old list prices; prints the 15 webhook events
npm run directory:geocode  # once: geocodes the addresses whose coordinates 20261101-0300 cleared
npm run check:server -- --online
pm2 reload glamlink-api
```

- `20261101-1100` sets Access Pro to $9.99 for new purchases; subscribers keep their price (nobody is moved).
- `20261101-0300` clears the Las Vegas centre the website saved for typed exact addresses, so those cards drop out of
  the directory's nearby search until `directory:geocode` places them (it needs `GOOGLE_API_KEY`).
- Then, in Stripe's dashboard, the steps of section 5 (the webhook's 15 events, Link, the customer portal, Revenue
  recovery); `check:server -- --online` fails until the webhook has every event.
- Then test in Stripe test mode on test.glamlink.net (progress.md, Nov 1–2): nothing has run against real Stripe yet.

## 10. Going back

- The website and admin panel: point them back at `https://node.glamlink.net/api/v1` and rebuild. Start the old
  process if it was stopped (`pm2 start glamlink-backend`). Its database is as it was at the switch.
- New API code: `git checkout <earlier commit>`, `npm ci --omit=dev`, `pm2 reload glamlink-api`. Most migrations have
  a `down` (`npm run migrate:down` reverts the latest, one at a time). Four don't: the baseline
  (`20261014-0000`) and the account merge (`20261015-0300`) refuse to go back, and the duplicate-index one
  (`20261015-0350`) and the coordinate clean-up (`20261101-0300`; the cleared coordinates were wrong) do nothing.
  Going back past the first two means restoring a backup. Going back past `20261101-1000` maps the new states to old
  ones and drops the new columns: a `processing` checkout becomes `pending` and a `cancelled` one `expired`; a disputed
  or partly refunded order is `paid` again, and a cancelled keychain order is `pending` (to ship) again; a refunded or
  disputed payment is `SUCCESS`. Going back past `20261101-1100` puts Access Pro back to $4.99 for new purchases (its
  Stripe Price is made again at the next checkout).

## 11. Backups (required)

On Oct 30 no backup was confirmed to run (OPS-02). Set this up and test one restore. On the live server the database
is `glamlinkdb`, not `glamlink_api` ("As deployed").

A nightly copy of the database and the uploads, kept 14 days, for example in `crontab -e`:

```cron
30 3 * * * mariadb-dump --single-transaction glamlink_api | gzip > /var/backups/glamlink_api-$(date +\%F).sql.gz && find /var/backups -name 'glamlink_api-*' -mtime +14 -delete
```

plus the uploads folder (`/var/www/storage/uploads`) copied off the server. `uploads/images/.sized` holds the smaller
copies of images the API makes on request (`?w=`); they are made again when asked for, so a backup can skip it.

## 12. Later: the admin panel on this server

When the admin panel is ready, its built files (`build/`) can be served by nginx with the headers its security
review asked for:

```nginx
server {
    listen 80;
    server_name admin.glamlink.net;
    root /var/www/admin/build;
    index index.html;

    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://maps.googleapis.com; connect-src 'self' https://api.glamlink.net https://maps.googleapis.com; img-src 'self' data: blob: https://api.glamlink.net https://*.googleapis.com https://*.gstatic.com; media-src 'self' blob: https://api.glamlink.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

    location / {
        try_files $uri /index.html;
    }
}
```

Then `sudo certbot --nginx -d admin.glamlink.net`. Once the report-only policy shows no violations, rename the header
to `Content-Security-Policy`.
