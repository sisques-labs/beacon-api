# Archive Report: Beacon MVP — Kafka-ingested Discord Notification Delivery

**Change**: `beacon-mvp`  
**Archived**: 2026-09-13  
**Artifact Store**: openspec  
**Status**: CLOSED — PASS

---

## Executive Summary

Beacon MVP establishes the first end-to-end notifications slice: Kafka ingestion → idempotent persistence → asynchronous Discord delivery → REST/GraphQL query. All 31 implementation tasks complete; verification passed with 11/11 spec scenarios compliant; 4 stacked PRs (#5–#8) merged to `develop` (2026-09-13). Specs synced to main (`openspec/specs/{notification-ingestion,notification-delivery,notification-query}/spec.md`); change archived to `openspec/changes/archive/2026-09-13-beacon-mvp/`.

---

## SDD Cycle Summary

| Phase | Artifact | Status | Key Facts |
|-------|----------|--------|-----------|
| Proposal | `proposal.md` | ✅ Approved | 3 new capabilities, 6 identified risks (all mitigated), rollback plan included |
| Spec (Delta) | 3 domain specs | ✅ Approved | 7 requirements, 11 scenarios, 7/7 requirements + 11/11 scenarios compliant |
| Design | `design.md` | ✅ Approved | 7 architecture decisions (D1–D7), 1 open question (resolved per final-state facts) |
| Tasks | `tasks.md` | ✅ Approved | 31 tasks across 3 phases/PRs, all marked complete (31/31 ✅) |
| Apply | (4 PRs merged) | ✅ Complete | #5 persistence+query, #6 ingestion+create, #7 delivery, #8 kit migration |
| Verify | `verify-report.md` | ✅ Pass | 182 unit + 6 integration + 16 E2E tests; 92.42% coverage; 0 blockers |
| Archive | This report | ✅ Done | Specs synced, change folder moved, audit trail closed |

---

## Final-State Facts (Authority Ranking)

Per the Final-State Authority contract, these outrank earlier snapshots:

### 1. **Task Completion Gate** (Highest Authority)
- **Persisted artifact**: `openspec/changes/archive/2026-09-13-beacon-mvp/tasks.md`
- **Status**: All 31 implementation tasks marked complete (`- [x]`); 0 unchecked tasks
- **Verification**: Grep confirmed 31 checked boxes, 0 unchecked

### 2. **Explicit Final-State Facts from Launch Prompt**
All 4 stacked PRs confirmed MERGED as of 2026-09-13:
- **PR #5** (`feat/beacon-mvp-persistence` → `develop`): merged 2026-09-13T18:14:57Z
- **PR #6** (`feat/beacon-mvp-ingestion` → `feat/beacon-mvp-persistence`): merged 2026-09-13T17:58:16Z
- **PR #7** (`feat/beacon-mvp-delivery` → `feat/beacon-mvp-ingestion`): merged 2026-09-13T17:58:01Z
- **PR #8** (`feat/beacon-kafka-inbound-consumer` → `feat/beacon-mvp-delivery`): merged 2026-09-13T17:57:47Z
- **Code location**: All changes live on `develop` branch

**Critical discrepancy noted**: PR #8 (not reflected in original `verify-report.md`, which predates its merge) migrated the Kafka inbound consumer from hand-rolled `kafkajs` to `@sisques-labs/nestjs-kit@1.11.0`'s declarative `@KafkaMessageHandler` inbound consumer. This means `design.md` decision **D1** ("Raw `kafkajs` consumer as `@Injectable() OnModuleInit`/`OnApplicationShutdown`") is now **STALE relative to shipped code**. The actual implementation uses the kit's `@KafkaMessageHandler`. This discrepancy is documented here for audit trail transparency; the archived design.md remains as written (timestamped before PR #8), but a future maintainer reading D1 and the code will find them misaligned.

### 3. **Intermediate Snapshots** (Lower Authority)
- `verify-report.md` snapshot written before PR #8 landed; remains valid record of verification state at that time but predates the design-implementation divergence
- `apply-progress` (if any) treated similarly — valid history, not current state

---

## Specs Synced to Main

Three new domain specs created under `openspec/specs/` (previously empty except `.gitkeep`):

| Domain | Action | Source | Requirements | Scenarios |
|--------|--------|--------|--------------|-----------|
| `notification-ingestion` | Created | `openspec/changes/archive/2026-09-13-beacon-mvp/specs/notification-ingestion/spec.md` | 4 (Kafka consumption, no-auth, dedupe, Discord-only) | 5 |
| `notification-delivery` | Created | `openspec/changes/archive/2026-09-13-beacon-mvp/specs/notification-delivery/spec.md` | 2 (async webhook, Discord-only) | 4 |
| `notification-query` | Created | `openspec/changes/archive/2026-09-13-beacon-mvp/specs/notification-query/spec.md` | 1 (GET by id, REST+GraphQL) | 3 |
| **Total** | **3 created** | — | **7 total** | **11 total** |

**Copy verification**: All three specs copied via `cp` + `diff` verification; empty diffs confirm byte-for-byte identity before moving to archive.

---

## Archive Contents

**Location**: `openspec/changes/archive/2026-09-13-beacon-mvp/`

| Artifact | Present | Status |
|----------|---------|--------|
| `proposal.md` | ✅ | Scope, approach, risks, rollback, success criteria |
| `specs/` | ✅ | 3 domain specs (ingestion, delivery, query) synced to main |
| `design.md` | ✅ | 7 architecture decisions; D1 now stale (see discrepancy above) |
| `tasks.md` | ✅ | All 31/31 tasks complete; 0 unchecked implementation tasks |
| `verify-report.md` | ✅ | Pass verdict; 182+6+16 tests; 92.42% coverage |
| `exploration.md` | ✅ | Pre-proposal research |
| `research.md` | ✅ | Pre-proposal research |
| `.openspec.yaml` | ✅ | Change metadata |

**Readback verification**: `diff -r` (source pre-move snapshot vs. archived folder) returned empty diff; archive is byte-identical to source at move time.

---

## Test & Build Status (Final)

Per `verify-report.md` (verification snapshot):

| Metric | Result |
|--------|--------|
| **Unit tests** | ✅ 182 passed |
| **Integration tests** | ✅ 6 passed (USE_TESTCONTAINERS=1) |
| **E2E tests** | ✅ 16 passed (USE_TESTCONTAINERS=1) |
| **Build** | ✅ Passed (`pnpm build`, `nest build` exit 0) |
| **Lint** | ✅ 0 errors (pre-existing eslint-plugin-boundaries warnings unrelated) |
| **Type check** | ✅ `tsc --noEmit` clean |
| **Coverage** | ✅ 92.42% statements (threshold: 80%) |
| **Requirements compliance** | ✅ 7/7 met |
| **Scenarios compliance** | ✅ 11/11 passed |

---

## Known Issues & Resolutions

### WARNING: `.env.example` Not Updated
- **Issue**: `KAFKA_INGEST_{ENABLED,TOPIC,GROUP_ID}` and `DISCORD_WEBHOOK_URL` implemented but not documented in `.env.example`
- **Root cause**: Tool sandbox denies write access to `.env*` files (both apply-progress and archive phases confirm this restriction)
- **Impact**: Onboarding gap for next engineer; no runtime defect
- **Resolution**: Must be closed manually before enabling `KAFKA_INGEST_ENABLED=true` in any environment
- **Status**: Documented as non-critical WARNING in verify-report

### RESOLVED: Design D1 Open Question
- **Original**: "Confirm D1 against the installed kit once `pnpm install` runs — swap to a kit inbound primitive if one exists"
- **Resolution**: PR #8 landed after this archive report window; implementation now uses kit's `@KafkaMessageHandler`
- **Implication**: D1 in `design.md` (hand-rolled kafkajs) is now stale relative to shipped code
- **Closure**: Final-state facts override intermediate snapshots per authority hierarchy; actual implementation is authoritative

---

## Archive Audit Trail

**Mechanical operations performed** (via shell only, never model Read/Write):

1. **Spec sync** (3 domains):
   - `cp` each delta spec to `openspec/specs/{domain}/spec.md`
   - `diff` verification after each copy (empty diff = success)
   - No `sdd-archive-compose` used (new main specs, not merging into existing)

2. **Change folder move**:
   - Pre-move snapshot created: `cp -R openspec/changes/beacon-mvp → /tmp/snapshot`
   - `git mv openspec/changes/beacon-mvp openspec/changes/archive/2026-09-13-beacon-mvp`
   - Post-move verification: `diff -r /tmp/snapshot → archive` (empty diff = success)
   - Source removed, archive verified present

3. **Archive report written** (this file):
   - Additive only; archived before this report did not exist
   - Persisted to both filesystem (openspec mode) and Engram (hybrid protocol)

**Evidence**: All `diff -r` outputs empty; no bytes altered, truncated, or lost.

---

## SDD Cycle Closure Checklist

- [x] Task Completion Gate: all 31 tasks checked, 0 unchecked
- [x] Specs synced to main: 3 new domains, 7 requirements, 11 scenarios
- [x] Change folder moved to archive: git mv to `2026-09-13-beacon-mvp`
- [x] Archive verified: diff readback passed (empty diff)
- [x] Active changes directory no longer contains beacon-mvp
- [x] Main specs now source-of-truth for notification domain behavior
- [x] Archive report written: this file
- [x] Artifact store persisted: filesystem (openspec) + Engram (hybrid)

---

## Next Recommended Steps

**SDD Cycle Complete** — no follow-up SDD phase needed.

Future work:
1. **Manual**: Close `.env.example` onboarding gap before production deployment
2. **Optional**: Add test asserting `KAFKA_ENABLED` (outbound forwarder) remains untouched when `KAFKA_INGEST_ENABLED` toggles (currently implicit, no direct test)
3. **Optional**: Update `design.md` D1 to note the migration from hand-rolled kafkajs to kit's `@KafkaMessageHandler` (post-archive documentation)
4. **Next change**: `notification-delivery-decoupling` is queued in `openspec/changes/` (separate change, separate SDD cycle)

---

## Key Learnings

1. Stacked PR chains require careful final-state verification when intermediate snapshots (verify-report, apply-progress) are created before all PRs land; the final merged code is authoritative.
2. Design decisions documenting implementation details (D1: kafkajs consumer) can become stale if the implementation path changes via later PRs; archive reports must flag such discrepancies rather than silently accepting the snapshot.
3. Tool sandbox restrictions (e.g., denying `.env*` writes) are genuine environment constraints, not agent oversights, and must be documented for closure outside the SDD cycle.
4. Mechanical archive operations (cp/mv/diff) with full readback verification are the only way to guarantee artifact integrity; model-driven Read/Write copying silently truncates.
5. Dual-persistence (filesystem + Engram for hybrid mode) ensures both synchronous repository audit trails and asynchronous persistent memory capture across sessions.
