import { eventStoreConfig } from '@core/config/event-store.config';

describe('eventStoreConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.EVENTSTORE_ENABLED;
    delete process.env.EVENTSTORE_CONNECTION_STRING;
    delete process.env.EVENTSTORE_STREAM_PREFIX;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults to disabled with sensible defaults', () => {
    const config = eventStoreConfig();

    expect(config).toEqual({
      enabled: false,
      connectionString: 'kurrentdb://localhost:2113?tls=false',
      streamPrefix: 'nestjs-template',
    });
  });

  it('enables only when EVENTSTORE_ENABLED is exactly "true"', () => {
    process.env.EVENTSTORE_ENABLED = 'true';
    expect(eventStoreConfig().enabled).toBe(true);

    process.env.EVENTSTORE_ENABLED = 'TRUE';
    expect(eventStoreConfig().enabled).toBe(false);
  });

  it('trims a custom connection string and stream prefix', () => {
    process.env.EVENTSTORE_CONNECTION_STRING = ' kurrentdb://esdb:2113 ';
    process.env.EVENTSTORE_STREAM_PREFIX = ' my-service ';

    const config = eventStoreConfig();

    expect(config.connectionString).toBe('kurrentdb://esdb:2113');
    expect(config.streamPrefix).toBe('my-service');
  });
});
