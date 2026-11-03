# Glamlink backend docs

Start here. Every document below is meant to stay current as work lands. The Oct 30 audit found several had drifted
from the code (architecture.md, audit.md, access.md, deploy.md, both handoff notes); they were corrected that day.
On Nov 2 they were updated for the Nov 1–2 work (Access fixes, one form, brands, Stripe), which is built and tested but
not deployed: what it changed is marked "Nov 1", and progress.md says what is left to do.

| Document | What it holds |
| --- | --- |
| [plan.md](plan.md) | The go-live plan: new backend on api.glamlink.net with a new database, phase by phase, and the rules for the work |
| [access.md](access.md) | The Access design (Phase 2b): the card's fields, plans and features, prices and discounts, one card per person, every purchase situation, Stripe (checkout states, the webhook's events, refunds, cancelling an order) and Shippo, and Mohit's decisions |
| [deploy.md](deploy.md) | The server runbook: what to do after pulling the code, testing mode, the switch to live, going back; "As deployed" says how the live server differs |
| [progress.md](progress.md) | What is done so far, phase by phase, with commits |
| [audit.md](audit.md) | Every finding of the audits (backend, Oct 7; website, Oct 15; website and admin scope with the API contract, Oct 30) with its current status |
| [architecture.md](architecture.md) | The code layout (shared, website, mobile, crm), module rules, and the checks used for refactors |
| [handoff/website-frontend.md](handoff/website-frontend.md) | For whoever works on the website: what changed in the API and what the website must do |
| [handoff/admin-panel.md](handoff/admin-panel.md) | For whoever works on the admin panel: what changed in the API and what the panel must do |

Outside the repo (Claude Docs):

- Glamlink Backend Audit (rewritten Oct 30 for the website and admin scope; the Oct 7 version is in the doc's history and the PDF): https://claude.ai/artifact/UcmT1CA4BNrU429oGoJJzt (PDF: `C:\Users\mohit\Documents\Glamlink-Backend-Audit.pdf`)
- Glamlink Web — Code Audit (Oct 15): https://claude.ai/artifact/Qnh7bXqtBNzqcSj8gye1Eg
- Glamlink Backend Roadmap (change log): https://claude.ai/artifact/93UGzDxXcQhS4QbSDRy68D
- Glamlink API Go-Live Plan: https://claude.ai/code/artifact/af714945-e9fa-4ac0-80f2-739e6d572a3a
- Admin panel security: backend changes and questions (answered Oct 16): https://claude.ai/code/artifact/7cf1fb80-6241-4282-b8a6-9966c6290ed9
- Glamlink Backend Requests — Home Page and Pending Work (the website's list, Oct 22; Phase 6): https://claude.ai/artifact/WHStxu52YddaR7CpPZRBNg

## Ground rules

- Website first. The mobile app (in about three months) and the CRM (in about six) are not touched: no changes
  under `src/mobile/` or `src/crm/` until their phases.
- The old backend (node.glamlink.net), its database and the server are never touched. This backend deploys
  separately to api.glamlink.net with a new database (see plan.md). As deployed, it runs from `/var/www/backend`
  with database `glamlinkdb` (deploy.md, "As deployed").
- API paths stay the same. Every change a frontend must or can make is written in its handoff note, with the date.
- The frontends change from the handoff notes. The admin panel already runs on api.glamlink.net; the website's
  `master` runs on test.glamlink.net until the switch, and glamlink.net still serves the old site.
