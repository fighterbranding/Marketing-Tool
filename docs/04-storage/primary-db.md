# Primary database

## Overview

PostgreSQL holding the relational core: clients (tenants), your platform's own users, Meta connections per client, and campaign configuration metadata. Use Prisma as the ORM for type-safe queries and migration management.

## Schema (Prisma)

```prisma
// prisma/schema.prisma

model Client {
  id          String   @id @default(uuid())
  name        String
  createdAt   DateTime @default(now())
  users       User[]
  connections MetaConnection[]
  campaigns   Campaign[]
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  passwordHash String
  role      Role     @default(MEMBER)
  client    Client   @relation(fields: [clientId], references: [id])
  clientId  String
  createdAt DateTime @default(now())
}

enum Role {
  ADMIN
  MEMBER
}

model MetaConnection {
  id                String   @id @default(uuid())
  client            Client   @relation(fields: [clientId], references: [id])
  clientId          String
  connectionType    ConnectionType
  encryptedToken     String   // AES-256-GCM ciphertext, base64
  encryptionIv       String
  encryptionTag      String
  adAccountId       String?
  businessId        String?
  scopes            String[] // granted scopes, for auditing
  status            ConnectionStatus @default(ACTIVE)
  expiresAt         DateTime?
  lastSyncedAt      DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([clientId])
}

enum ConnectionType {
  USER_TOKEN
  SYSTEM_USER
}

enum ConnectionStatus {
  ACTIVE
  NEEDS_RECONNECT
  REVOKED
}

model MetaAsset {
  id              String   @id @default(uuid())
  connection      MetaConnection @relation(fields: [connectionId], references: [id])
  connectionId    String
  assetType       AssetType
  metaAssetId     String   // Meta's own ID for the page/IG account
  name            String
  encryptedToken  String?  // Page-level tokens are separate from the user/system token
  encryptionIv    String?
  encryptionTag   String?

  @@unique([connectionId, metaAssetId])
}

enum AssetType {
  PAGE
  INSTAGRAM_ACCOUNT
  WHATSAPP_ACCOUNT
}

model Campaign {
  id              String   @id @default(uuid())
  client          Client   @relation(fields: [clientId], references: [id])
  clientId        String
  metaCampaignId  String   @unique // Meta's own campaign ID
  name            String
  objective       String
  status          String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([clientId])
}
```

## Key design decisions

**Encrypted tokens stored alongside their IV and auth tag** (not as one blob) — keeps the AES-256-GCM components explicit and queryable for rotation/auditing without needing to decrypt first.

**`MetaConnection` and `MetaAsset` are separate tables** — a single Meta connection (one OAuth grant) can surface multiple assets (a Page, its linked Instagram account, a WhatsApp Business account), each potentially needing its own asset-level token (see [pages-api.md](../03-meta-api/pages-api.md)).

**`Campaign` stores only metadata, not performance data** — the actual metrics live in the analytics store (TimescaleDB), not here. This table exists so your campaign manager UI has something to query quickly without hitting the analytics store or Meta directly for the campaign list.

**Multi-tenancy via `clientId` foreign key everywhere** — every query in your services should filter by the authenticated user's `clientId`. Consider Postgres Row-Level Security as a defense-in-depth measure once you have real client data, so a bug in application-layer filtering can't leak one client's data to another.

## Migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Estimated time

1-2 days for the initial schema, expect to add fields as you build out each module (this schema is post-validated against ones documented elsewhere in this blueprint).
