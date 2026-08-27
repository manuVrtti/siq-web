# Plan 050 — Public API & Webhooks Platform

## 1. Objective

Expose a secure, documented public API and outbound webhook system so colleges and companies can integrate SelectIQ with their existing systems (ERPs, ATSs, HRMS), extending the platform's reach and stickiness.

## 2. Scope

- API key management (per-org, scoped)
- Public REST API (versioned) for core resources
- API authentication and rate limiting
- Outbound webhooks (event subscriptions)
- Webhook delivery with retries and signing
- API documentation (auto-generated)
- Developer settings UI

### Out of Scope

- GraphQL API (REST is sufficient)
- OAuth app marketplace (Sprint 6)
- Native prebuilt integrations (partner-specific, future)

## 3. Prerequisites / Dependencies

- Plans 31–38 (the resources and events to expose)
- Plan 34 (async — webhook delivery via queue)
- Plan 37 (audit — API actions logged)
- Plan 36 (billing — API access as a plan feature)

## 4. Technical Approach

The public API is a versioned (`/api/v1/`) surface separate from the internal app APIs, authenticated via org-scoped API keys (not Firebase sessions). Keys carry scopes (read/write per resource) and are rate-limited per plan tier (Plan 36).

Outbound webhooks let integrators subscribe to events (assessment completed, candidate placed, offer accepted). When events fire, the platform enqueues signed webhook deliveries (Plan 34) with retries and HMAC signatures for verification.

API access is a paid-plan feature (Plan 36), aligning monetization with integration value. Everything is documented via an OpenAPI spec that generates interactive docs.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   model ApiKey {
     id            String    @id @default(cuid())
     orgId         String
     name          String
     keyPrefix     String    // visible prefix for identification
     keyHash       String    // hashed secret
     scopes        String[]  // e.g. ["assessments:read", "candidates:write"]
     lastUsedAt    DateTime?
     expiresAt     DateTime?
     revokedAt     DateTime?
     createdById   String
     createdAt     DateTime  @default(now())

     org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

     @@index([orgId])
     @@index([keyPrefix])
   }

   model WebhookEndpoint {
     id            String    @id @default(cuid())
     orgId         String
     url           String
     secret        String    // for HMAC signing
     events        String[]  // subscribed event types
     active        Boolean   @default(true)
     createdAt     DateTime  @default(now())

     org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
     deliveries    WebhookDelivery[]

     @@index([orgId])
   }

   model WebhookDelivery {
     id            String    @id @default(cuid())
     endpointId    String
     event         String
     payload       Json
     status        String    // "pending", "delivered", "failed", "dead"
     attempts      Int       @default(0)
     responseCode  Int?
     lastError     String?
     deliveredAt   DateTime?
     createdAt     DateTime  @default(now())

     endpoint      WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

     @@index([endpointId])
     @@index([status])
   }
   ```
2. Run migration: `npx prisma migrate dev --name public_api_webhooks`
3. Create `lib/api/keys.ts`:
   - `generateApiKey()` — secure key (prefix + secret), store hash
   - `verifyApiKey(rawKey)` — resolve org + scopes, update lastUsedAt
   - `hasScope(apiKey, scope)`
4. Create `lib/api/auth-middleware.ts`:
   - API key extraction (Authorization: Bearer) for `/api/v1/*`
   - Scope enforcement per endpoint
   - Rate limiting per plan tier (reuse/extend Plan 05 rate limiter, backed by DB or in-memory)
5. Create versioned public API routes `/app/api/v1/`:
   - `assessments/route.ts`, `assessments/[id]/route.ts` (read; write scoped)
   - `candidates/route.ts` (read, scoped to org)
   - `results/route.ts` (read)
   - `jobs/route.ts` (read/write)
   - `applications/route.ts` (read)
   - `placements/route.ts` (read)
   - Consistent envelope, pagination, error format (reuse Plan 10 api-response)
6. Create `services/webhooks.ts`:
   - `createEndpoint(orgId, url, events)` / `updateEndpoint` / `deleteEndpoint`
   - `emit(orgId, event, payload)` — finds subscribed endpoints, enqueues signed deliveries (Plan 34)
   - `deliverWebhook(deliveryId)` — job handler: POST with HMAC signature, retry/backoff, mark dead after N
   - `verifySignature(payload, signature, secret)` — for docs/testing
7. Emit events from feature services:
   - `assessment.completed` (Plan 15/16), `candidate.placed` (Plan 27), `offer.accepted` (Plan 27), `application.advanced` (Plan 24), `drive.completed` (Plan 28)
8. Register webhook delivery handler in Plan 34's job handlers
9. Generate API docs:
   - `lib/api/openapi.ts` — OpenAPI spec definition
   - `/app/(protected)/developers/docs/page.tsx` — interactive docs (Swagger UI or similar, or a static rendered spec)
   - `/api/v1/openapi.json` — spec endpoint
10. Create developer settings pages:
    - `/app/(protected)/developers/page.tsx` — overview, getting started
    - `/app/(protected)/developers/api-keys/page.tsx` — create/revoke keys, view scopes
    - `/app/(protected)/developers/webhooks/page.tsx` — manage endpoints, view deliveries, test/replay
11. Gate API access behind plan feature (Plan 36):
    - Free tier: no API; Pro/Enterprise: API enabled with tier-based rate limits
12. Create components:
    - `components/developers/api-key-manager.tsx`
    - `components/developers/webhook-manager.tsx`
    - `components/developers/delivery-log.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | ApiKey, WebhookEndpoint, WebhookDelivery |
| Create | `lib/api/keys.ts` | API key management |
| Create | `lib/api/auth-middleware.ts` | API auth + rate limit |
| Create | `lib/api/openapi.ts` | OpenAPI spec |
| Create | `app/api/v1/*/route.ts` | Public API |
| Create | `services/webhooks.ts` | Webhook logic |
| Modify | `lib/jobs/handlers.ts` | Webhook delivery handler |
| Modify | Feature services | Emit events |
| Create | `app/(protected)/developers/*` | Developer UI |
| Create | `components/developers/*.tsx` | Developer components |

## 7. Testing / Verification

- [ ] Create API key → prefix shown, secret shown once
- [ ] Call `/api/v1/assessments` with valid key → data returned
- [ ] Call with invalid/revoked key → 401
- [ ] Call endpoint without required scope → 403
- [ ] Rate limit enforced per plan tier
- [ ] Revoke key → subsequent calls rejected
- [ ] Create webhook endpoint subscribing to `candidate.placed`
- [ ] Placement occurs → webhook delivered with HMAC signature
- [ ] Signature verifies against secret
- [ ] Webhook endpoint down → retries with backoff → marked dead after N
- [ ] Replay failed delivery from UI
- [ ] Free tier → API access blocked with upgrade prompt
- [ ] Pro tier → API enabled
- [ ] OpenAPI docs render, endpoints accurate
- [ ] API actions audited
- [ ] Cross-org: key only accesses its own org's data
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: public API structure (`/api/v1`, key auth vs session auth), scopes, webhook emit + delivery, API as plan feature
- Add to `docs/project-context.md`: Plan 39 completed, public API + webhooks live
- Publish external API docs (developer portal)

## 9. Estimated Effort

- Claude Code execution: ~70 minutes
- Manual testing: ~30 minutes (keys, scopes, rate limits, webhook delivery)
- Documentation updates: ~10 minutes
