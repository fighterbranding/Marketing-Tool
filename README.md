# Meta marketing platform

A multi-client SaaS platform that connects to clients' Meta Business accounts (Facebook, Instagram, WhatsApp) to display analytics and manage ad campaigns.

## Stack

- **Frontend:** Next.js (React) + TypeScript + Tailwind
- **Backend:** NestJS (Node.js / TypeScript)
- **Primary DB:** PostgreSQL
- **Analytics DB:** TimescaleDB (Postgres extension, time-series metrics)
- **Cache / tokens:** Redis
- **Job queue:** BullMQ
- **External:** Meta Graph API / Marketing API

## Repo structure

```
meta-marketing-platform/
├── backend/              # NestJS API (scaffolded as you build)
├── frontend/             # Next.js app (scaffolded as you build)
├── infra/                # Docker, deployment configs
├── docs/
│   ├── BLUEPRINT.md      # Master plan: phases, timeline, dependencies
│   ├── SKILLS.md         # Tools, libraries, and skills to use per layer
│   ├── GITHUB_SETUP.md   # How to push this to your own GitHub repo
│   ├── 01-frontend/      # Docs for each frontend square
│   ├── 02-backend/       # Docs for each backend square
│   ├── 03-meta-api/      # Docs for each Meta API integration
│   └── 04-storage/       # Docs for each storage component
├── .env.example
└── .gitignore
```

## Where to start

1. Read `docs/BLUEPRINT.md` for the full build order and phase plan.
2. Read `docs/SKILLS.md` for the tools/libraries/skills needed at each layer.
3. Work through `docs/02-backend/auth-service.md` first — nothing else works until OAuth is connected.
4. Follow `docs/GITHUB_SETUP.md` to push this to your own GitHub account.
