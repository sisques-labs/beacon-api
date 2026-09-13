import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Mocked, vi } from 'vitest';

import { BullMqNotificationDeliveryQueueAdapter } from '@contexts/notifications/infrastructure/adapters/bullmq-notification-delivery-queue.adapter';
import { INotificationDeliveryQueueConfig } from '@contexts/notifications/infrastructure/config/interfaces/notification-delivery-queue-config.interface';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

describe('BullMqNotificationDeliveryQueueAdapter', () => {
  let adapter: BullMqNotificationDeliveryQueueAdapter;
  let queue: Mocked<Queue>;
  let configService: Mocked<ConfigService>;

  beforeEach(() => {
    queue = { add: vi.fn() } as unknown as Mocked<Queue>;
    configService = {
      getOrThrow: vi.fn().mockReturnValue({
        name: 'notification-delivery',
        attempts: 5,
        backoffMs: 5000,
      } satisfies INotificationDeliveryQueueConfig),
    } as unknown as Mocked<ConfigService>;
    adapter = new BullMqNotificationDeliveryQueueAdapter(queue, configService);
  });

  it('adds a job named after the notification id with jobId set for idempotent enqueue', async () => {
    await adapter.enqueue(NOTIFICATION_ID);

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queue.add.mock.calls[0];
    expect(name).toBe('deliver-notification');
    expect(data).toEqual({ notificationId: NOTIFICATION_ID });
    expect(opts?.jobId).toBe(NOTIFICATION_ID);
  });

  it('passes attempts and exponential backoff derived from config', async () => {
    configService.getOrThrow.mockReturnValue({
      name: 'notification-delivery',
      attempts: 3,
      backoffMs: 10,
    } satisfies INotificationDeliveryQueueConfig);

    await adapter.enqueue(NOTIFICATION_ID);

    const opts = queue.add.mock.calls[0][2];
    expect(opts?.attempts).toBe(3);
    expect(opts?.backoff).toEqual({ type: 'exponential', delay: 10 });
  });
});
