import { BasePrimitives } from '@sisques-labs/nestjs-kit';

/**
 * Persistence-only shape (used by the future TypeORM mapper, Phase 11). The
 * api key secret hash is included here because it MUST reach the database
 * column — this type MUST NEVER be used to build a domain event payload. See
 * `IClientEventData` (D15, mirrors D9) for the event shape.
 */
export type IClientPrimitives = BasePrimitives & {
  tenantId: string;
  name: string;
  apiKeyId: string;
  apiKeySecretHash: string;
  apiKeyRotatedAt: Date | null;
  revokedAt: Date | null;
};
