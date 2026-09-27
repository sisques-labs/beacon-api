import { IBaseEventData } from '@sisques-labs/nestjs-kit';

/**
 * Domain event payload for `client` events (D15, mirrors D9). Carries
 * metadata only — the api key secret hash MUST NEVER be added here, because
 * `AGGREGATE_MODULE_MAP` forwards these events to Kafka and EventStore.
 */
export interface IClientEventData extends IBaseEventData {
  id: string;
  tenantId: string;
  name: string;
  apiKeyId: string;
}
