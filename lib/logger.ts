const isDev = process.env.NODE_ENV !== 'production'

type Level = 'debug' | 'info' | 'warn' | 'error'

function log(level: Level, message: string, data?: Record<string, unknown>) {
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...(data ?? {}),
  }

  const line = isDev
    ? `[${entry.time}] ${level.toUpperCase().padEnd(5)} ${message}${data ? ' ' + JSON.stringify(data) : ''}`
    : JSON.stringify(entry)

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
  info:  (msg: string, data?: Record<string, unknown>) => log('info',  msg, data),
  warn:  (msg: string, data?: Record<string, unknown>) => log('warn',  msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),
}

/** Wrap a route handler with request/response logging */
export function withLogging(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
) {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    const start = Date.now()
    const { method, url } = req
    const path = new URL(url).pathname

    logger.info('→ request', { method, path })

    try {
      const res = await handler(req, ctx)
      const ms = Date.now() - start
      logger.info('← response', { method, path, status: res.status, ms })
      return res
    } catch (err) {
      const ms = Date.now() - start
      logger.error('✗ unhandled', {
        method,
        path,
        ms,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 4).join(' | ') : undefined,
      })
      throw err
    }
  }
}
