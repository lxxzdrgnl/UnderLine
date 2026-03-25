import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.0.1',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? 'dev',
  })
}
