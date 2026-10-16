# Deploying the API on api.glamlink.net

The new API runs beside the old one on the same server: its own folder (`/var/www/api`), its own pm2 process
(`glamlink-api`), port (5001), database (`glamlink_api`) and uploads folder (`/var/www/storage`). The old backend
(`glamlink-backend` in `/var/www/backend`, `node.glamlink.net`) and its database are not touched by any step here,
so going back is pointing the website and admin panel at the old URL again.

Two stages:

1. **Testing mode** (sections 1 to 7): the API on a copy of the live data, with Stripe and Shippo test keys, no
   emails, no scheduled jobs. The website and admin panel are changed against it and tested.
2. **The switch** (section 8): a fresh copy of the live data, live keys, and the website and admin panel move over.

`npm run check:server` checks the settings, storage, database and migrations at any point; `-- --online` also
asks Stripe and Shippo whether the keys and the webhook work.

## 0. Before you start

- On your machine: push the branch, `git push origin phase5/security`.
- On the server: Node 24 (`node -v`), pm2 (`pm2 -v`), MariaDB 10.11, nginx, certbot. A user with sudo.
- At hand: the old backend's `.env` (`/var/www/backend/.env`: SMTP, Stripe, Shippo, Google values to copy), the
  Stripe dashboard (test mode), Shippo, Cloudflare Turnstile, DNS for glamlink.net.

## 1. One time: DNS, folders, code

1. DNS: an `A` record for `api.glamlink.net` pointing at the server's IP (the one `node.glamlink.net` uses).
2. Folders and code:

   ```bash
   sudo mkdir -p /var/www/api /var/www/storage/uploads /var/www/storage/logs
   sudo chown -R $USER:$USER /var/www/api /var/www/storage
   git clone -b phase5/security https://github.com/Mohit-211/glamlink-backend.git /var/www/api
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
| `NODE_ENV` | `production` | Both stages |
| `PORT` | `5001` | The old backend has 5000 |
| `API_BASE_URL` | `https://api.glamlink.net` | Stored file links are rewritten to it by the migrations: set it before migrating |
| `WEBSITE_URL`, `ADMIN_URL` | `https://glamlink.net`, `https://admin.glamlink.net` | Links in emails |
| `ACCESSDOMAINS` | `https://glamlink.net,https://www.glamlink.net,https://admin.glamlink.net` | Add `http://localhost:3000` (and the admin panel's dev URL) while the frontends are tested from a laptop |
| `JOBS_ENABLED` | `false` | Live: `true` |
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
| `GOOGLE_API_KEY` | The rotated server key | Restricted to Geocoding, Places, Routes and the server's IP |
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

1. `npm run stripe:setup`: creates (or adopts) the Stripe products and prices for the keys in `.env`, and prints the
   webhook to create.
2. Stripe dashboard, test mode: Developers > Webhooks > Add endpoint
   - URL `https://api.glamlink.net/api/v1/payment/stripe/charge-intent/webhooks`
   - API version `2026-09-30.endive`
   - events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.succeeded`
   - its signing secret goes in `STRIPE_WEBHOOK_SECRET_INTENT_CHARGE`.
3. Shippo: Settings > API > Webhooks: event `track_updated`, URL
   `https://api.glamlink.net/api/v1/access/shippo/webhook?token=<SHIPPO_WEBHOOK_TOKEN>`.
4. `pm2 reload glamlink-api --update-env`, then `npm run check:server -- --online`: Stripe and Shippo accept the keys,
   and the webhook is found and enabled.

## 6. nginx and HTTPS

`/etc/nginx/sites-available/api.glamlink.net`:

```nginx
server {
    listen 80;
    server_name api.glamlink.net;

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

A test purchase: the website in test mode, Stripe's test card `4242 4242 4242 4242`; the card goes live and the seat
shows in `GET /access/admin/subscriptions`. With `MAIL_TRANSPORT=log` no email leaves the server: each one is logged
with its website links, so the verify-email and reset-password links are in
`pm2 logs glamlink-api --lines 200 | grep "Email not sent"`.

## 8. The switch to live

Late evening, in this order:

1. `pm2 stop glamlink-api`. Take a fresh copy of the live data: drop and re-create `glamlink_api`, restore a new dump
   (section 2), and `npm run migrate` again (read its output: new duplicate accounts since the last copy, new
   drafts). The testing data goes with the old copy.
2. `rsync -a /var/www/backend/public/uploads/ /var/www/storage/uploads/` again, for files uploaded since.
3. `.env` to live: Stripe live keys, `MAIL_TRANSPORT=smtp`, `JOBS_ENABLED=true`, `FIREBASE_*`, Shippo live key,
   the real Turnstile secret. Remove the localhost origins from `ACCESSDOMAINS`.
4. `npm run stripe:setup` with the live keys; create the live webhook endpoint (section 5) and put its secret in
   `.env`; in Stripe, disable the old backend's endpoint. Point the Shippo webhook at the new URL.
5. `pm2 start glamlink-api --update-env`, then `npm run check:server -- --online` (it should say `live mode`).
6. `npm run stripe:reconcile`, then `npm run stripe:reconcile -- --apply`: seats take Stripe's statuses and renewal
   dates. Purchases made on the old site between the dump and now are not in the new database (the new API ignores
   the old purchase flow's events, so resending them does not help): keep that gap short, and the reconcile lists any
   Stripe subscription with no seat. Send me the list; meanwhile `PUT /access/admin/subscriptions/:userId/comp`
   gives the person Pro.
7. Build and deploy the website and the admin panel with the new base URL.
8. Smoke test: the home page, an article, a podcast, the directory, a public card; sign-up, the email link, sign-in,
   the dashboard; a purchase; admin sign-in and a journal edit.
9. When it has run well for a day, stop the old process (`pm2 stop glamlink-backend`; keep its folder and database):
   its scheduled jobs would otherwise keep changing the old database.

## 9. After every later pull

```bash
cd /var/www/api
git pull
npm ci --omit=dev
npm run migrate
npm run check:server
pm2 reload glamlink-api
```

## 10. Going back

- The website and admin panel: point them back at `https://node.glamlink.net/api/v1` and rebuild. Start the old
  process if it was stopped (`pm2 start glamlink-backend`). Its database is as it was at the switch.
- New API code: `git checkout <earlier commit>`, `npm ci --omit=dev`, `pm2 reload glamlink-api`. Every migration has
  a `down` (`npm run migrate:down` reverts the latest, one at a time).

## 11. Backups (recommended)

A nightly copy of the database and the uploads, kept 14 days, for example in `crontab -e`:

```cron
30 3 * * * mariadb-dump --single-transaction glamlink_api | gzip > /var/backups/glamlink_api-$(date +\%F).sql.gz && find /var/backups -name 'glamlink_api-*' -mtime +14 -delete
```

plus the uploads folder (`/var/www/storage/uploads`) copied off the server.

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
