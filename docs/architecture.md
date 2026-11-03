# Backend layout

The code is grouped by product. The website (glamlink.net) comes first, the mobile app follows in about three
months and the CRM in about six, so each has its own folder; what more than one product uses lives in `shared/`.

```
src/
  core/          config, db (connection, migrations, seeds), http (errors, CORS, uploads, responses), logger, utils
  integrations/  external services: mailer, Stripe, Shippo (shippo.js for the app, shippoApi.js for Access), Google
                 (google.js legacy, googlePlaces.js), YouTube, the website refresh hook, Firebase, Face++, OpenAI
  shared/        identity, users, admin, billing, reference, notifications
  website/       access-card, content, inquiries, professional-form, profiles, watch, magazine, search, directory
  mobile/        social, bookings, commerce, promotions, glamcoins, face-analysis, guests, content, backoffice
  crm/           parked until the CRM is rebuilt (only the free-trial start is mounted)
  models.js      loads every module's models, then their associations
  modules.js     every module, in mount order
  routes.js      mounts each module's routes under /api/v1
  jobs.js        starts the cron jobs modules declare
```

## A module

`<product>/<module>/` holds its `*.route.js`, `*.controller.js`, `*.service.js` and `*.validation.js` files, a
`models/` folder (its tables, and an `associate()` for the associations it owns: the side with the foreign key),
and an `index.js`:

```js
module.exports = {
    routes: () => [{ path: '/journal', router: require('./journal.route') }], // mounted by src/routes.js
    jobs: () => [...],                                                        // optional, started by src/jobs.js
    stripeHandlers: () => ({ 'invoice.paid': fn }),                           // optional, registered by src/routes.js
    endBilling: (userId) => ...,                                              // optional, registered by src/routes.js
    createNotification,                                                       // what other modules may call
};
```

Shared code reaches a product only through what the product registers at start-up: its cron jobs, its Stripe event
handlers (shared billing's webhook runs them first; a handler answers true when the event was its own), and since
Nov 1 how it ends what bills an account (`endBilling`: shared billing's `endBillingOf` runs each before an account is
deleted).

Where to put new code: what the website calls goes in `website/` (or `shared/` when the app calls it too),
app-only code in `mobile/`, CRM code in `crm/`. An admin screen belongs to the product whose data it shows
(`mobile/backoffice` for app data).

## Rules (`npm run lint` checks them)

- `core` imports nothing above it; `integrations` import only `core`.
- A product never imports another product; `shared` never imports a product.
- A module reaches another module only through its `index.js`.
- Code uses (and associates with) only its own product's and shared models. Models come from
  `require('<...>/models')` (src/models.js).
- A data migration (`core/db/migrations`) may use a module through its `index.js`, to apply the module's rules
  to stored data.

Known exceptions are listed, with reasons, in `scripts/boundary-exceptions.js`; remove an entry when its code
is fixed (the check fails while a fixed entry stays).

## Stripe

One package, stripe-node 23 (the newest). The website and shared billing use it through
`src/integrations/stripe.js`, on API version `2026-09-30.endive`, except `shared/billing/stripeCustomer.service.js:53`,
which still builds its own client on `2022-11-15`. The app and CRM code also create their own clients from the same
package, and those clients send API version `2022-11-15`, the one their code was written for (six places in all,
audit DEAD-07). The exception is the app's `payout.service.js`, which names no version and so gets 23's default; it reads only
fields that are the same in both versions (ids, links, `charges_enabled`, `payouts_enabled`, `details_submitted`).
When the app is reworked, move its calls to `integrations/stripe.js`.

## Checks for refactors

| Command | Proves |
| --- | --- |
| `npm run check:routes -- out.txt` | every route (method, full path, handler count); diff two outputs. Broken since the go-live fixes: its dummy `JWT_SECRET` fails the production config check (audit TEST-04); give `scripts/route-table.js` a 64-character hex dummy |
| `npm run check:models -- out.txt` | every model's name, table, attributes, hooks and associations; diff two outputs. Broken the same way (`scripts/model-table.js`) |
| `npm run check:contract -- <snapshot.json>` | 67 real website and admin responses against the local copy of production. The snapshot predates Phase 6, so the Oct 23 endpoints are not in it |
| `npm run check:boundaries` | the module rules above |
| `npm test` | the test suite, on a database built from the migrations. It drops every table of the `glamlink_test` database on the host `.env` names: run it only against a local database (audit TEST-01) |
