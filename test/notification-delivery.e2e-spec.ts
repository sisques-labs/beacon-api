import { randomUUID } from 'crypto';

import { getQueueToken } from '@nestjs/bullmq';
import { HttpService } from '@nestjs/axios';
import { IInboundMessage } from '@sisques-labs/nestjs-kit/messaging';
import { AxiosError, AxiosHeaders } from 'axios';
import { Job, Queue } from 'bullmq';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { notificationDeliveryQueueConfig } from '../src/contexts/notifications/infrastructure/config/notification-delivery-queue.config';
import { NotificationAggregate } from '../src/contexts/notifications/domain/aggregates/notification.aggregate';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '../src/contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationIngestConsumer } from '../src/contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { truncateAll } from './helpers/db-reset';
import { waitForQueueDrained } from './helpers/queue-drain';

const QUEUE_NAME = notificationDeliveryQueueConfig().name;

function buildPayload(value: Record<string, unknown>): IInboundMessage {
  return {
    topic: 'beacon-api.notification-requests',
    partition: 0,
    key: null,
    headers: {},
    value: JSON.stringify(value),
  };
}

function buildAxiosError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: String(status),
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: null,
    },
  );
}

function buildSuccessResponse() {
  return of({
    data: null,
    status: 204,
    statusText: 'No Content',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function buildValidEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: randomUUID(),
    recipientUserId: randomUUID(),
    channel: 'DISCORD',
    title: 'Plant watered',
    body: 'Your plant was watered successfully.',
    sourceService: 'gardenia-api',
    dedupeKey: `gardenia:plant:${randomUUID()}:watered`,
    ...overrides,
  };
}

/**
 * Delivery is dispatched asynchronously off `NotificationCreatedEvent` (see
 * design.md D2) through a durable queue — ingestion never awaits it. Poll
 * for the terminal status instead of asserting immediately after
 * `handleMessage` resolves. The default timeout absorbs Redis round-trips
 * on top of the CI/e2e test-profile backoff (design.md D9).
 */
async function waitForTerminalStatus(
  writeRepository: INotificationWriteRepository,
  tenantId: string,
  dedupeKey: string,
  timeoutMs = 10000,
): Promise<NotificationAggregate> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const notification = await writeRepository.findByDedupeKey(
      tenantId,
      dedupeKey,
    );
    if (notification && notification.status.value !== 'PENDING') {
      return notification;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `Timed out waiting for notification (${tenantId}, ${dedupeKey}) to leave PENDING`,
  );
}

/**
 * Polls for a durably-enqueued job by id (jobId = notificationId, design.md
 * D2) instead of racing the event handler's un-awaited `enqueue()` call —
 * `DeliverNotificationOnCreatedHandler` is fire-and-forget from the CQRS
 * event bus, so the job may not exist yet the instant `handleMessage()`
 * resolves.
 */
async function waitForJob(
  queue: Queue,
  jobId: string,
  timeoutMs = 5000,
): Promise<Job> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await queue.getJob(jobId);
    if (job) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for job "${jobId}" to be enqueued`);
}

describe('Notification Discord delivery (e2e)', () => {
  let ctx: E2EContext;
  let writeRepository: INotificationWriteRepository;
  let consumer: NotificationIngestConsumer;
  let httpService: HttpService;
  let queue: Queue;
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ctx = await createE2EApp();
    writeRepository = ctx.app.get(NOTIFICATION_WRITE_REPOSITORY);
    consumer = ctx.app.get(NotificationIngestConsumer);
    httpService = ctx.app.get(HttpService);
    queue = ctx.app.get<Queue>(getQueueToken(QUEUE_NAME));
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
    // Deterministic isolation between test cases (design.md D9) — a job
    // left over from a previous case (or its retries) must never bleed
    // into the next one's call-count assertions.
    await queue.obliterate({ force: true });
    postSpy = vi.spyOn(httpService, 'post');
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  it('delivers to Discord and transitions to SENT on a 2xx webhook response', async () => {
    postSpy.mockReturnValue(buildSuccessResponse());
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));
    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(delivered.status.value).toBe('SENT');
    expect(delivered.sentAt).not.toBeNull();
    expect(delivered.failureReason).toBeNull();
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('RECORD_ONLY never calls the Discord webhook and reaches terminal SKIPPED with no job enqueued', async () => {
    postSpy.mockReturnValue(buildSuccessResponse());
    const event = buildValidEvent({ deliveryMode: 'RECORD_ONLY' });

    await consumer.handleMessage(buildPayload(event));
    const skipped = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(skipped.status.value).toBe('SKIPPED');
    expect(skipped.deliveryMode.value).toBe('RECORD_ONLY');
    expect(postSpy).not.toHaveBeenCalled();
    const job = await queue.getJob(skipped.id.value);
    expect(job).toBeUndefined();
  });

  it('retries a transient failure and still reaches SENT on a later attempt', async () => {
    postSpy
      .mockReturnValueOnce(throwError(() => buildAxiosError(500)))
      .mockReturnValue(buildSuccessResponse());
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));
    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(delivered.status.value).toBe('SENT');
    expect(postSpy.mock.calls.length).toBeGreaterThan(1);
  });

  it('retries until exhaustion then transitions to FAILED with a failureReason', async () => {
    postSpy.mockReturnValue(throwError(() => buildAxiosError(500)));
    const event = buildValidEvent();
    const { attempts } = notificationDeliveryQueueConfig();

    await consumer.handleMessage(buildPayload(event));
    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );
    await waitForQueueDrained(queue);

    expect(delivered.status.value).toBe('FAILED');
    expect(delivered.failureReason?.value).toContain('500');
    expect(delivered.sentAt).toBeNull();
    expect(postSpy).toHaveBeenCalledTimes(attempts);
  });

  it('reaches SENT after a process restart between enqueue and delivery', async () => {
    // Pausing the (Redis-backed) queue before enqueuing means no worker in
    // any process — this one or a later one — picks up the job while
    // paused, so the enqueued-but-unprocessed state is fully deterministic
    // instead of racing a live worker.
    await queue.pause();
    postSpy.mockReturnValue(buildSuccessResponse());
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));
    const enqueued = await writeRepository.findByDedupeKey(
      event.tenantId,
      event.dedupeKey,
    );
    expect(enqueued?.status.value).toBe('PENDING');
    expect(postSpy).not.toHaveBeenCalled();

    // The event handler enqueues asynchronously (design.md D2) — wait for
    // the durably-persisted job itself, not just the notification row,
    // before simulating a crash. jobId = notificationId (design.md D2).
    const job = await waitForJob(queue, enqueued!.id.value);
    expect(job).toBeDefined();

    // Simulate a crash: close this process without ever having delivered.
    await ctx.close();

    // Restart: a fresh process boots against the same durable Redis queue
    // and must still deliver the notification (design.md, "Crash between
    // enqueue and delivery still delivers").
    ctx = await createE2EApp();
    writeRepository = ctx.app.get(NOTIFICATION_WRITE_REPOSITORY);
    consumer = ctx.app.get(NotificationIngestConsumer);
    httpService = ctx.app.get(HttpService);
    queue = ctx.app.get<Queue>(getQueueToken(QUEUE_NAME));
    postSpy = vi
      .spyOn(httpService, 'post')
      .mockReturnValue(buildSuccessResponse());
    await queue.resume();

    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(delivered.status.value).toBe('SENT');
  });
});
