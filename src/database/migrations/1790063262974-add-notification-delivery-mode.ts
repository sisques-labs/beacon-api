import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationDeliveryMode1790063262974 implements MigrationInterface {
  name = 'AddNotificationDeliveryMode1790063262974';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN "deliveryMode" varchar(20) NOT NULL DEFAULT 'DELIVER'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP COLUMN "deliveryMode"
    `);
  }
}
