import { BaseException } from '@sisques-labs/nestjs-kit';

import { UnsupportedCriteriaFieldException } from '@contexts/notifications/domain/exceptions/unsupported-criteria-field.exception';

describe('UnsupportedCriteriaFieldException', () => {
  it('extends BaseException', () => {
    expect(
      new UnsupportedCriteriaFieldException('filter', 'x', ['id']),
    ).toBeInstanceOf(BaseException);
  });

  it('builds a message with the usage, the field and the allowed fields', () => {
    const exception = new UnsupportedCriteriaFieldException(
      'sort',
      'encryptedAddress',
      ['id', 'tenantId'],
    );

    expect(exception.message).toBe(
      "Cannot sort by 'encryptedAddress'. Allowed fields: id, tenantId",
    );
  });
});
