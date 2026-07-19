import type { SbisConfig } from './types.js'
import { DEFAULT_BASE_URL } from './types.js'

let cachedSid: string | null = null
let authCallCount = 0

export function getCachedSid(): string | null {
  return cachedSid
}

export function getAuthCallCount(): number {
  return authCallCount
}

export function clearSession(): void {
  cachedSid = null
}

export function resetAuthMetrics(): void {
  authCallCount = 0
}

function baseUrl(config: SbisConfig): string {
  return (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
}

export type AuthTransport = (
  url: string,
  body: string,
) => Promise<{ status: number; json: unknown }>

let authTransportOverride: AuthTransport | null = null

export function setAuthTransport(fn: AuthTransport | null): void {
  authTransportOverride = fn
}

async function defaultAuthTransport(url: string, body: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json-rpc; charset=utf-8' },
    body,
    signal: AbortSignal.timeout(30000),
  })
  const json = (await res.json()) as unknown
  return { status: res.status, json }
}

export async function authenticate(config: SbisConfig, force = false): Promise<string> {
  if (!force && cachedSid) return cachedSid

  const params: Record<string, unknown> = {
    Параметр: {
      Логин: config.login,
      Пароль: config.password,
    },
  }
  if (config.account) {
    ;(params.Параметр as Record<string, unknown>).НомерАккаунта = config.account
  }

  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'СБИС.Аутентифицировать',
    params,
    id: 0,
  })

  const url = `${baseUrl(config)}/auth/service/`
  const transport = authTransportOverride ?? defaultAuthTransport
  const { status, json } = await transport(url, body)

  if (status === 401) {
    throw new Error('SBIS authentication failed: HTTP 401')
  }

  const payload = json as { result?: string; error?: { message?: string } }
  if (payload.error) {
    throw new Error(payload.error.message ?? 'SBIS authentication error')
  }
  if (!payload.result || typeof payload.result !== 'string') {
    throw new Error('SBIS authentication returned no session id')
  }

  authCallCount += 1
  cachedSid = payload.result
  return cachedSid
}
