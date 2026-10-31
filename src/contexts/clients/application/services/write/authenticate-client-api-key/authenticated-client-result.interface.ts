/**
 * The resolved identity of a successfully authenticated client (design.md
 * D17 Data Flow: `ok → { clientId, tenantId }`). Deliberately its own
 * minimal shape, not `notifications`' future `IAuthenticatedClient` (D14) —
 * a bounded context never depends on another context's application types.
 */
export interface AuthenticatedClientResult {
  clientId: string;
  tenantId: string;
}
