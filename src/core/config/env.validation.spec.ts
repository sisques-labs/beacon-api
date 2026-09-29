import { validateEnv } from '@core/config/env.validation';

const VALID_SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');

function validEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string> {
  return {
    NODE_ENV: 'development',
    DATABASE_DRIVER: 'postgres',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USERNAME: 'postgres',
    DATABASE_PASSWORD: 'secret',
    DATABASE_DATABASE: 'nestjs_template_db',
    REDIS_HOST: 'localhost',
    SECRETS_ENCRYPTION_KEY: VALID_SECRETS_ENCRYPTION_KEY,
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('accepts a complete non-production environment', () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it('rejects missing DATABASE_HOST', () => {
    const env = validEnv({ DATABASE_HOST: '' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*DATABASE_HOST/,
    );
  });

  it('rejects missing DATABASE_USERNAME', () => {
    const env = validEnv({ DATABASE_USERNAME: '' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*DATABASE_USERNAME/,
    );
  });

  it('rejects missing REDIS_HOST', () => {
    const env = validEnv({ REDIS_HOST: '' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*REDIS_HOST/,
    );
  });

  it('accepts REDIS_HOST alone, with port/password/db left unset', () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it('accepts custom REDIS_PORT, REDIS_PASSWORD and REDIS_DB alongside REDIS_HOST', () => {
    const env = validEnv({
      REDIS_PORT: '6380',
      REDIS_PASSWORD: 'secret',
      REDIS_DB: '1',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects KAFKA_ENABLED=true without KAFKA_BROKERS', () => {
    const env = validEnv({ KAFKA_ENABLED: 'true' });

    expect(() => validateEnv(env)).toThrow(
      /KAFKA_BROKERS is required when KAFKA_ENABLED is "true"/,
    );
  });

  it('accepts KAFKA_ENABLED=true with KAFKA_BROKERS set', () => {
    const env = validEnv({
      KAFKA_ENABLED: 'true',
      KAFKA_BROKERS: 'localhost:9092',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects KAFKA_INGEST_ENABLED=true without KAFKA_BROKERS', () => {
    const env = validEnv({ KAFKA_INGEST_ENABLED: 'true' });

    expect(() => validateEnv(env)).toThrow(
      /KAFKA_BROKERS is required when KAFKA_INGEST_ENABLED is "true"/,
    );
  });

  it('accepts KAFKA_INGEST_ENABLED=true with KAFKA_BROKERS set', () => {
    const env = validEnv({
      KAFKA_INGEST_ENABLED: 'true',
      KAFKA_BROKERS: 'localhost:9092',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects AUTH_ENABLED=true without AUTH_JWT_SECRET', () => {
    const env = validEnv({ AUTH_ENABLED: 'true' });

    expect(() => validateEnv(env)).toThrow(
      /AUTH_JWT_SECRET is required when AUTH_ENABLED is "true"/,
    );
  });

  it('accepts AUTH_ENABLED=true with AUTH_JWT_SECRET set', () => {
    const env = validEnv({
      AUTH_ENABLED: 'true',
      AUTH_JWT_SECRET: 'super-secret',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects missing CORS origins in production', () => {
    const env = validEnv({ NODE_ENV: 'production' });

    expect(() => validateEnv(env)).toThrow(
      /CORS_ORIGINS or FRONTEND_URL: at least one origin must be configured in production/,
    );
  });

  it('accepts FRONTEND_URL as CORS origin in production', () => {
    const env = validEnv({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('accepts CORS_ORIGINS as CORS origin in production', () => {
    const env = validEnv({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.example.com',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('accepts a valid DISCORD_WEBHOOK_URL', () => {
    const env = validEnv({
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects a non-URL DISCORD_WEBHOOK_URL', () => {
    const env = validEnv({ DISCORD_WEBHOOK_URL: 'not-a-url' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*DISCORD_WEBHOOK_URL/,
    );
  });

  it('formats a root-level issue without a field path', () => {
    expect(() =>
      validateEnv(null as unknown as Record<string, unknown>),
    ).toThrow(/\(root\)/);
  });

  it('rejects a missing SECRETS_ENCRYPTION_KEY', () => {
    const env = validEnv({ SECRETS_ENCRYPTION_KEY: '' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*SECRETS_ENCRYPTION_KEY/,
    );
  });

  it('rejects a SECRETS_ENCRYPTION_KEY that does not decode to 32 bytes', () => {
    const env = validEnv({
      SECRETS_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'),
    });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*SECRETS_ENCRYPTION_KEY/,
    );
  });

  it('accepts a SECRETS_ENCRYPTION_KEY that decodes to exactly 32 bytes', () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it('accepts an unset SECRETS_ENCRYPTION_KEY_VERSION', () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it('accepts a SECRETS_ENCRYPTION_KEY_VERSION within 1-255', () => {
    const env = validEnv({ SECRETS_ENCRYPTION_KEY_VERSION: '255' });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects a SECRETS_ENCRYPTION_KEY_VERSION below 1', () => {
    const env = validEnv({ SECRETS_ENCRYPTION_KEY_VERSION: '0' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*SECRETS_ENCRYPTION_KEY_VERSION/,
    );
  });

  it('rejects a SECRETS_ENCRYPTION_KEY_VERSION above 255', () => {
    const env = validEnv({ SECRETS_ENCRYPTION_KEY_VERSION: '256' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*SECRETS_ENCRYPTION_KEY_VERSION/,
    );
  });

  it('accepts a valid OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    const env = validEnv({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects a non-URL OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    const env = validEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-url' });

    expect(() => validateEnv(env)).toThrow(
      /Environment validation failed:[\s\S]*OTEL_EXPORTER_OTLP_ENDPOINT/,
    );
  });
});
