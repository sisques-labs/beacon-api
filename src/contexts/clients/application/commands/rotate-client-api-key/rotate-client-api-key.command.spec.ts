import { RotateClientApiKeyCommand } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key.command';

const VALID_CLIENT_ID = '11111111-1111-4111-8111-111111111111';

describe('RotateClientApiKeyCommand', () => {
  it('wraps clientId in a value object', () => {
    const command = new RotateClientApiKeyCommand({
      clientId: VALID_CLIENT_ID,
    });

    expect(command.clientId.value).toBe(VALID_CLIENT_ID);
  });

  it('throws when clientId is not a valid UUID', () => {
    expect(
      () => new RotateClientApiKeyCommand({ clientId: 'not-a-uuid' }),
    ).toThrow();
  });
});
