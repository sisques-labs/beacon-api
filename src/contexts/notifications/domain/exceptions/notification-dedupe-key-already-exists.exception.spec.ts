import { BaseException } from '@sisques-labs/nestjs-kit';

import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';

describe('NotificationDedupeKeyAlreadyExistsException', () => {
  it('extends BaseException', () => {
    const exception = new NotificationDedupeKeyAlreadyExistsException(
      'tenant-1',
      'dedupe-1',
    );

    expect(exception).toBeInstanceOf(BaseException);
  });

  it('builds a message including tenantId and dedupeKey', () => {
    const exception = new NotificationDedupeKeyAlreadyExistsException(
      'tenant-1',
      'dedupe-1',
    );

    expect(exception.message).toContain('tenant-1');
    expect(exception.message).toContain('dedupe-1');
  });
});
