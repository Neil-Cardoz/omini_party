# celebrAItions

celebrAItions is a context-aware event planning assistant for weddings, birthdays,
community events, and other celebrations. It turns a few planning choices into a
costed, scheduled, vendor-ready plan while keeping every decision editable.

## Current status

The project is being built phase by phase from [`plan/BLUEPRINT.md`](plan/BLUEPRINT.md).
The initial workspace, TypeScript configuration, checks, and health-check app shell are
in place. The deterministic planning engine is the next implementation phase.

## Development

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- API health: http://localhost:3001/health

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The optional `ANTHROPIC_API_KEY` is kept server-side and is not required for the
deterministic fallback experience described in the blueprint.
