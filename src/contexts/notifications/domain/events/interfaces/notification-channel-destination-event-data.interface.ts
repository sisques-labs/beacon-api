import { IBaseEventData } from '@sisques-labs/nestjs-kit';

/**
 * Domain event payload for `notification-channel-destination` events (D9).
 * Carries metadata only — the encrypted envelope MUST NEVER be added here,
 * because `AGGREGATE_MODULE_MAP` forwards these events to Kafka and
 * EventStore.
 */
export interface INotificationChannelDestinationEventData extends IBaseEventData {
  id: string;
  tenantId: string;
  channel: string;
}
