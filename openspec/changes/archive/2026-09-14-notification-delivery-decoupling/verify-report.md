```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:539519614aa91eed841b9659bf4b5cc81d04245735ce614c1a1dd53dcfc4a175
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 11/11
test_command: "pnpm test"
test_exit_code: 0
test_output_hash: sha256:a09d0c7f1eabaa63dfd4523952eb1a1920612f56ca0e41de2807f0b402d8f2a5
build_command: "npx tsc --noEmit"
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report: notification-delivery-decoupling (RE-VERIFY after remediation)

## Change Summary

Durable, retrying notification delivery via BullMQ + Redis, shipped as 4 stacked PRs (#11-#14) on `sisques-labs/beacon-api`: PR11 `feat/beacon-delivery-decoupling-redis` -> `develop`, PR12 `feat/beacon-delivery-decoupling-queue` -> PR11, PR13 `feat/beacon-delivery-decoupling-retry` -> PR12, PR14 `feat/beacon-delivery-decoupling-e2e` -> PR13.

This is a re-verification after remediation of the prior FAIL verdict (Engram `sdd/notification-delivery-decoupling/verify-report`, superseded). The prior run found 1 CRITICAL (untested enqueue-failure scenario) and 2 WARNING items. This report independently re-checks all findings from source, tests, and CI rather than trusting the remediation claim.

## Mode

Full artifacts present: proposal, design, tasks (32/32 complete), 2 delta specs (`notification-delivery`, `notification-delivery-queue`). Full verification performed: completeness, correctness, and design coherence.

## Task Completeness

32/32 tasks checked `[x]` in `tasks.md` (unchanged since prior verify). No unchecked tasks.

## CRITICAL Finding Re-Check: "Enqueue failure does not lose the notification"

Independently re-verified against `openspec/changes/notification-delivery-decoupling/specs/notification-delivery-queue/spec.md` scenario text:

> GIVEN the queue backend is unavailable when a notification is created
> WHEN enqueueing the delivery attempt fails
> THEN the notification MUST remain persisted `PENDING`
> AND the enqueue failure MUST be logged, never silently swallowed

Evidence gathered directly, not taken on faith:

1. **Source inspection** — `src/contexts/notifications/infrastructure/adapters/bullmq-notification-delivery-queue.adapter.ts:38-54` now wraps `queue.add(...)` in try/catch: on rejection it calls `this.logger.error(\`Failed to enqueue delivery for notification ${notificationId}: ${reason}\`)` then rethrows the original error. Read in full; matches `git show 2123b92` exactly (no drift between the commit and the working tree).
2. **Handler side-effect check** — `DeliverNotificationOnCreatedHandler.handle()` (`application/events/deliver-notification-on-created.handler.ts:31-34`) only calls `deliveryQueuePort.enqueue(...)`; it performs no database write. The notification was already persisted `PENDING` by `CreateNotificationCommandHandler` before this event fires, and this handler never touches the aggregate, so a thrown enqueue failure cannot revert or lose the persisted `PENDING` state — it only propagates the error outward. Confirms the "remain persisted PENDING" clause.
3. **Test exists and actually exercises the fix** — read `bullmq-notification-delivery-queue.adapter.spec.ts:51-63`: `queue.add.mockRejectedValueOnce(redisError)`, then asserts both `await expect(adapter.enqueue(NOTIFICATION_ID)).rejects.toThrow(redisError)` AND `expect(errorSpy).toHaveBeenCalledWith('Failed to enqueue delivery for notification ...: ...')` via a `vi.spyOn(Logger.prototype, 'error')` spy.
4. **RED->GREEN proved empirically, not assumed**: temporarily swapped the adapter file back to its pre-fix content (`git show 6859f32:.../bullmq-notification-delivery-queue.adapter.ts`, the version with no try/catch) and reran the spec file in isolation. Result: 1/3 tests failed — specifically the new "logs and rethrows..." test failed on the `errorSpy` assertion (`Number of calls: 0`), because the pre-fix adapter never logs on enqueue failure (the error still propagated via the caller's own unhandled-rejection path, but nothing was ever logged). Restored the fixed file afterward; `git status`/`git diff --stat` confirmed a clean, byte-identical restore. This is direct proof the test is not vacuous and genuinely gates the fixed behavior.
5. **design.md alignment** — `design.md` Observability section states verbatim: "Enqueue failures are logged at `error` and rethrown, never swallowed." The implementation matches this committed design decision exactly.

**Verdict on this finding: RESOLVED.** Scenario is now COVERED with a real, runtime-verified covering test.

## Requirement / Scenario Coverage (full re-check, both delta specs)

Counted directly from the two delta specs: **5 Requirements, 11 Scenarios** (`notification-delivery`: 1 req / 4 scenarios; `notification-delivery-queue`: 4 req / 7 scenarios) — unchanged count from prior verify.

| # | Requirement / Scenario | Status | Evidence |
|---|---|---|---|
| 1 | notification-delivery / Successful delivery -> SENT | COVERED | `test/notification-delivery.e2e-spec.ts:159` (`delivers to Discord and transitions to SENT...`); `deliver-notification.handler.spec.ts:69` |
| 2 | notification-delivery / Transient failure retried before exhaustion | COVERED | `test/notification-delivery.e2e-spec.ts:176` (`retries a transient failure and still reaches SENT...`); `deliver-notification.handler.spec.ts:151` |
| 3 | notification-delivery / Exhausted retries -> terminal FAILED | COVERED | `test/notification-delivery.e2e-spec.ts:193` (`retries until exhaustion then transitions to FAILED...`); `deliver-notification.handler.spec.ts:175` |
| 4 | notification-delivery / Crash between enqueue and delivery still delivers | COVERED | `test/notification-delivery.e2e-spec.ts:212` (`reaches SENT after a process restart between enqueue and delivery`) |
| 5 | notification-delivery-queue / Enqueue succeeds | COVERED | `deliver-notification-on-created.handler.spec.ts`; e2e implicit via durable job lookup |
| 6 | notification-delivery-queue / Enqueue failure does not lose the notification | **COVERED (was CRITICAL/UNTESTED, now fixed)** | `bullmq-notification-delivery-queue.adapter.ts:38-54` (try/catch + `logger.error` + rethrow); `bullmq-notification-delivery-queue.adapter.spec.ts:51-63` (new test, RED->GREEN empirically verified this session) |
| 7 | notification-delivery-queue / Queued job dispatches unchanged delivery command | COVERED | `notification-delivery.processor.spec.ts` |
| 8 | notification-delivery-queue / Transient failure retried and later succeeds | COVERED | e2e #2 above; `bullmq-notification-delivery-queue.adapter.spec.ts` (backoff config passthrough) |
| 9 | notification-delivery-queue / Maximum attempts reached | COVERED | e2e #3 above; `notification-delivery.processor.spec.ts` (`isFinalAttempt=true` on last attempt) |
| 10 | notification-delivery-queue / Redis reachable | COVERED | `redis.health-indicator.spec.ts` |
| 11 | notification-delivery-queue / Redis unreachable, distinguishable | COVERED | `redis.health-indicator.spec.ts`; `health.controller.spec.ts` (separate `redis` key from `database`) |

**Scenario coverage: 11/11 (100%). No regression found on the other 10 scenarios.**

## Design Conformance (D1-D9)

Unchanged from the prior pass (no design-relevant files besides the adapter/its spec changed in remediation) — spot-re-confirmed D7 (Redis unconditional, no flag) and D8 (separate `redis` health key) still hold, plus the Observability paragraph now matches D-implied behavior for enqueue-failure logging exactly (see CRITICAL re-check above). All 9 decisions remain CONFIRMED.

## Test / Build Evidence (freshly re-run this session, not reused from the prior report)

Checked out `feat/beacon-delivery-decoupling-e2e` at HEAD `a41f128` (`git fetch origin` showed no divergence — working branch already matched `origin/feat/beacon-delivery-decoupling-e2e`).

| Command | Result |
|---|---|
| `pnpm test` | **52 test files passed, 203 tests passed**, 0 failed (+1 test vs. prior run's 202 — the new enqueue-failure-logging test) |
| `pnpm lint` | **Pass** — 0 rule violations (only pre-existing `eslint-plugin-boundaries` v6->v7 deprecation warnings, unrelated to this change) |
| `npx tsc --noEmit` | **Pass** — 0 errors |
| `pnpm test:cov` | **Pass** — Statements 93.22%, Branches 93.29%, Functions 94.07%, Lines 93.10% (repo gate 80%; consistent with prior run's 93.17/93.75/94.07/93.04, no coverage regression) |

No local Docker in this environment (confirmed unavailable, same as prior run) — `pnpm test:e2e`/`pnpm test:integration` could not run locally; CI is the e2e/integration evidence source, re-checked independently below.

### CI corroboration (independently re-run via `gh pr checks` this session)

| PR | E2E (Postgres) | Integration (Postgres) | Lint/Build/Unit | Docker smoke-build | Notes |
|---|---|---|---|---|---|
| #11 redis | pass | pass | pass | pass | CodeQL pass, Trivy skipping (expected) |
| #12 queue | pass | pass | pass | pass | |
| #13 retry | pass | pass | pass | **pass** (was pending at prior check) | |
| #14 e2e | pass | pass | pass | pass | |

All application-gating jobs are green on all 4 PRs, including PR13's Docker smoke-build that was still pending during the prior verify pass. Run URLs captured live via `gh pr checks`, e.g. PR11 e2e: `https://github.com/sisques-labs/beacon-api/actions/runs/34777602043/job/103778459672`; PR14 e2e: `https://github.com/sisques-labs/beacon-api/actions/runs/34779633414/job/103784147911`.

`.github/workflows/ci.yml` re-confirmed to declare a `redis:8-alpine` service with health checks in both the `e2e` and `integration` jobs (lines 40-45 and 99-104), so these CI runs do exercise real Redis despite the stale job label.

## WARNING / SUGGESTION Re-Check

### WARNING #1 (prior): Branch-topology gap, PR14 not descendant of PR13's fix commit `5ee5aac`

**RESOLVED, independently confirmed.** `git merge-base --is-ancestor origin/feat/beacon-delivery-decoupling-retry origin/feat/beacon-delivery-decoupling-e2e` returns true (exit 0) on the current remote refs. Also confirmed the remediation commit `2123b92` is itself an ancestor of current HEAD (`git merge-base --is-ancestor 2123b92 HEAD` returns true). The chain was rebased as claimed; no further action needed.

### WARNING #2 (prior): CI job names still say "(Postgres)" despite Redis

**STILL PRESENT, confirmed via fresh `gh pr checks` output on all 4 PRs** — job labels remain `E2E tests (Postgres)` / `Integration tests (Postgres)`. Confirmed cosmetic only: the underlying `ci.yml` job definitions do declare and health-check a `redis` service (verified above), so this is a stale label, not a missing dependency. Downgrading to SUGGESTION-level going forward since it does not affect functional correctness or test coverage; does not block PASS.

### SUGGESTION #1 (prior): `design.md` Open Questions (Redis provisioning/AOF, `removeOnFail` retention) remain open

**STILL PRESENT**, unchanged — both checkboxes in `design.md`'s "Open Questions" section remain unchecked. Acceptable for this change's scope; flag before production rollout, not a verify blocker.

### SUGGESTION #2 (prior): No jitter on exponential backoff

**STILL PRESENT**, unchanged — explicitly accepted as a v1 limitation per D3 for a single low-volume webhook destination. Not a verify blocker.

## Issues

### CRITICAL

None.

### WARNING

1. CI job names ("E2E tests (Postgres)", "Integration tests (Postgres)") still don't reflect the Redis dependency added in PR11's CI diff. Cosmetic labeling drift only — the jobs do run against real Redis. Recommend a trivial follow-up rename, not blocking.

### SUGGESTION

1. `design.md`'s two Open Questions (production Redis provisioning/AOF, `removeOnFail` retention policy) remain genuinely open — should not be forgotten before production rollout.
2. No jitter on the exponential backoff (D3) — accepted v1 limitation, revisit if delivery volume grows.

## Verdict

**PASS WITH WARNINGS** — the prior CRITICAL (untested enqueue-failure scenario) is confirmed resolved with direct source inspection, an empirically-proven RED->GREEN test, and exact-wording alignment with both the spec scenario and `design.md`'s committed behavior. 32/32 tasks, 11/11 spec scenarios now COVERED (up from 10/11), all 9 design decisions confirmed, 203/203 unit tests passing, lint clean, typecheck clean, coverage 93%+ across all four metrics (no regression), and CI green on real Postgres+Redis across all 4 PRs including the previously-pending PR13 Docker smoke-build. One non-blocking WARNING remains (cosmetic CI job naming) plus two pre-accepted SUGGESTIONs (open design questions, no backoff jitter) — none of these affect correctness or spec compliance. Recommend proceeding to `sdd-archive`.
