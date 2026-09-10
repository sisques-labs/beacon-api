import { registerAs } from '@nestjs/config';
import { IEventStoreConfig } from '@sisques-labs/nestjs-kit/event-store';

/**
 * KurrentDB (EventStoreDB) configuration for the domain-event forwarder.
 *
 * Forwarding is **opt-in** via `EVENTSTORE_ENABLED` so the app boots without an
 * instance in local/dev/test. When disabled, `EventStoreModule` registers a
 * no-op writer and never opens a connection. Independent of Kafka forwarding —
 * either, both, or neither can be enabled.
 */
export const eventStoreConfig = registerAs(
  'eventStore',
  (): IEventStoreConfig => {
    return {
      enabled: process.env.EVENTSTORE_ENABLED === 'true',
      connectionString:
        process.env.EVENTSTORE_CONNECTION_STRING?.trim() ||
        'kurrentdb://localhost:2113?tls=false',
      streamPrefix:
        process.env.EVENTSTORE_STREAM_PREFIX?.trim() || 'nestjs-template',
    };
  },
);
