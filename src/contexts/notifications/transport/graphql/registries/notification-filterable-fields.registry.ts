import { FilterFieldRegistry } from '@sisques-labs/nestjs-kit';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

// SECURITY (threat matrix — SQL identifier injection via filter.field):
// applyCriteriaToQueryBuilder (kit) interpolates `filter.field` DIRECTLY into
// the generated SQL column string — only the filter *value* is parameterized,
// never the field name. This registry, combined with `@IsEnum` on the
// generated NotificationFilterInput.field and `FilterValidationPipe` wired at
// the resolver, is the ONLY guard between a caller-supplied field name and
// raw SQL injected into a column reference. Do not add a field here unless
// it maps to a real NotificationEntity column, and never remove the
// FilterValidationPipe wiring downstream (Phase 5).
//
// Excluded on purpose (D-K): `title`/`body` (unindexed varchar(5000) ILIKE —
// DoS + PII surface), `dedupeKey`, `failureReason`, `sentAt`, `readAt`,
// `cancelledAt`, `updatedAt`, `id` (use notificationFindById).
export const notificationFilterableFields: FilterFieldRegistry<NotificationQueryableField> =
  {
    [NotificationQueryableField.TENANT_ID]: { type: 'uuid' },
    [NotificationQueryableField.RECIPIENT_USER_ID]: { type: 'uuid' },
    [NotificationQueryableField.CHANNEL]: {
      type: 'enum',
      enum: NotificationChannelEnum,
    },
    [NotificationQueryableField.STATUS]: {
      type: 'enum',
      enum: NotificationStatusEnum,
    },
    [NotificationQueryableField.DELIVERY_MODE]: {
      type: 'enum',
      enum: NotificationDeliveryModeEnum,
    },
    [NotificationQueryableField.CREATED_AT]: { type: 'date' },
  };
