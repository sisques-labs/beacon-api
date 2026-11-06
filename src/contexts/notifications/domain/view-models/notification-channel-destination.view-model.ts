import { BaseViewModel } from '@sisques-labs/nestjs-kit';

/**
 * Read-side projection for `notification-channel-destination` (D10). It
 * deliberately has NO envelope field — a read can never return the webhook
 * URL, plaintext or ciphertext, in any form.
 */
export class NotificationChannelDestinationViewModel extends BaseViewModel {
  public readonly tenantId: string;
  public readonly channel: string;

  constructor(props: {
    id: string;
    tenantId: string;
    channel: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    super(props.id, props.createdAt, props.updatedAt);
    this.tenantId = props.tenantId;
    this.channel = props.channel;
  }
}
