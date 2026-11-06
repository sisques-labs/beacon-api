import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClients1790516492000 implements MigrationInterface {
  name = 'CreateClients1790516492000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "tenantId" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "apiKeyId" char(16) NOT NULL,
        "apiKeySecretHash" char(64) NOT NULL,
        "apiKeyRotatedAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_clients_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_clients_apiKeyId"
      ON "clients" ("apiKeyId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_clients_active_tenantId"
      ON "clients" ("tenantId")
      WHERE "revokedAt" IS NULL AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_clients_active_tenantId"`);
    await queryRunner.query(`DROP INDEX "UQ_clients_apiKeyId"`);
    await queryRunner.query(`DROP TABLE "clients"`);
  }
}
