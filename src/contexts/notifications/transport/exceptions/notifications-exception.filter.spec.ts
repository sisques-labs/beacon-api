import { HttpStatus } from '@nestjs/common';

import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import { resolveNotificationsExceptionStatus } from '@contexts/notifications/transport/exceptions/notifications-exception.filter';

describe('resolveNotificationsExceptionStatus', () => {
  it('maps NotificationNotFoundException to 404', () => {
    const status = resolveNotificationsExceptionStatus(
      new NotificationNotFoundException('unknown-id'),
    );

    expect(status).toBe(HttpStatus.NOT_FOUND);
  });

  it('returns undefined for exceptions it does not recognise', () => {
    const status = resolveNotificationsExceptionStatus(
      new Error('unrelated') as unknown as NotificationNotFoundException,
    );

    expect(status).toBeUndefined();
  });
});
