import { IGeneratedApiKey } from '@contexts/clients/application/ports/generated-api-key.interface';

export const API_KEY_GENERATOR_PORT = Symbol('API_KEY_GENERATOR_PORT');

/**
 * Generates a new API key (design.md D16). Implemented by an adapter in
 * infrastructure/adapters/ over a CSPRNG. Every call MUST return a `keyId`
 * and `secret` that never collide with a previously generated pair.
 */
export interface IApiKeyGeneratorPort {
  generate(): IGeneratedApiKey;
}
