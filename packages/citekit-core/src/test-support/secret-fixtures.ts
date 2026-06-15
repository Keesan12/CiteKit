export function joinSecretParts(...parts: string[]): string {
  return parts.join("");
}

export const testSecrets = {
  githubToken: joinSecretParts("g", "h", "p", "_", "fixture"),
  githubSecretToken: joinSecretParts("g", "h", "p", "_", "super", "Secret", "Token"),
  stripeLiveSecretKey: joinSecretParts("r", "k", "_", "live", "_", "fixture"),
  stripeTestSecretKey: joinSecretParts("r", "k", "_", "test", "_", "fixture"),
  openAiKey: joinSecretParts("s", "k", "-", "local"),
  openAiSecretKey: joinSecretParts("s", "k", "-", "fixture", "-", "secret"),
  anthropicKey: joinSecretParts("s", "k", "-", "ant", "-", "fixture"),
  googleKey: joinSecretParts("A", "I", "z", "a", "1234567890abcdefghijklmnopqrst"),
  perplexityKey: joinSecretParts("p", "p", "l", "x", "-", "fixture"),
  openRouterKey: joinSecretParts("s", "k", "-", "or", "-", "v1", "-", "fixture"),
  posthogApiKey: joinSecretParts("p", "h", "x", "_", "1234567890abcdefghijklmnopqrstuvwxyz"),
  posthogErrorKey: joinSecretParts("s", "k", "-", "bad", "-", "posthog", "-", "key"),
  pemPrivateKey: joinSecretParts("-----BEGIN ", "PRIVATE KEY-----\nabc\n-----END ", "PRIVATE KEY-----"),
};
