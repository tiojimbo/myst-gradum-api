export type AuthPrincipal =
  | { organizationId: string; userId: string; credentialType: 'jwt'; sessionId: string }
  | { organizationId: string; userId: string; credentialType: 'api-key'; apiKeyId: string };
