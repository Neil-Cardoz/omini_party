# celebrAItions

celebrAItions is a context-aware event planning assistant for weddings, birthdays,
community events, and other celebrations. It turns a few planning choices into a
costed, scheduled, vendor-ready plan while keeping every decision editable.

## Current status

The project is being built phase by phase from [`plan/BLUEPRINT.md`](plan/BLUEPRINT.md).
The current main branch includes the deterministic planning engine, SQLite-backed API,
demo login, onboarding, the 11-step planning wizard, live estimates, editable party
details, guest RSVP links, signed entry check-in, printable reports, and an optional
server-side creative assistant with offline fallback ideas.

## Development

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- API health: http://localhost:3001/health

### Demo mode

Use **Explore with demo parties** on the login screen. It opens a seeded account with
three sample celebrations; no password or API key is required.

### Important routes

- `/dashboard` — party hall
- `/party/new` — 11-step planning wizard
- `/party/:id` — overview, tasks, budget, guests, menu, timeline and ideas
- `/party/:id/report` — print / Save as PDF report
- `/party/:id/checkin` — manual signed invite check-in
- `/rsvp/:token` — public guest RSVP page

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The optional `ANTHROPIC_API_KEY` is kept server-side and is not required for the
offline fallback experience described in the blueprint. Without a key, the Ideas tab
shows curated event-specific suggestions and labels them as Offline ideas.
