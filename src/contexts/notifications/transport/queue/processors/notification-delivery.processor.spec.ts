import { CommandBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';
import { Mocked, vi } from 'vitest';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import { INotificationDeliveryJobData } from '@contexts/notifications/application/ports/notification-delivery-job-data.interface';
import { NotificationDeliveryProcessor } from '@contexts/notifications/transport/queue/processors/notification-delivery.processor';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

function buildJob(
  attemptsMade: number,
  attempts: number,
): Job<INotificationDeliveryJobData> {
  return {
    attemptsMade,
    opts: { attempts },
    data: { notificationId: NOTIFICATION_ID },
  } as unknown as Job<INotificationDeliveryJobData>;
}

describe('NotificationDeliveryProcessor', () => {
  let processor: NotificationDeliveryProcessor;
  let commandBus: Mocked<CommandBus>;

  beforeEach(() => {
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    processor = new NotificationDeliveryProcessor(commandBus);
  });

  it('dispatches with isFinalAttempt=false when more attempts remain', async () => {
    commandBus.execute.mockResolvedValue(undefined);

    await processor.process(buildJob(0, 5));

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const dispatched = commandBus.execute.mock
      .calls[0][0] as DeliverNotificationCommand;
    expect(dispatched.notificationId.value).toBe(NOTIFICATION_ID);
    expect(dispatched.isFinalAttempt.value).toBe(false);
  });

  it('dispatches with isFinalAttempt=true on the last configured attempt', async () => {
    commandBus.execute.mockResolvedValue(undefined);

    await processor.process(buildJob(4, 5));

    const dispatched = commandBus.execute.mock
      .calls[0][0] as DeliverNotificationCommand;
    expect(dispatched.isFinalAttempt.value).toBe(true);
  });

  it('rethrows the underlying error so BullMQ can schedule a retry', async () => {
    const error = new Error('Discord webhook responded with status 500');
    commandBus.execute.mockRejectedValue(error);

    await expect(processor.process(buildJob(0, 5))).rejects.toBe(error);
  });
});
