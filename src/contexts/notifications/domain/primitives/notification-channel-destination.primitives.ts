import { BasePrimitives } from '@sisques-labs/nestjs-kit';

/**
 * Persistence-only shape (used by the future TypeORM mapper, Phase 5). The
 * encrypted envelope is included here because it MUST reach the database
 * column — this type MUST NEVER be used to build a domain event payload. See
 * `INotificationChannelDestinationEventData` (D9) for the event shape.
 */
export type INotificationChannelDestinationPrimitives = BasePrimitives & {
  tenantId: string;
  channel: string;
  envelope: string;
};
