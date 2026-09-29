import { HttpStatus } from '@nestjs/common';

import { InvalidDiscordWebhookUrlException } from '@contexts/notifications/domain/exceptions/invalid-discord-webhook-url.exception';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import { UnsupportedDestinationChannelException } from '@contexts/notifications/domain/exceptions/unsupported-destination-channel.exception';
import { resolveNotificationsExceptionStatus } from '@contexts/notifications/transport/exceptions/notifications-exception.filter';

describe('resolveNotificationsExceptionStatus', () => {
  it('maps NotificationNotFoundException to 404', () => {
    const status = resolveNotificationsExceptionStatus(
      new NotificationNotFoundException('unknown-id'),
    );

    expect(status).toBe(HttpStatus.NOT_FOUND);
  });

  it('maps InvalidDiscordWebhookUrlException to 400 with its fixed message, never echoing a URL', () => {
    const exception = new InvalidDiscordWebhookUrlException();

    const status = resolveNotificationsExceptionStatus(exception);

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.message).not.toMatch(/https?:\/\//);
  });

  it('maps UnsupportedDestinationChannelException to 400', () => {
    const status = resolveNotificationsExceptionStatus(
      new UnsupportedDestinationChannelException(),
    );

    expect(status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('returns undefined for exceptions it does not recognise', () => {
    const status = resolveNotificationsExceptionStatus(
      new Error('unrelated') as unknown as NotificationNotFoundException,
    );

    expect(status).toBeUndefined();
  });
});
