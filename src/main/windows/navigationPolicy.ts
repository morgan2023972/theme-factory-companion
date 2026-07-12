export function isTrustedNavigationUrl(trustedUrl: string, candidateUrl: string): boolean {
  try {
    return new URL(candidateUrl).href === new URL(trustedUrl).href
  } catch {
    return false
  }
}
