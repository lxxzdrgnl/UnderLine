import type { ErrorCode, ApiErrorResponse } from '@/types'

export function apiError(
  path: string,
  status: number,
  code: ErrorCode,
  message?: string,
  details?: unknown
): ApiErrorResponse {
  return {
    timestamp: new Date().toISOString(),
    path,
    status,
    code,
    message: message ?? code,
    details: details ?? null,
  }
}
