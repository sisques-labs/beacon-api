import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SortDirection } from '@sisques-labs/nestjs-kit';

import { NotificationSortInput } from '@contexts/notifications/transport/graphql/dtos/requests/notification-sort.input';
import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

describe('NotificationSortInput', () => {
  it('is named NotificationSortInput', () => {
    expect(NotificationSortInput.name).toBe('NotificationSortInput');
  });

  it('passes validation for a well-formed sort against a whitelisted field', async () => {
    const dto = plainToInstance(NotificationSortInput, {
      field: NotificationQueryableField.CREATED_AT,
      direction: SortDirection.ASC,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a field value that is not a member of NotificationQueryableField', async () => {
    const dto = plainToInstance(NotificationSortInput, {
      field: 'body',
      direction: SortDirection.ASC,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('field');
  });

  it('rejects an empty field', async () => {
    const dto = plainToInstance(NotificationSortInput, {
      field: '',
      direction: SortDirection.ASC,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('field');
  });
});
