## Exploration: Beacon MVP scope (platform notification service)

### Current State

`notifications` is the only bounded context, **domain-only** (SDD change `notification-domain`, applied, 45 unit tests green). What exists under `src/contexts/notifications/domain/`:
- `NotificationAggregate` (extends `BaseAggregate`/`INotification extends IBaseAggregate`) with fields: `tenantId` (UuidValueObject), `recipientUserId` (UuidValueObject — NOT a channel address like an email or device token), `channel` (enum EMAIL|PUSH|DISCORD), `status` (enum PENDING|SENT|FAILED|CANCELLED|READ), `title`, `body`, `sourceService` (free string, max 100, e.g. "gardenia"), `dedupeKey` (mandatory string, max 255), `failureReason`, `sentAt`/`readAt`/`cancelledAt`.
- Status machine is intentionally narrow and already a settled decision (D5 in prior design): `PENDING → SENT|FAILED|CANCELLED`, `SENT → READ`. **No retry transition exists** — FAILED is terminal by domain design already, not an open question.
- Read/write repository ports (`INotificationReadRepository`/`INotificationWriteRepository`) extend the generic `IBaseReadRepository<ViewModel>`/`IBaseWriteRepository<Aggregate>` kit interfaces — standard shape, no custom methods yet (e.g. no `findByDedupeKey`).
- Builder pattern, domain events per transition, `NotificationViewModel`, primitives — all follow gardenia-api conventions.
- Nothing exists yet: no `contexts.module.ts` registration, no application layer (commands/queries/handlers), no TypeORM entity/mapper/repository, no transport (REST/GraphQL/MCP), no external channel providers (email/push/Discord senders), no auth wiring specific to this context.

Cross-cutting infra already wired at `src/core/` (usable, zero extra setup):
- `AuthClientModule` (`@sisques-labs/nestjs-kit/auth-client`) verifies **Sisques Account access tokens** for human end users via `JwtAuthGuard`/`@CurrentUser()` — opt-in via `AUTH_ENABLED`/`AUTH_JWT_SECRET`. This is built for human-user auth, not service-to-service (app calling app) auth — Gardenia calling Beacon is not a human with an Account JWT, so this guard does not directly solve tenant/client identification for the ingress use case.
- `MessagingModule` (Kafka) already forwards **any** aggregate's domain events to a Kafka topic keyed by bounded-context module name (`AGGREGATE_MODULE_MAP` auto-generated, already includes `NotificationAggregate: 'notifications'`), opt-in via `KAFKA_ENABLED`. This means `NotificationCreatedEvent`/`SentEvent`/`FailedEvent`/etc. can be forwarded to Kafka for free, with zero extra wiring, if enabled — this is an existing audit/integration-event pipe, not necessarily the delivery queue.
- `EventStoreModule` (KurrentDB) is an opt-in parallel forwarder of domain events for event-sourcing/audit purposes — independent of Postgres/TypeORM, which remains the actual aggregate state store via the standard read/write repository ports.
- GraphQL (Apollo), REST (Express + Swagger), and MCP (`@modelcontextprotocol/sdk` via `McpModule`) are all already mounted at the app level; a context opts into whichever subset it needs (`architecture` skill: "Drop the graphql/, rest/, or mcp/ subtree entirely for a context that doesn't need that transport").

### Affected Areas (if/when MVP work proceeds)

- `src/contexts/notifications/application/` — commands (`send-notification`, maybe `cancel-notification`), queries (`notification-find-by-id`, maybe `notifications-find-by-criteria`), handlers, assert services — none exist yet.
- `src/contexts/notifications/infrastructure/persistence/typeorm/` — new `NotificationEntity`, `NotificationTypeormMapper`, `NotificationTypeormReadRepository`/`WriteRepository` implementing the existing domain ports. Needs a migration.
- `src/contexts/notifications/infrastructure/` (new subtree, name TBD at design time — `providers/` or `adapters/`) — one sender implementation per channel (email/push/Discord), each behind a port. The `architecture` skill only documents the cross-context port/adapter pattern (`application/ports/` + `infrastructure/adapters/`) for reaching *another bounded context*; using that same shape for an *external third-party* dependency (SendGrid, FCM, Discord webhook) is a reasonable reuse of the existing hexagonal pattern but is not literally specified — worth confirming at `sdd-design` time.
- `src/contexts/notifications/transport/rest/` (most likely primary transport for service-to-service ingress) and/or `transport/graphql/` — new controller/resolver, DTOs.
- `src/contexts/contexts.module.ts` — must register the new `NotificationsModule` in `CONTEXT_MODULES` (currently not registered at all since only domain exists).
- `src/core/` — likely needs a new service-to-service auth mechanism (guard/strategy) if API-key or shared-secret auth is chosen, since `AuthClientModule` alone does not cover this. Possibly `src/contexts/notifications/infrastructure/guards/{name}.guard.ts` per-context, or a new core-level cross-cutting guard if this is meant to be reused by every future context (any Sisques app calling Beacon needs the same client-identification mechanism, which is a cross-cutting concern, not notifications-specific).
- `INotificationWriteRepository`/read port and `NotificationAggregate` may need a new field or query capability (e.g. `findByDedupeKey`) to actually enforce the "mandatory dedupeKey" invariant as *idempotency* (reject/return-existing on duplicate) rather than just a stored value — currently nothing enforces dedupe uniqueness at persistence or command-handler level.

### MVP Shape — What's Already Decided vs. Genuinely Open

**Already decided (from `notification-domain`, do not re-litigate):**
- Multi-tenant from day one (`tenantId` on every notification).
- Three channels modeled: EMAIL, PUSH, DISCORD (but modeling ≠ shipping all three in MVP — see open question 3).
- Dedupe key is mandatory on every notification.
- FAILED is terminal — no retry/backoff state machine for v1. This significantly simplifies MVP: no retry scheduler needed.
- Status query capability (READ transition) exists in the domain, implying some notion of "mark as read" matters to the product even at this early stage — but whether a v1 API *exposes* it is still open (see question 5).

**Resolved during orchestrator clarification (see product-decisions note):**
1. **Ingress transport**: Kafka event consumption, not synchronous REST. Client apps (e.g. Gardenia) publish an event to a Kafka topic carrying channel, content, and the deliverable address — Beacon does not resolve addresses itself.
2. **Auth**: none for v1 (explicit accepted risk).
3. **Delivery mode**: asynchronous, end-to-end consistent with the Kafka ingress.
4. Research authorized and run for channel provider selection (see `research.md`).

**Still genuinely open — to resolve before/at `sdd-propose`:**

### Open Product Decisions (surface, do not decide)

3. **Channel scope for v1.** Domain models three channels; does MVP ship all three or start with one?
   - Discord (via incoming webhook URL, no bot needed) is the cheapest to stand up — no email deliverability concerns, no push-token/device-registration infra, good for internal/dev-facing notifications first.
   - Email (via a provider like Resend, Postmark, or SendGrid) is the most universally useful "notify a real end user" channel but requires domain verification, deliverability tuning, and an account with a provider.
   - Push (FCM/APNs) requires device-token registration/lifecycle management that doesn't exist anywhere in this codebase yet — the heaviest lift of the three.
   - Recommendation surface only (not a decision): starting with Discord webhook or Email covers realistic first use cases with the least new infrastructure; Push is the natural third phase once a device-registration concept exists. See `research.md` for provider-level evidence.

5. **Read/query API scope for v1.** Does MVP need:
   - A "get notification by id" query (status polling) — likely yes, minimal, needed to answer "did it send?" after async delivery.
   - A "list notifications for a tenant/recipient" query with the mandatory Criteria/filter pattern (per architecture skill, non-optional once `findByCriteria` exists) — could be deferred if there's no inbox/notification-center consumer yet.
   - A "mark as read" command (exercising the existing `SENT → READ` transition) — only relevant if there's a client rendering a notification inbox; otherwise this transition stays modeled but unused in v1.

6. **Dedupe enforcement mechanism.** `dedupeKey` is a mandatory value today but nothing enforces uniqueness. Should the write repository/table enforce a unique constraint on `(tenantId, dedupeKey)` and the command handler treat a duplicate as an idempotent no-op (return the existing notification) rather than an error? This needs deciding before the TypeORM entity/migration is designed.

7. **Kafka's role beyond ingress.** Ingress already uses Kafka (decision #1). Independent question: should Beacon *also* forward its own domain events (`NotificationCreatedEvent`/`SentEvent`/etc.) via the already-wired opt-in outbound forwarder, or leave that off for v1 since no consumer is defined yet?

### Risks

- Recipient-addressing note: caller still supplies the deliverable address directly in the Kafka event payload — no retroactive aggregate change needed as long as the address is carried in the event/command DTO rather than the aggregate itself, but confirm at `sdd-design`.
- No-auth-for-v1 (accepted risk): any producer with access to the ingress topic can create notifications for any tenant. Explicit accepted MVP tradeoff — must be flagged in spec/design, not silently dropped.
- The `findByCriteria` mandatory Criteria pattern (queryable-field enum + filterable-fields registry + QueryBuilder translation) is non-trivial boilerplate per the architecture skill — if question 5 lands on "yes, need a list query," that alone is a meaningful chunk of MVP effort, not a quick add.
- Building a Kafka consumer for ingress (new) is more implementation and operational surface than the domain-event-forwarder use already wired (outbound only) — do not conflate the two Kafka usages when designing.

### Ready for Proposal

Yes, pending resolution of open questions 3, 5, 6, 7 above (channel scope, query API scope, dedupe enforcement, outbound Kafka forwarding).
