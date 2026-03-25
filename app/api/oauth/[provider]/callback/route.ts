/**
 * GET /api/oauth/[provider]/callback
 *
 * 로그인 · 계정연결 통합 콜백.
 *
 * [login 모드]
 *   1. providerAccountId로 기존 Account 조회 → 있으면 해당 User로 세션 생성
 *   2. email로 기존 User 조회 → 있으면 Account 추가 후 세션 생성 (같은 이메일 통합)
 *   3. 없으면 User + Account 신규 생성 후 세션 생성
 *
 * [link 모드]
 *   기존 User에 Account만 추가. User 생성 없음.
 *   동일 provider 계정이 다른 User에게 이미 연결된 경우 → 거부 (별개 계정 유지)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getProviderConfig } from '@/lib/oauth-providers'
import { randomBytes } from 'crypto'

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30일(초)

async function createSession(userId: string, res: NextResponse) {
  const sessionToken = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000)
  await prisma.session.create({ data: { sessionToken, userId, expires } })
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const stateId = searchParams.get('state')
  const error = searchParams.get('error')

  const base = process.env.AUTH_URL ?? new URL(req.url).origin

  if (error) return NextResponse.redirect(new URL('/login?error=cancelled', base))
  if (!code || !stateId) return NextResponse.redirect(new URL('/login?error=invalid', base))

  let config
  try {
    config = getProviderConfig(provider)
  } catch {
    return NextResponse.redirect(new URL('/login?error=invalid', base))
  }

  // state 검증
  const oauthState = await prisma.oAuthState.findUnique({ where: { id: stateId } })
  if (!oauthState || oauthState.provider !== provider || oauthState.expiresAt < new Date()) {
    if (oauthState) await prisma.oAuthState.delete({ where: { id: stateId } })
    return NextResponse.redirect(new URL('/login?error=expired', base))
  }

  // code → access token
  const clientId = process.env[config.clientIdEnv]!
  const clientSecret = process.env[config.clientSecretEnv]!
  const redirectUri = `${process.env.AUTH_URL}/api/oauth/${provider}/callback`

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: oauthState.codeVerifier,
  })
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (config.tokenAuthMethod === 'basic') {
    headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  } else {
    body.set('client_id', clientId)
    body.set('client_secret', clientSecret)
  }

  const tokenRes = await fetch(config.tokenUrl, { method: 'POST', headers, body })
  if (!tokenRes.ok) {
    await prisma.oAuthState.delete({ where: { id: stateId } })
    return NextResponse.redirect(new URL('/login?error=token_error', base))
  }
  const tokens = await tokenRes.json() as {
    access_token: string; refresh_token?: string; expires_in?: number
    token_type?: string; scope?: string; id_token?: string
  }

  // provider 프로필 조회
  const profileRes = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!profileRes.ok) {
    await prisma.oAuthState.delete({ where: { id: stateId } })
    return NextResponse.redirect(new URL('/login?error=profile_error', base))
  }
  const profile = config.parseProfile(await profileRes.json())

  const accountData = {
    provider,
    providerAccountId: profile.providerAccountId,
    type: 'oauth' as const,
    email: profile.email,
    image: profile.image,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
    token_type: tokens.token_type ?? null,
    scope: tokens.scope ?? null,
    id_token: tokens.id_token ?? null,
  }

  await prisma.oAuthState.delete({ where: { id: stateId } })

  // ── LINK 모드 ──────────────────────────────────────────────────────────────
  if (oauthState.mode === 'link') {
    const targetUserId = oauthState.userId!

    const duplicate = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
      select: { userId: true },
    })

    if (duplicate) {
      if (duplicate.userId === targetUserId) {
        return NextResponse.redirect(new URL('/profile?link=already', base))
      }
      // 다른 유저의 계정 → 거부
      return NextResponse.redirect(new URL('/profile?link=taken', base))
    }

    await prisma.account.create({ data: { userId: targetUserId, ...accountData } })
    return NextResponse.redirect(new URL('/profile?link=success', base))
  }

  // ── LOGIN 모드 ─────────────────────────────────────────────────────────────
  const appBase = process.env.AUTH_URL ?? new URL(req.url).origin
  const destination = new URL(oauthState.callbackUrl || '/', appBase)

  // 1. 기존 Account(provider + providerAccountId)로 유저 찾기
  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
    include: { user: true },
  })
  if (existingAccount) {
    // 토큰 갱신
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        access_token: accountData.access_token,
        refresh_token: accountData.refresh_token,
        expires_at: accountData.expires_at,
        image: accountData.image,
      },
    })
    const res = NextResponse.redirect(destination)
    await createSession(existingAccount.userId, res)
    return res
  }

  // 2. 같은 이메일 유저 → Account 추가 후 로그인 (자동 소셜 통합)
  if (profile.email) {
    const userByEmail = await prisma.user.findUnique({ where: { email: profile.email } })
    if (userByEmail) {
      await prisma.account.create({ data: { userId: userByEmail.id, ...accountData } })
      const res = NextResponse.redirect(destination)
      await createSession(userByEmail.id, res)
      return res
    }
  }

  // 3. 신규 유저 생성
  const newUser = await prisma.user.create({
    data: {
      name: profile.name,
      email: profile.email,
      image: profile.image,
      accounts: { create: accountData },
    },
  })
  const res = NextResponse.redirect(destination)
  await createSession(newUser.id, res)
  return res
}
