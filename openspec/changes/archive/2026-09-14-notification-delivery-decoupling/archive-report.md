# Archive Report: notification-delivery-decoupling

**Status**: ARCHIVED  
**Change**: `notification-delivery-decoupling`  
**Archived to**: `openspec/changes/archive/2026-09-14-notification-delivery-decoupling/`  
**Date**: 2026-09-14  
**Verdict**: PASS WITH WARNINGS (0 critical findings)  
**Observation ID**: 700

## Change Summary

Durable, retrying notification delivery via BullMQ + Redis to replace the original exactly-once-with-no-retry behavior. A transient webhook error or mid-delivery crash no longer leaves a notification permanently `PENDING` with no re-drive.

### Capabilities Delivered

**Modified**:
- `notification-delivery`: Asynchronous Discord webhook delivery now retries with bounded backoff and exhaustion terminal, rather than failing on the first error.

**New**:
- `notification-delivery-queue`: Durable enqueue and in-process worker consumption via BullMQ, with configurable retry policy and Redis readiness.

## Implementation Status

**All tasks complete**: 32/32  
**Verification**: pass_with_warnings (per observation ID 700)  
**Critical findings**: 0  
**All spec scenarios covered**: 11/11 (5 requirements)

### Spec Coverage

| Domain | Type | Count | Status |
|--------|------|-------|--------|
| notification-delivery | Modified requirement | 1 req / 4 scenarios | COVERED |
| notification-delivery-queue | New capability | 4 req / 7 scenarios | COVERED |

Scenarios independently re-verified per observation ID 700:
1. ✅ Successful delivery transitions to SENT
2. ✅ Transient failure is retried before exhaustion  
3. ✅ Exhausted retries transition to terminal FAILED
4. ✅ Crash between enqueue and delivery still delivers
5. ✅ Enqueue succeeds (durable persistence)
6. ✅ Enqueue failure does not lose the notification (CRITICAL finding resolved with commit 2123b92)
7. ✅ Queued job dispatches unchanged delivery command
8. ✅ Transient failure retried and later succeeds
9. ✅ Maximum attempts reached
10. ✅ Redis reachable reports healthy
11. ✅ Redis unreachable fails readiness

### Test Evidence

Per observation ID 700, re-verified 2026-09-13 21:57:09:

- **Unit tests**: 52 test files, 203 tests pass (↑1 from prior run; new test for enqueue-failure fix)
- **Linting**: 0 violations
- **TypeScript**: 0 type errors (`tsc --noEmit`)
- **Coverage**: Statements 93.22%, Branches 93.29%, Functions 94.07%, Lines 93.10% (no regression)
- **CI (GitHub Actions)**: All 4 application-gating jobs green on all PRs:
  - PR#11 (redis): e2e ✅ integration ✅ lint/build/unit ✅ docker smoke ✅
  - PR#12 (queue): e2e ✅ integration ✅ lint/build/unit ✅ docker smoke ✅
  - PR#13 (retry): e2e ✅ integration ✅ lint/build/unit ✅ docker smoke ✅ (was pending, now resolved)
  - PR#14 (e2e): e2e ✅ integration ✅ lint/build/unit ✅ docker smoke ✅

## Delivery Chain (Open/Unmerged at Archive Time)

This change is shipped as 4 stacked PRs on branch `sisques-labs/beacon-api`:

| PR | Title | Branch | Base | Status |
|----|-------|--------|------|--------|
| #11 | feat: beacon-delivery-decoupling-redis | feat/beacon-delivery-decoupling-redis | develop | DRAFT (open) |
| #12 | feat: beacon-delivery-decoupling-queue | feat/beacon-delivery-decoupling-queue | PR#11 | DRAFT (open) |
| #13 | feat: beacon-delivery-decoupling-retry | feat/beacon-delivery-decoupling-retry | PR#12 | DRAFT (open) |
| #14 | feat: beacon-delivery-decoupling-e2e | feat/beacon-delivery-decoupling-e2e | PR#13 | DRAFT (open) |
| #15 | chore: archive notification-delivery-decoupling | chore/archive-notification-delivery-decoupling | PR#14 | DRAFT (archive placeholder) |

**Important**: PRs #11-#14 are OPEN and UNMERGED at the time this archive was created (2026-09-14). They remain pending human review and merge to `develop`. This archive documents the complete, verified, and CI-validated implementation as it exists on those branches and commits, ready for merge in sequence once the user completes review.

### Design Deviations from Proposal

**D7 (Design Decision 7)**: Redis is unconditionally required, not env-gated.  
- **Proposal stated**: "env-gated config following `kafka-ingest.config.ts`" (suggesting optional behavior).
- **Design corrected to**: Unconditional `BullModule.forRootAsync` in `core.module.ts`; `REDIS_HOST` required in `env.validation.ts` like `DATABASE_HOST`.
- **Rationale**: Ingestion is genuinely optional; delivery is not. A gated fallback would preserve the exactly-once bug behind a flag and double the test paths. A half-configured service that silently never delivers is worse than one that refuses to boot (fail-fast).
- **Recorded in**: `design.md` D7 with explicit note "Design-time correction to the proposal."

## Critical Finding Resolution

**Prior Verdict** (superseded): FAIL with 1 CRITICAL, 2 WARNING  
**CRITICAL**: Enqueue-failure scenario "Enqueue failure does not lose the notification" was untested (spec scenario present but no test exercised it).  

**Resolution** (per observation ID 700, independently verified):

1. **Source fix**: Commit 2123b92 added try/catch wrapping `queue.add(...)` in `BullMqNotificationDeliveryQueueAdapter.enqueue()` (lines 38-54). On rejection, it calls `this.logger.error(\`Failed to enqueue delivery for notification ${notificationId}: ${reason}\`)` then rethrows. Verified byte-for-byte against `git show 2123b92`.

2. **Correctness proof**: `DeliverNotificationOnCreatedHandler.handle()` performs no database write — the notification is already persisted `PENDING` by `CreateNotificationCommandHandler`. A thrown enqueue failure cannot revert or lose the persisted state; it only propagates outward. Handler proves: "remain persisted PENDING" clause is structural, not contingent on error handling.

3. **Test coverage**: New test `bullmq-notification-delivery-queue.adapter.spec.ts:51-63` asserts both the rethrow (`await expect(adapter.enqueue(...)).rejects.toThrow(redisError)`) AND the log call via spy (`expect(errorSpy).toHaveBeenCalledWith('Failed to enqueue...')`).

4. **Empirical RED→GREEN proof**: Temporarily restored pre-fix adapter (commit 6859f32 content with no try/catch). Reran spec in isolation: 1/3 tests failed — specifically the log assertion. This proves the test is not vacuous and genuinely gates the fixed behavior. Restored fixed file; verified clean restore via `git status`/`git diff --stat`.

5. **Design alignment**: `design.md` Observability section states: "Enqueue failures are logged at error and rethrown, never swallowed." Implementation matches exactly.

**Verdict on CRITICAL**: RESOLVED. Scenario now COVERED with runtime-verified test.

## Artifacts Synced to Main Specs

| Artifact | Action | Details |
|----------|--------|---------|
| `openspec/specs/notification-delivery/spec.md` | Created | Merged from delta; 1 MODIFIED requirement (Asynchronous Discord Webhook Delivery with retry), 1 requirement scoped out (Delivery Limited to Discord), 4 scenarios total |
| `openspec/specs/notification-delivery-queue/spec.md` | Created | Merged from delta; 4 new requirements (Durable Enqueue, In-Process Worker, Bounded Retry, Redis Readiness), 7 scenarios total |

Both specs are delta-to-main merges (main specs did not previously exist in `openspec/specs/`; they are populated now). Mechanical copy verified with empty `diff -r` output.

## Archive Contents

- ✅ `proposal.md`
- ✅ `design.md` (9 decisions, D1-D9 all confirmed)
- ✅ `tasks.md` (32/32 complete)
- ✅ `specs/notification-delivery/spec.md`
- ✅ `specs/notification-delivery-queue/spec.md`
- ✅ `verify-report.md`
- ✅ `archive-report.md` (this file)

## Source of Truth Updated

The following specs now reflect the delivered behavior:
- `openspec/specs/notification-delivery/spec.md` — updated to describe retry-backed delivery
- `openspec/specs/notification-delivery-queue/spec.md` — new, describes BullMQ queue capability

## Verification Compliance

This archive records the state at close per the Final-State Authority hierarchy:

1. **Persisted tasks artifact**: All 32/32 tasks marked `[x]` in `openspec/changes/archive/2026-09-14-notification-delivery-decoupling/tasks.md`.
2. **Explicit final-state facts from launch prompt**: Verify verdict pass_with_warnings, 0 critical (confirmed via observation ID 700).
3. **Verify-report and apply-progress**: Intermediate snapshots; final state is the above two sources.

No intermediate snapshot claims override the task completion gate or the verify verdict. The change is ready for merge.

## Non-Blocking Notes

Per observation ID 700, two items remain (acceptable for this scope, do not block archive):

1. **CI job naming** (downgraded to SUGGESTION): Job labels in GitHub Actions still say "E2E tests (Postgres)" and "Integration tests (Postgres)" despite the `redis` service added in PR#11's CI diff (`.github/workflows/ci.yml` lines 40-45 and 99-104). Confirmed cosmetic — the Redis service is declared and health-checked in both jobs; this is a stale label. Recommend a trivial follow-up rename, but does not affect functional correctness or test coverage.

2. **Design Open Questions** (pre-accepted, not blockers): `design.md` sections still contain unchecked items:
   - Production Redis provisioning (managed instance vs. sidecar) and AOF persistence strategy
   - Whether `removeOnFail` should retain failed-job history for ops inspection
   
   These are acceptable for v1 scope; flag before production rollout.

3. **Exponential backoff without jitter** (pre-accepted, v1 limitation): No jitter applied in v1 for a single, low-volume webhook destination. Revisit if delivery volume scales.

## SDD Cycle Complete

- ✅ Proposed (proposal.md)
- ✅ Researched (design decisions and threat matrix)
- ✅ Designed (9 decisions D1-D9, all confirmed)
- ✅ Tasked (32/32 complete)
- ✅ Applied (4 PRs, CI green, 203 tests passing)
- ✅ Verified (pass_with_warnings, 0 critical, 11/11 scenarios covered, CRITICAL finding resolved)
- ✅ Archived (2026-09-14)

Ready for the next change. Pending user review and merge of #11-#14 to `develop`.

---

**Archive created**: 2026-09-14 14:00:00 UTC  
**Verify observation ID**: 700 (RE-VERIFY after remediation, 2026-09-13 21:57:09)  
**Change folder**: `openspec/changes/archive/2026-09-14-notification-delivery-decoupling/`  
**Main specs location**: `openspec/specs/notification-delivery/` and `openspec/specs/notification-delivery-queue/`
