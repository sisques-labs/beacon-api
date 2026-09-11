import { registerAs } from '@nestjs/config';

import { IKafkaIngestConfig } from '@core/config/interfaces/kafka-ingest-config.interface';

/**
 * Configuration for the inbound Kafka notification-request consumer.
 *
 * Ingestion is **opt-in** via `KAFKA_INGEST_ENABLED`, independent from the
 * outbound domain-event forwarder's `KAFKA_ENABLED` (see `kafka.config.ts`).
 * Broker connection details (brokers/clientId/SSL/SASL) are reused from
 * `kafkaConfig` — this config only adds the ingestion-specific topic and
 * consumer group.
 */
export const kafkaIngestConfig = registerAs(
  'kafkaIngest',
  (): IKafkaIngestConfig => ({
    enabled: process.env.KAFKA_INGEST_ENABLED === 'true',
    topic:
      process.env.KAFKA_INGEST_TOPIC?.trim() ||
      'beacon-api.notification-requests',
    groupId:
      process.env.KAFKA_INGEST_GROUP_ID?.trim() ||
      'beacon-api-notification-ingest',
  }),
);
