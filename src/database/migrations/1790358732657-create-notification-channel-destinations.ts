import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationChannelDestinations1790358732657 implements MigrationInterface {
  name = 'CreateNotificationChannelDestinations1790358732657';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_channel_destinations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "tenantId" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "encryptedAddress" text NOT NULL,
        CONSTRAINT "PK_notification_channel_destinations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ncd_tenantId_channel"
      ON "notification_channel_destinations" ("tenantId", "channel")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_ncd_tenantId_channel"`);
    await queryRunner.query(`DROP TABLE "notification_channel_destinations"`);
  }
}
