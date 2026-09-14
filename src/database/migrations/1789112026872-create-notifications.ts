import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1789112026872 implements MigrationInterface {
  name = 'CreateNotifications1789112026872';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "tenantId" uuid NOT NULL,
        "recipientUserId" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL,
        "title" varchar(255) NOT NULL,
        "body" varchar(5000) NOT NULL,
        "sourceService" varchar(255) NOT NULL,
        "dedupeKey" varchar(255) NOT NULL,
        "failureReason" varchar(1000),
        "sentAt" TIMESTAMPTZ,
        "readAt" TIMESTAMPTZ,
        "cancelledAt" TIMESTAMPTZ,
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notifications_tenantId_dedupeKey"
      ON "notifications" ("tenantId", "dedupeKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_notifications_tenantId_dedupeKey"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
