import { BaseException } from '@sisques-labs/nestjs-kit';

import { DestinationAlreadyExistsException } from '@contexts/notifications/domain/exceptions/destination-already-exists.exception';

describe('DestinationAlreadyExistsException', () => {
  it('extends BaseException', () => {
    const exception = new DestinationAlreadyExistsException(
      'tenant-1',
      'DISCORD',
    );

    expect(exception).toBeInstanceOf(BaseException);
  });

  it('builds a message including tenantId and channel', () => {
    const exception = new DestinationAlreadyExistsException(
      'tenant-1',
      'DISCORD',
    );

    expect(exception.message).toContain('tenant-1');
    expect(exception.message).toContain('DISCORD');
  });
});
