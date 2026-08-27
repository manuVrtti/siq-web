# Plan 043 — Real-Time Delivery & Live Updates

## 1. Objective

Add real-time delivery so notifications, pipeline changes, and exam events push to clients instantly without polling, using Supabase Realtime as the transport.

## 2. Scope

- Real-time transport setup (Supabase Realtime channels)
- Live notification delivery (instant bell updates)
- Live pipeline updates (recruiter kanban reflects changes)
- Live exam monitoring signals (proctoring flags surface to admins)
- Connection management (reconnect, presence)
- Client-side subscription hooks

### Out of Scope

- Full presence/collaboration features (future)
- Real-time chat (future)
- Real-time analytics dashboards (Sprint 5)

## 3. Prerequisites / Dependencies

- Plan 31 complete (notifications to deliver in real time)
- Plan 24 (pipeline to update live)
- Plan 18 (proctoring flags to surface)
- Supabase project (Realtime is part of the existing Supabase stack)

## 4. Technical Approach

Supabase Realtime is already available in the Supabase stack (no new vendor). It offers two mechanisms: Postgres change subscriptions (listen to table changes) and broadcast channels (arbitrary messages). 

Since Prisma owns all writes, we use **broadcast channels** rather than Postgres CDC — the `notify()` service (Plan 31) and pipeline services publish messages to per-user or per-entity channels after their Prisma writes commit. Clients subscribe to relevant channels.

This keeps Prisma as the single write path (no Supabase client writes) while using Supabase Realtime purely as a message bus. Channels are scoped and access-controlled.

## 5. Implementation Steps

1. Create `lib/realtime/server.ts`:
   - Supabase Realtime client (broadcast publish only, service role)
   - `publishToUser(userId, event, payload)` — per-user channel `user:{userId}`
   - `publishToEntity(entityType, entityId, event, payload)` — e.g., `job:{jobId}` for pipeline
   - Called AFTER Prisma writes commit (not inside transactions)
2. Create `lib/realtime/client.ts`:
   - Supabase Realtime client (anon, browser)
   - Channel subscription helpers with auth token
3. Create client hooks:
   - `hooks/use-realtime-channel.ts` — subscribe to a channel, handle messages, auto-reconnect
   - `hooks/use-notifications-realtime.ts` — subscribe to `user:{userId}`, update notification state live
   - `hooks/use-pipeline-realtime.ts` — subscribe to `job:{jobId}`, update kanban live
4. Integrate real-time into notifications (Plan 31):
   - After `notify()` persists → `publishToUser(userId, 'notification', notification)`
   - Notification bell updates instantly (badge + dropdown)
5. Integrate into pipeline (Plan 24):
   - After advance/reject/bulk action → `publishToEntity('job', jobId, 'pipeline_update', change)`
   - Recruiter kanban reflects moves live (useful when multiple recruiters collaborate)
6. Integrate into proctoring (Plan 18):
   - High-severity flag during exam → `publishToEntity('assessment', assessmentId, 'proctoring_alert', flag)`
   - Admin live-monitoring view (optional page) surfaces alerts
7. Create channel authorization:
   - Supabase Realtime RLS/policies OR a token-check endpoint ensuring users only subscribe to channels they're authorized for (own user channel, jobs in their org)
   - `/app/api/realtime/token/route.ts` — issues scoped subscription auth
8. Add connection status indicator:
   - `components/realtime/connection-status.tsx` — subtle indicator, reconnect handling
9. Wire hooks into existing components:
   - Notification bell (Plan 31) → `use-notifications-realtime`
   - Kanban board (Plan 24) → `use-pipeline-realtime`
10. Graceful degradation: if Realtime unavailable, fall back to existing polling/refetch (no broken UX)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `lib/realtime/server.ts` | Server publish |
| Create | `lib/realtime/client.ts` | Client subscribe |
| Create | `hooks/use-realtime-channel.ts` | Generic subscription |
| Create | `hooks/use-notifications-realtime.ts` | Live notifications |
| Create | `hooks/use-pipeline-realtime.ts` | Live pipeline |
| Modify | `services/notifications.ts` | Publish after notify |
| Modify | `services/applications.ts` | Publish pipeline changes |
| Modify | `components/exam/proctoring-monitor.tsx` | Publish high-severity flags |
| Create | `app/api/realtime/token/route.ts` | Channel auth |
| Create | `components/realtime/connection-status.tsx` | Connection indicator |
| Modify | `components/notifications/notification-bell.tsx` | Use realtime hook |
| Modify | `components/pipeline/kanban-board.tsx` | Use realtime hook |

## 7. Testing / Verification

- [ ] Trigger notification → bell updates instantly (no refresh)
- [ ] Two browser sessions: notification in one appears live in the other (same user)
- [ ] Recruiter A advances candidate → Recruiter B's kanban updates live
- [ ] High-severity proctoring flag → admin monitor shows alert live
- [ ] Disconnect network → reconnects automatically when restored
- [ ] Realtime down → falls back to polling, no broken UI
- [ ] User cannot subscribe to another user's channel (auth enforced)
- [ ] Recruiter cannot subscribe to another org's job channel
- [ ] No Supabase client writes introduced (Prisma still sole write path)
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: "Supabase Realtime used as broadcast bus only — publish AFTER Prisma commit, never write via Supabase client"
- Add to `CLAUDE.md`: channel naming, subscription auth, graceful degradation
- Add to `docs/project-context.md`: Plan 32 completed, real-time delivery live

## 9. Estimated Effort

- Claude Code execution: ~55 minutes
- Manual testing: ~25 minutes (multi-session, reconnect, fallback)
- Documentation updates: ~5 minutes
