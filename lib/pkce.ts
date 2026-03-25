import { randomBytes, createHash } from 'crypto'

export function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}
