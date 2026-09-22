import { BadRequestException } from '@nestjs/common';
import { FilterOperator } from '@sisques-labs/nestjs-kit';
import { FilterValidationPipe } from '@sisques-labs/nestjs-kit/graphql';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { notificationFilterableFields } from '@contexts/notifications/transport/graphql/registries/notification-filterable-fields.registry';
import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

describe('notificationFilterableFields', () => {
  it('has an entry for every NotificationQueryableField value', () => {
    for (const field of Object.values(NotificationQueryableField)) {
      expect(notificationFilterableFields[field]).toBeDefined();
    }
  });

  it('registers deliveryMode as the real domain enum, including SKIPPED-adjacent RECORD_ONLY', () => {
    const descriptor =
      notificationFilterableFields[NotificationQueryableField.DELIVERY_MODE];

    expect(descriptor).toEqual({
      type: 'enum',
      enum: NotificationDeliveryModeEnum,
    });
  });

  it('registers status as the real domain enum, including SKIPPED', () => {
    const descriptor =
      notificationFilterableFields[NotificationQueryableField.STATUS];

    expect(descriptor).toEqual({
      type: 'enum',
      enum: NotificationStatusEnum,
    });
    expect(Object.values(NotificationStatusEnum)).toContain('SKIPPED');
    expect(
      descriptor.type === 'enum' && Object.values(descriptor.enum),
    ).toContain('SKIPPED');
  });

  it('registers channel as the real domain enum', () => {
    const descriptor =
      notificationFilterableFields[NotificationQueryableField.CHANNEL];

    expect(descriptor).toEqual({
      type: 'enum',
      enum: NotificationChannelEnum,
    });
  });

  it('registers tenantId and recipientUserId as uuid', () => {
    expect(
      notificationFilterableFields[NotificationQueryableField.TENANT_ID],
    ).toEqual({ type: 'uuid' });
    expect(
      notificationFilterableFields[
        NotificationQueryableField.RECIPIENT_USER_ID
      ],
    ).toEqual({ type: 'uuid' });
  });

  it('registers createdAt as date', () => {
    expect(
      notificationFilterableFields[NotificationQueryableField.CREATED_AT],
    ).toEqual({ type: 'date' });
  });

  describe('FilterValidationPipe(notificationFilterableFields) — SQL identifier injection guard', () => {
    const pipe = new FilterValidationPipe(notificationFilterableFields);

    // SECURITY: applyCriteriaToQueryBuilder interpolates filter.field DIRECTLY
    // into the SQL column string (`${alias}.${filter.field}`) — only the value
    // is parameterized. This whitelist rejection is the ONLY guard standing
    // between a caller-supplied field name and raw SQL injection into a
    // column reference. Do not weaken or skip this test.
    it('rejects an unrecognized field ("body") with BadRequestException', () => {
      expect(() =>
        pipe.transform({
          filters: [
            { field: 'body', operator: FilterOperator.EQUALS, value: 'x' },
          ],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an unrecognized field ("password") with BadRequestException', () => {
      expect(() =>
        pipe.transform({
          filters: [
            {
              field: 'password',
              operator: FilterOperator.EQUALS,
              value: 'x',
            },
          ],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an invalid enum value for a whitelisted field', () => {
      expect(() =>
        pipe.transform({
          filters: [
            {
              field: NotificationQueryableField.DELIVERY_MODE,
              operator: FilterOperator.EQUALS,
              value: 'NOPE',
            },
          ],
        }),
      ).toThrow(BadRequestException);
    });

    it('accepts a valid deliveryMode EQUALS RECORD_ONLY filter', () => {
      expect(() =>
        pipe.transform({
          filters: [
            {
              field: NotificationQueryableField.DELIVERY_MODE,
              operator: FilterOperator.EQUALS,
              value: NotificationDeliveryModeEnum.RECORD_ONLY,
            },
          ],
        }),
      ).not.toThrow();
    });

    it('accepts a valid status EQUALS SKIPPED filter', () => {
      expect(() =>
        pipe.transform({
          filters: [
            {
              field: NotificationQueryableField.STATUS,
              operator: FilterOperator.EQUALS,
              value: NotificationStatusEnum.SKIPPED,
            },
          ],
        }),
      ).not.toThrow();
    });

    it('accepts an IN filter whose every member is a valid enum value', () => {
      expect(() =>
        pipe.transform({
          filters: [
            {
              field: NotificationQueryableField.DELIVERY_MODE,
              operator: FilterOperator.IN,
              value: [
                NotificationDeliveryModeEnum.DELIVER,
                NotificationDeliveryModeEnum.RECORD_ONLY,
              ],
            },
          ],
        }),
      ).not.toThrow();
    });

    it('rejects an IN filter containing one invalid member', () => {
      expect(() =>
        pipe.transform({
          filters: [
            {
              field: NotificationQueryableField.DELIVERY_MODE,
              operator: FilterOperator.IN,
              value: [NotificationDeliveryModeEnum.DELIVER, 'NOPE'],
            },
          ],
        }),
      ).toThrow(BadRequestException);
    });

    // D-J: the kit validates the *value* against the descriptor, not which
    // operator may pair with it — ordering operators on an enum column yield
    // a lexicographic comparison (safe, just semantically odd), never a
    // validation error or an injection. All 8 FilterOperator values are
    // pinned here so that behavior is a recorded decision, not an accident.
    it.each(Object.values(FilterOperator))(
      'accepts operator %s against deliveryMode with a valid enum value (D-J)',
      (operator) => {
        const value =
          operator === FilterOperator.IN
            ? [NotificationDeliveryModeEnum.RECORD_ONLY]
            : NotificationDeliveryModeEnum.RECORD_ONLY;

        expect(() =>
          pipe.transform({
            filters: [
              {
                field: NotificationQueryableField.DELIVERY_MODE,
                operator,
                value,
              },
            ],
          }),
        ).not.toThrow();
      },
    );
  });
});
