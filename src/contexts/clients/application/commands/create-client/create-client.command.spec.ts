import { CreateClientCommand } from '@contexts/clients/application/commands/create-client/create-client.command';

const VALID_INPUT = {
  name: 'Acme Corp',
  tenantId: '11111111-1111-4111-8111-111111111111',
};

describe('CreateClientCommand', () => {
  it('wraps name and tenantId in value objects', () => {
    const command = new CreateClientCommand(VALID_INPUT);

    expect(command.name.value).toBe(VALID_INPUT.name);
    expect(command.tenantId.value).toBe(VALID_INPUT.tenantId);
  });

  it('generates a new tenantId when none is provided (D20 --tenant-id is optional)', () => {
    const command = new CreateClientCommand({ name: VALID_INPUT.name });

    expect(command.tenantId.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('generates a different tenantId on every call when omitted', () => {
    const first = new CreateClientCommand({ name: VALID_INPUT.name });
    const second = new CreateClientCommand({ name: VALID_INPUT.name });

    expect(first.tenantId.value).not.toBe(second.tenantId.value);
  });

  it('throws when name is empty', () => {
    expect(
      () => new CreateClientCommand({ ...VALID_INPUT, name: '' }),
    ).toThrow();
  });

  it('throws when name exceeds the max length', () => {
    expect(
      () => new CreateClientCommand({ ...VALID_INPUT, name: 'a'.repeat(101) }),
    ).toThrow();
  });

  it('throws when a provided tenantId is not a valid UUID', () => {
    expect(
      () => new CreateClientCommand({ ...VALID_INPUT, tenantId: 'not-a-uuid' }),
    ).toThrow();
  });
});
