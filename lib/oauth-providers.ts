export type OAuthProviderConfig = {
  authUrl: string
  tokenUrl: string
  profileUrl: string
  scopes: string[]
  clientIdEnv: string
  clientSecretEnv: string
  tokenAuthMethod: 'basic' | 'body'
  parseProfile: (data: Record<string, unknown>) => {
    providerAccountId: string
    email: string | null
    name: string | null
    image: string | null
  }
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientIdEnv: 'AUTH_GOOGLE_ID',
    clientSecretEnv: 'AUTH_GOOGLE_SECRET',
    tokenAuthMethod: 'body',
    parseProfile: (d) => ({
      providerAccountId: String(d.id),
      email: (d.email as string) ?? null,
      name: (d.name as string) ?? null,
      image: (d.picture as string) ?? null,
    }),
  },
  spotify: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    profileUrl: 'https://api.spotify.com/v1/me',
    scopes: [
      'user-read-email',
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-library-read',
      'playlist-read-private',
      'playlist-read-collaborative',
    ],
    clientIdEnv: 'SPOTIFY_CLIENT_ID',
    clientSecretEnv: 'SPOTIFY_CLIENT_SECRET',
    tokenAuthMethod: 'basic',
    parseProfile: (d) => ({
      providerAccountId: String(d.id),
      email: (d.email as string) ?? null,
      name: (d.display_name as string) ?? null,
      image: ((d.images as { url: string }[])?.[0]?.url) ?? null,
    }),
  },
  // 추가 예시:
  // kakao: { ... },
  // naver: { ... },
}

export function getProviderConfig(provider: string): OAuthProviderConfig {
  const cfg = OAUTH_PROVIDERS[provider]
  if (!cfg) throw new Error(`Unknown provider: ${provider}`)
  return cfg
}
