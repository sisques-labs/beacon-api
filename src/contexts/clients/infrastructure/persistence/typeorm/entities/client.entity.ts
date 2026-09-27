import { Column, Entity, Unique } from 'typeorm';
import { BaseTypeormEntity } from '@sisques-labs/nestjs-kit/typeorm';

/**
 * The full unique index on `apiKeyId` is expressed here. The partial
 * `(tenantId) WHERE "revokedAt" IS NULL AND "deletedAt" IS NULL` index
 * (D19) cannot be expressed via `@Unique()` and is created directly by
 * the migration in Phase 12.
 */
@Entity('clients')
@Unique(['apiKeyId'])
export class ClientEntity extends BaseTypeormEntity {
  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'char', length: 16 })
  apiKeyId!: string;

  @Column({ type: 'char', length: 64 })
  apiKeySecretHash!: string;

  @Column({ type: 'timestamptz', nullable: true })
  apiKeyRotatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
