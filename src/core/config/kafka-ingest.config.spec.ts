import { kafkaIngestConfig } from '@core/config/kafka-ingest.config';

describe('kafkaIngestConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.KAFKA_INGEST_ENABLED;
    delete process.env.KAFKA_INGEST_TOPIC;
    delete process.env.KAFKA_INGEST_GROUP_ID;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults to disabled with sensible topic and group id', () => {
    const config = kafkaIngestConfig();

    expect(config).toEqual({
      enabled: false,
      topic: 'beacon-api.notification-requests',
      groupId: 'beacon-api-notification-ingest',
    });
  });

  it('enables only when KAFKA_INGEST_ENABLED is exactly "true"', () => {
    process.env.KAFKA_INGEST_ENABLED = 'true';
    expect(kafkaIngestConfig().enabled).toBe(true);

    process.env.KAFKA_INGEST_ENABLED = 'TRUE';
    expect(kafkaIngestConfig().enabled).toBe(false);
  });

  it('trims and uses a custom topic and group id when provided', () => {
    process.env.KAFKA_INGEST_TOPIC = ' custom.topic ';
    process.env.KAFKA_INGEST_GROUP_ID = ' custom-group ';

    const config = kafkaIngestConfig();

    expect(config.topic).toBe('custom.topic');
    expect(config.groupId).toBe('custom-group');
  });
});
