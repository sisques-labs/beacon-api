import { Queue } from 'bullmq';

const DRAIN_JOB_TYPES = ['active', 'waiting', 'delayed'] as const;
const POLL_INTERVAL_MS = 25;

/**
 * Waits until a BullMQ queue has no active, waiting or delayed jobs left —
 * a deterministic replacement for a fixed `setTimeout` "give any accidental
 * retry a chance" sleep (design.md D9). Used by E2E specs after triggering
 * an enqueue, before asserting on the resulting notification status, so a
 * still-scheduled retry can never race the assertion.
 */
export async function waitForQueueDrained(
  queue: Queue,
  timeoutMs = 10000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const counts = await queue.getJobCounts(...DRAIN_JOB_TYPES);
    const pending = DRAIN_JOB_TYPES.reduce(
      (total, type) => total + (counts[type] ?? 0),
      0,
    );

    if (pending === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for queue "${queue.name}" to drain (active/waiting/delayed jobs remained after ${timeoutMs}ms)`,
  );
}
