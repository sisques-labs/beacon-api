import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilterOperator } from '@sisques-labs/nestjs-kit';

import { NotificationFilterInput } from '@contexts/notifications/transport/graphql/dtos/requests/notification-filter.input';
import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

describe('NotificationFilterInput', () => {
  it('is named NotificationFilterInput', () => {
    expect(NotificationFilterInput.name).toBe('NotificationFilterInput');
  });

  it('passes validation for a well-formed filter against a whitelisted field', async () => {
    const dto = plainToInstance(NotificationFilterInput, {
      field: NotificationQueryableField.DELIVERY_MODE,
      operator: FilterOperator.EQUALS,
      value: 'RECORD_ONLY',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a field value that is not a member of NotificationQueryableField', async () => {
    const dto = plainToInstance(NotificationFilterInput, {
      field: 'body',
      operator: FilterOperator.EQUALS,
      value: 'x',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('field');
  });

  it('rejects an empty field', async () => {
    const dto = plainToInstance(NotificationFilterInput, {
      field: '',
      operator: FilterOperator.EQUALS,
      value: 'x',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('field');
  });
});
