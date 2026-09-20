export type AuthPrincipal =
  | { userId: string; credentialType: 'jwt'; sessionId: string }
  | { userId: string; credentialType: 'api-key'; apiKeyId: string };
