import { Inject, Injectable } from '@nestjs/common';
import {
  Criteria,
  FilterOperator,
  IBaseService,
} from '@sisques-labs/nestjs-kit';

import { INotificationDeliveryDestination } from '@contexts/notifications/application/ports/notification-delivery-destination.interface';
import {
  ISecretCipherPort,
  SECRET_CIPHER_PORT,
} from '@contexts/notifications/application/ports/secret-cipher.port';
import { EncryptChannelDestinationSecretService } from '@contexts/notifications/application/services/write/encrypt-channel-destination-secret/encrypt-channel-destination-secret.service';
import {
  INotificationChannelDestinationWriteRepository,
  NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';
import { DiscordWebhookUrlValueObject } from '@contexts/notifications/domain/value-objects/discord-webhook-url/discord-webhook-url.value-object';

export interface ResolveNotificationDeliveryDestinationInput {
  tenantId: string;
  channel: string;
}

/**
 * Resolves the decrypted, re-validated delivery destination for a
 * `(tenantId, channel)` pair (design.md Data Flow, "Deliver"). Not yet
 * called by `DeliverNotificationCommandHandler` — that wiring is Phase 10
 * (PR10, task 10.3).
 *
 * - No destination registered for the pair → `undefined`. The future
 *   Phase 10 caller maps this to `DESTINATION_NOT_CONFIGURED`.
 * - A decrypt/AAD/tamper failure (D3/D5), or a decrypted value that no
 *   longer passes `DiscordWebhookUrlValueObject` validation → throws,
 *   unwrapped. `NotificationDestinationUnreadableException` (design.md
 *   D2/D3) does not exist yet — it is Phase 10 scope (task 10.1) — so this
 *   service deliberately lets the raw `ISecretCipherPort.decrypt` or VO
 *   error propagate for the future handler to catch and translate.
 * - Otherwise → `{ url, logLabel }`, where `url` is the plaintext webhook
 *   URL and `logLabel` is `DiscordWebhookUrlValueObject.redacted()`. `url`
 *   MUST NEVER be logged; this service never logs anything.
 */
@Injectable()
export class ResolveNotificationDeliveryDestinationService implements IBaseService<
  ResolveNotificationDeliveryDestinationInput,
  INotificationDeliveryDestination | undefined
> {
  constructor(
    @Inject(NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationChannelDestinationWriteRepository,
    @Inject(SECRET_CIPHER_PORT)
    private readonly secretCipherPort: ISecretCipherPort,
    private readonly encryptChannelDestinationSecretService: EncryptChannelDestinationSecretService,
  ) {}

  async execute(
    input: ResolveNotificationDeliveryDestinationInput,
  ): Promise<INotificationDeliveryDestination | undefined> {
    // (tenantId, channel) is unique, so the default first page is enough.
    const result = await this.writeRepository.findByCriteria(
      new Criteria([
        {
          field: 'tenantId',
          operator: FilterOperator.EQUALS,
          value: input.tenantId,
        },
        {
          field: 'channel',
          operator: FilterOperator.EQUALS,
          value: input.channel,
        },
      ]),
    );
    const existing = result.items[0] ?? null;
    if (!existing) {
      return undefined;
    }

    const aad =
      this.encryptChannelDestinationSecretService.buildEncryptionContext(
        input.tenantId,
        input.channel,
      );
    const plaintext = await this.secretCipherPort.decrypt(
      existing.envelope.value,
      aad,
    );
    const webhookUrl = new DiscordWebhookUrlValueObject(plaintext);

    return { url: webhookUrl.value, logLabel: webhookUrl.redacted() };
  }
}
