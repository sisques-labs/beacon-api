import {
  buildIngestAuthenticationRejectedWarning,
  parseApiKeyIdForLogging,
} from '@contexts/notifications/infrastructure/logging/kafka-ingest-authentication-warning';

const VALID_FORMAT_KEY = `bcn_${'a'.repeat(16)}_${'b'.repeat(43)}`;

describe('parseApiKeyIdForLogging', () => {
  it('returns undefined when no credential is presented', () => {
    expect(parseApiKeyIdForLogging(undefined)).toBeUndefined();
  });

  it('returns undefined when the credential does not match the bcn_ format', () => {
    expect(parseApiKeyIdForLogging('not-a-key')).toBeUndefined();
  });

  it('extracts the keyId when the credential matches the bcn_ format', () => {
    expect(parseApiKeyIdForLogging(VALID_FORMAT_KEY)).toBe('a'.repeat(16));
  });

  it('returns undefined for a credential with the right prefix but a malformed keyId', () => {
    expect(
      parseApiKeyIdForLogging(`bcn_short_${'b'.repeat(43)}`),
    ).toBeUndefined();
  });
});

describe('buildIngestAuthenticationRejectedWarning', () => {
  it('reports a missing-header reason when no credential is presented', () => {
    const message = buildIngestAuthenticationRejectedWarning({
      credential: undefined,
      topic: 'beacon-api.notification-requests',
      partition: 0,
    });

    expect(message).toContain('missing');
    expect(message).toContain('beacon-api.notification-requests');
    expect(message).toContain('partition=0');
  });

  it('reports an invalid-or-revoked reason when a credential was presented but rejected', () => {
    const message = buildIngestAuthenticationRejectedWarning({
      credential: VALID_FORMAT_KEY,
      topic: 'beacon-api.notification-requests',
      partition: 2,
    });

    expect(message).toContain('invalid or revoked');
    expect(message).toContain('partition=2');
  });

  it('includes the keyId when the credential parses', () => {
    const message = buildIngestAuthenticationRejectedWarning({
      credential: VALID_FORMAT_KEY,
      topic: 'beacon-api.notification-requests',
      partition: 0,
    });

    expect(message).toContain(`keyId=${'a'.repeat(16)}`);
  });

  it('never includes the raw credential itself', () => {
    const message = buildIngestAuthenticationRejectedWarning({
      credential: VALID_FORMAT_KEY,
      topic: 'beacon-api.notification-requests',
      partition: 0,
    });

    expect(message).not.toContain(VALID_FORMAT_KEY);
  });

  it('omits the keyId segment when the credential does not parse', () => {
    const message = buildIngestAuthenticationRejectedWarning({
      credential: 'garbage',
      topic: 'beacon-api.notification-requests',
      partition: 0,
    });

    expect(message).not.toContain('keyId=');
  });
});
