import { z } from 'zod';

import { validateProductionCorsOrigins } from '@core/config/cors-origins';

function formatZodIssues(issues: z.ZodIssue[]): string {
  return issues
    .map(
      (issue) =>
        `  - ${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
    )
    .join('\n');
}

const baseEnvSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    DATABASE_DRIVER: z.string().optional(),
    DATABASE_HOST: z.string().trim().min(1, 'DATABASE_HOST must not be empty'),
    DATABASE_PORT: z.string().optional(),
    DATABASE_USERNAME: z
      .string()
      .trim()
      .min(1, 'DATABASE_USERNAME must not be empty'),
    DATABASE_PASSWORD: z.string().min(1, 'DATABASE_PASSWORD must not be empty'),
    DATABASE_DATABASE: z
      .string()
      .trim()
      .min(1, 'DATABASE_DATABASE must not be empty'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().trim().url().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),
    OTEL_TRACES_SAMPLE_RATIO: z.coerce.number().min(0).max(1).optional(),
    OTEL_METRIC_EXPORT_INTERVAL_MILLIS: z.coerce.number().positive().optional(),
    KAFKA_ENABLED: z.enum(['true', 'false']).optional(),
    KAFKA_BROKERS: z.string().optional(),
    KAFKA_CLIENT_ID: z.string().optional(),
    KAFKA_TOPIC_PREFIX: z.string().optional(),
    KAFKA_SSL: z.enum(['true', 'false']).optional(),
    KAFKA_SASL_MECHANISM: z
      .enum(['plain', 'scram-sha-256', 'scram-sha-512'])
      .optional(),
    KAFKA_SASL_USERNAME: z.string().optional(),
    KAFKA_SASL_PASSWORD: z.string().optional(),
    EVENTSTORE_ENABLED: z.enum(['true', 'false']).optional(),
    EVENTSTORE_CONNECTION_STRING: z.string().optional(),
    EVENTSTORE_STREAM_PREFIX: z.string().optional(),
    AUTH_ENABLED: z.enum(['true', 'false']).optional(),
    AUTH_JWT_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.KAFKA_ENABLED === 'true' && !env.KAFKA_BROKERS?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['KAFKA_BROKERS'],
        message: 'KAFKA_BROKERS is required when KAFKA_ENABLED is "true"',
      });
    }

    if (env.AUTH_ENABLED === 'true' && !env.AUTH_JWT_SECRET?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_JWT_SECRET'],
        message: 'AUTH_JWT_SECRET is required when AUTH_ENABLED is "true"',
      });
    }
  });

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = baseEnvSchema.safeParse(config);

  if (!parsed.success) {
    throw new Error(
      `Environment validation failed:\n${formatZodIssues(parsed.error.issues)}`,
    );
  }

  if (parsed.data.NODE_ENV === 'production') {
    const productionErrors = validateProductionCorsOrigins({
      CORS_ORIGINS:
        typeof config.CORS_ORIGINS === 'string'
          ? config.CORS_ORIGINS
          : undefined,
      FRONTEND_URL:
        typeof config.FRONTEND_URL === 'string'
          ? config.FRONTEND_URL
          : undefined,
    });

    if (productionErrors.length > 0) {
      throw new Error(
        `Environment validation failed:\n${productionErrors.join('\n')}`,
      );
    }
  }

  return config;
}
