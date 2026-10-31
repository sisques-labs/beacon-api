/**
 * Decrypted, re-validated delivery destination for a single notification
 * send (design.md D3/D5). `url` is the plaintext webhook URL — it MUST
 * NEVER be logged. `logLabel` is the safe-to-log form
 * (`DiscordWebhookUrlValueObject.redacted()`).
 */
export interface INotificationDeliveryDestination {
  url: string;
  logLabel: string;
}
