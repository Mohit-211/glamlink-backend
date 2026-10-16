# Glamlink backend docs

Start here. Every document below is kept current as work lands.

| Document | What it holds |
| --- | --- |
| [plan.md](plan.md) | The go-live plan: new backend on api.glamlink.net with a new database, phase by phase, and the rules for the work |
| [access.md](access.md) | The Access design (Phase 2b): the card's fields, plans and features, prices and discounts, one card per person, every purchase situation, Stripe and Shippo |
| [deploy.md](deploy.md) | The server runbook: what to do after pulling the code, testing mode, the switch to live, going back |
| [progress.md](progress.md) | What is done so far, phase by phase, with commits |
| [audit.md](audit.md) | Every finding of the original audits (backend, Oct 7; website, Oct 15) with its current status |
| [architecture.md](architecture.md) | The code layout (shared, website, mobile, crm), module rules, and the checks used for refactors |
| [handoff/website-frontend.md](handoff/website-frontend.md) | For whoever works on the website: what changed in the API and what the website must do |
| [handoff/admin-panel.md](handoff/admin-panel.md) | For whoever works on the admin panel: what changed in the API and what the panel must do |

Outside the repo (Claude Docs):

- Glamlink Backend Audit (Oct 7): https://claude.ai/artifact/UcmT1CA4BNrU429oGoJJzt (PDF: `C:\Users\mohit\Documents\Glamlink-Backend-Audit.pdf`)
- Glamlink Web — Code Audit (Oct 15): https://claude.ai/artifact/Qnh7bXqtBNzqcSj8gye1Eg
- Glamlink Backend Roadmap (change log): https://claude.ai/artifact/93UGzDxXcQhS4QbSDRy68D
- Glamlink API Go-Live Plan: https://claude.ai/code/artifact/af714945-e9fa-4ac0-80f2-739e6d572a3a
- Admin panel security: backend changes and questions (answered Oct 16): https://claude.ai/code/artifact/7cf1fb80-6241-4282-b8a6-9966c6290ed9

## Ground rules

- Website first. The mobile app (in about three months) and the CRM (in about six) are not touched: no changes
  under `src/mobile/` or `src/crm/` until their phases.
- The old backend (node.glamlink.net), its database and the server are never touched. This backend deploys
  separately to api.glamlink.net with a new database (see plan.md).
- API paths stay the same. Every change a frontend must or can make is written in its handoff note, with the date.
- The frontends (website, admin panel) stay frozen until the backend is ready; they then change from the handoff notes.
