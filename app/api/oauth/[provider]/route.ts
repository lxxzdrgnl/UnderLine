/**
 * GET /api/oauth/[provider]?callbackUrl=/
 *
 * 로그인 · 계정연결 통합 진입점.
 *   세션 없음 → mode='login'
 *   세션 있음 → mode='link' (현재 유저에 provider 추가)
 *
 * PKCE 생성 → OAuthState DB 저장 → state=id 로 OAuth 리다이렉트.
 * state 는 cuid(예측 불가) → CSRF 방어.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce'
import { getProviderConfig } from '@/lib/oauth-providers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') ?? '/'

  let config
  try {
    config = getProviderConfig(provider)
  } catch {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const session = await auth()
  const mode = session?.user?.id ? 'link' : 'login'

  if (mode === 'link') {
    // 이미 연결된 provider면 스킵
    const existing = await prisma.account.findFirst({
      where: { userId: session!.user!.id, provider },
    })
    if (existing) {
      return NextResponse.redirect(new URL('/profile?link=already', req.url))
    }
  }

  // 만료된 상태값 정리
  await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } })

  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)

  const state = await prisma.oAuthState.create({
    data: {
      mode,
      userId: session?.user?.id ?? null,
      provider,
      codeVerifier: verifier,
      callbackUrl,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })

  const clientId = process.env[config.clientIdEnv]!
  const redirectUri = `${process.env.AUTH_URL}/api/oauth/${provider}/callback`

  const url = new URL(config.authUrl)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scopes.join(' '))
  url.searchParams.set('state', state.id)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')

  return NextResponse.redirect(url.toString())
}
