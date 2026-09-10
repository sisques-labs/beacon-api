import { FilterOperator, SortDirection } from '@sisques-labs/nestjs-kit';
import { vi } from 'vitest';

const registerEnumType = vi.fn();

vi.mock('@nestjs/graphql', () => ({
  registerEnumType: (...args: unknown[]) => registerEnumType(...args),
}));

describe('registered-enums.graphql', () => {
  it('registers the shared FilterOperator and SortDirection enums', async () => {
    await import('./registered-enums.graphql');

    expect(registerEnumType).toHaveBeenCalledWith(
      FilterOperator,
      expect.objectContaining({ name: 'FilterOperator' }),
    );
    expect(registerEnumType).toHaveBeenCalledWith(
      SortDirection,
      expect.objectContaining({ name: 'SortDirection' }),
    );
  });
});
