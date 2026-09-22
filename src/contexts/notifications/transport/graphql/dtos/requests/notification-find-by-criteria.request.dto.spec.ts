import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilterOperator } from '@sisques-labs/nestjs-kit';

import { NotificationFindByCriteriaRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-criteria.request.dto';
import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

describe('NotificationFindByCriteriaRequestDto', () => {
  it('passes validation when instantiated from an empty/absent input', async () => {
    const dto = plainToInstance(NotificationFindByCriteriaRequestDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('leaves filters undefined when the input omits it — the [] default is a GraphQL execution-layer default (@Field defaultValue), not a class-instantiation default', () => {
    const dto = plainToInstance(NotificationFindByCriteriaRequestDto, {});

    expect(dto.filters).toBeUndefined();
  });

  it('passes validation for an explicitly empty filters array', async () => {
    const dto = plainToInstance(NotificationFindByCriteriaRequestDto, {
      filters: [],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('passes validation for a well-formed filters array', async () => {
    const dto = plainToInstance(NotificationFindByCriteriaRequestDto, {
      filters: [
        {
          field: NotificationQueryableField.DELIVERY_MODE,
          operator: FilterOperator.EQUALS,
          value: 'RECORD_ONLY',
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a filters array containing a filter with an unwhitelisted field via nested validation', async () => {
    const dto = plainToInstance(NotificationFindByCriteriaRequestDto, {
      filters: [{ field: 'body', operator: FilterOperator.EQUALS, value: 'x' }],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('filters');
  });

  it('passes validation for a well-formed sorts array', async () => {
    const dto = plainToInstance(NotificationFindByCriteriaRequestDto, {
      sorts: [
        { field: NotificationQueryableField.CREATED_AT, direction: 'ASC' },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
