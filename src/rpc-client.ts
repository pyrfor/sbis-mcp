import type { SbisConfig } from './types.js'
import { DEFAULT_BASE_URL } from './types.js'
import { authenticate, clearSession } from './auth.js'

export type SbisRpcCall = (
  method: string,
  params: Record<string, unknown>,
  config: SbisConfig,
) => Promise<unknown>

let rpcOverride: SbisRpcCall | null = null

export function setRpcClient(fn: SbisRpcCall | null): void {
  rpcOverride = fn
}

function baseUrl(config: SbisConfig): string {
  return (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
}

type RpcTransportResult = { status: number; json: unknown }

export type RpcTransport = (
  url: string,
  body: string,
  sid: string,
) => Promise<RpcTransportResult>

let rpcTransportOverride: RpcTransport | null = null

export function setRpcTransport(fn: RpcTransport | null): void {
  rpcTransportOverride = fn
}

async function defaultRpcTransport(url: string, body: string, sid: string): Promise<RpcTransportResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-rpc; charset=utf-8',
      'X-SBISSessionID': sid,
    },
    body,
    signal: AbortSignal.timeout(30000),
  })
  const json = (await res.json()) as unknown
  return { status: res.status, json }
}

async function callOnce(
  method: string,
  params: Record<string, unknown>,
  config: SbisConfig,
  sid: string,
): Promise<RpcTransportResult> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
    id: 1,
  })
  const url = `${baseUrl(config)}/service/?srv=1`
  const transport = rpcTransportOverride ?? defaultRpcTransport
  return transport(url, body, sid)
}

function unwrapResult(json: unknown): unknown {
  const payload = json as { result?: unknown; error?: { message?: string; code?: number } }
  if (payload.error) {
    const err = new Error(payload.error.message ?? 'SBIS RPC error') as Error & { code?: number }
    err.code = payload.error.code
    throw err
  }
  return payload.result
}

export async function sbisCall(
  method: string,
  params: Record<string, unknown>,
  config: SbisConfig,
): Promise<unknown> {
  if (rpcOverride) {
    return rpcOverride(method, params, config)
  }

  let sid = await authenticate(config)
  let response = await callOnce(method, params, config, sid)

  if (response.status === 401) {
    clearSession()
    sid = await authenticate(config, true)
    response = await callOnce(method, params, config, sid)
    if (response.status === 401) {
      throw new Error('SBIS session expired and re-authentication failed')
    }
  }

  if (response.status >= 500) {
    // one retry on 5xx
    response = await callOnce(method, params, config, sid)
  }

  if (response.status >= 400) {
    throw new Error(`SBIS RPC HTTP ${response.status}`)
  }

  return unwrapResult(response.json)
}
