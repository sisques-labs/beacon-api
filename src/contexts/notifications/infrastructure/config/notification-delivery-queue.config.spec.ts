import { notificationDeliveryQueueConfig } from '@contexts/notifications/infrastructure/config/notification-delivery-queue.config';

describe('notificationDeliveryQueueConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NOTIFICATION_DELIVERY_QUEUE_NAME;
    delete process.env.NOTIFICATION_DELIVERY_QUEUE_ATTEMPTS;
    delete process.env.NOTIFICATION_DELIVERY_QUEUE_BACKOFF_MS;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults to name=notification-delivery, attempts=5, backoffMs=5000', () => {
    expect(notificationDeliveryQueueConfig()).toEqual({
      name: 'notification-delivery',
      attempts: 5,
      backoffMs: 5000,
    });
  });

  it('reads a custom name, attempts and backoff from env', () => {
    process.env.NOTIFICATION_DELIVERY_QUEUE_NAME = ' custom-queue ';
    process.env.NOTIFICATION_DELIVERY_QUEUE_ATTEMPTS = '3';
    process.env.NOTIFICATION_DELIVERY_QUEUE_BACKOFF_MS = '10';

    const config = notificationDeliveryQueueConfig();

    expect(config.name).toBe('custom-queue');
    expect(config.attempts).toBe(3);
    expect(config.backoffMs).toBe(10);
  });
});
