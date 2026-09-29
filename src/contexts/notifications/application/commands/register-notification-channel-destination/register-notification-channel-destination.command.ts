import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { UnsupportedDestinationChannelException } from '@contexts/notifications/domain/exceptions/unsupported-destination-channel.exception';
import { DiscordWebhookUrlValueObject } from '@contexts/notifications/domain/value-objects/discord-webhook-url/discord-webhook-url.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';

export interface RegisterNotificationChannelDestinationCommandInput {
  tenantId: string;
  channel: string;
  webhookUrl: string;
}

/**
 * Validates in design.md's Data Flow order: channel must be `DISCORD` before
 * the raw `webhookUrl` is ever parsed into a `DiscordWebhookUrlValueObject`.
 * Both checks happen in the constructor, so an invalid command never reaches
 * `RegisterNotificationChannelDestinationCommandHandler.execute()` — an
 * invalid webhook URL therefore never reaches `ISecretCipherPort.encrypt()`.
 */
export class RegisterNotificationChannelDestinationCommand {
  public readonly tenantId: UuidValueObject;
  public readonly channel: NotificationChannelValueObject;
  public readonly webhookUrl: DiscordWebhookUrlValueObject;

  constructor(input: RegisterNotificationChannelDestinationCommandInput) {
    this.tenantId = new UuidValueObject(input.tenantId);
    this.channel = new NotificationChannelValueObject(
      input.channel as NotificationChannelEnum,
    );
    if (this.channel.value !== NotificationChannelEnum.DISCORD) {
      throw new UnsupportedDestinationChannelException();
    }
    this.webhookUrl = new DiscordWebhookUrlValueObject(input.webhookUrl);
  }
}
