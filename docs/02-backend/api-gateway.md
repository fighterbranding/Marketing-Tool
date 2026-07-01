# API gateway

## Overview

The single entry point your frontend talks to. In a NestJS monolith (recommended for this project's scale), this isn't a separate service — it's the top-level app module plus shared middleware: rate limiting, request validation, error formatting, and routing into feature modules.

Starting as a monolith rather than separate microservices is the right call here. You don't have the scale to justify the operational overhead of splitting auth/sync/insights into separate deployable services yet — do that later if a specific module becomes a bottleneck.

## Implementation steps

### 1. Project skeleton

```bash
npm i -g @nestjs/cli
nest new backend
cd backend
npm i @nestjs/throttler class-validator class-transformer
```

### 2. Global rate limiting

Protects your API from abuse, separate from respecting Meta's own rate limits (which live inside the `meta-client` module, see [sync-engine.md](sync-engine.md)).

```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), // 100 req/min per IP
    AuthModule, ClientsModule, SyncModule, InsightsModule, CampaignsModule, WebhooksModule,
  ],
})
export class AppModule {}
```

### 3. Global validation pipe

Every DTO gets validated automatically — catches malformed requests before they reach your business logic.

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

### 4. Global exception filter

Normalize error responses, and specifically catch Meta API errors so the frontend gets a consistent shape regardless of whether the failure was yours or Meta's.

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof MetaApiError) {
      return res.status(502).json({
        error: 'meta_api_error',
        code: exception.metaErrorCode,
        message: exception.message,
      });
    }
    // ... handle other cases
  }
}
```

### 5. Authentication guard for your own API

Separate from Meta OAuth — this is how your frontend authenticates with *your* backend (your users log into your platform, then your platform uses stored Meta tokens on their behalf). Use JWT issued on your own login, NestJS `@nestjs/jwt` + a guard checking the `Authorization` header.

### 6. Multi-tenancy

Every request after login should resolve to a `clientId` (which client/tenant the logged-in user belongs to), and every downstream query (insights, campaigns) should be scoped to that client's stored Meta connection. Build this as a request-scoped decorator early — retrofitting tenant isolation later is painful and risky.

```typescript
@Injectable()
export class ClientScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.clientId = req.user.clientId; // from JWT payload
    return true;
  }
}
```

## Estimated time

2-3 days for the skeleton, rate limiting, validation, and tenant scoping pattern.
