# Backend layer overview

The backend is a NestJS application organized into feature modules that map directly to the squares in the architecture diagram. Each module is documented in its own file in this folder.

## Modules

| Module | File | Responsibility |
|---|---|---|
| Auth service | [auth-service.md](auth-service.md) | Meta OAuth flow, token storage/refresh |
| API gateway | [api-gateway.md](api-gateway.md) | Request entry point, rate limiting, routing to modules |
| Sync engine | [sync-engine.md](sync-engine.md) | Scheduled background jobs pulling data from Meta |
| Webhooks | [webhooks.md](webhooks.md) | Receiving real-time events from Meta |

## Suggested NestJS project layout

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── meta-oauth.strategy.ts
│   │   └── dto/
│   ├── clients/              # client (tenant) management
│   │   ├── clients.module.ts
│   │   ├── clients.controller.ts
│   │   └── clients.service.ts
│   ├── sync/
│   │   ├── sync.module.ts
│   │   ├── sync.processor.ts  # BullMQ job processor
│   │   └── sync.service.ts
│   ├── insights/
│   │   ├── insights.module.ts
│   │   ├── insights.controller.ts
│   │   └── insights.service.ts
│   ├── campaigns/
│   │   ├── campaigns.module.ts
│   │   ├── campaigns.controller.ts
│   │   └── campaigns.service.ts
│   ├── webhooks/
│   │   ├── webhooks.module.ts
│   │   └── webhooks.controller.ts
│   ├── meta-client/           # shared wrapper around the Meta SDK
│   │   ├── meta-client.module.ts
│   │   └── meta-client.service.ts
│   └── common/
│       ├── guards/
│       ├── interceptors/
│       └── filters/
├── prisma/
│   └── schema.prisma
├── test/
├── .env
└── package.json
```

The `meta-client` module is the important architectural decision here: every other module (insights, campaigns, webhooks) should call into this shared service rather than importing the Meta SDK directly. That's where you centralize token injection, rate-limit backoff, and error normalization once, instead of repeating it in every module.

## Build order within this layer

1. `meta-client` (shared wrapper, even if empty at first)
2. `auth` (depends on meta-client for the token exchange call)
3. `clients` (tenant model, depends on auth)
4. `sync` + `insights` (depends on meta-client + clients)
5. `campaigns` (depends on meta-client + clients)
6. `webhooks` (depends on clients, independent of sync)
