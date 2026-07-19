import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticate, clearSession, getAuthCallCount, resetAuthMetrics, setAuthTransport } from '../dist/auth.js'
import { sbisCall, setRpcClient, setRpcTransport } from '../dist/rpc-client.js'
import { handleListDocuments } from '../dist/handlers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture(name) {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf-8'))
}

function withTempConfig(run) {
  const dir = mkdtempSync(join(tmpdir(), 'sbis-auth-'))
  const configPath = join(dir, 'config.json')
  const prevConfig = process.env.SBIS_CONFIG_PATH
  delete process.env.SBIS_LOGIN
  delete process.env.SBIS_PASSWORD
  process.env.SBIS_CONFIG_PATH = configPath

  return run(configPath).finally(() => {
    if (prevConfig === undefined) delete process.env.SBIS_CONFIG_PATH
    else process.env.SBIS_CONFIG_PATH = prevConfig
    clearSession()
    resetAuthMetrics()
    setAuthTransport(null)
    setRpcTransport(null)
    setRpcClient(null)
    rmSync(dir, { recursive: true, force: true })
  })
}

const stubConfig = {
  login: 'cfg-login',
  password: 'cfg-secret',
  baseUrl: 'https://mock.sbis.test',
}

test('sid is cached — one authenticate for multiple rpc calls', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    resetAuthMetrics()
    clearSession()

    setAuthTransport(async () => ({
      status: 200,
      json: { jsonrpc: '2.0', result: 'mock-session-id-00000001', id: 0 },
    }))

    let rpcCalls = 0
    setRpcTransport(async (_url, _body, sid) => {
      rpcCalls += 1
      assert.equal(sid, 'mock-session-id-00000001')
      return { status: 200, json: { jsonrpc: '2.0', result: { ok: rpcCalls }, id: 1 } }
    })

    const cfg = { ...stubConfig }
    await sbisCall('СБИС.ИнформацияОТекущемПользователе', { Параметр: {} }, cfg)
    await sbisCall('СБИС.СписокДокументов', { Фильтр: { Тип: 'Реализация' } }, cfg)

    assert.equal(getAuthCallCount(), 1)
    assert.equal(rpcCalls, 2)
  })
})

test('HTTP 401 triggers exactly one re-authentication', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    resetAuthMetrics()
    clearSession()

    let authCalls = 0
    setAuthTransport(async () => {
      authCalls += 1
      return {
        status: 200,
        json: { jsonrpc: '2.0', result: `sid-attempt-${authCalls}`, id: 0 },
      }
    })

    let rpcCalls = 0
    setRpcTransport(async (_url, _body, sid) => {
      rpcCalls += 1
      if (rpcCalls === 1) {
        assert.equal(sid, 'sid-attempt-1')
        return { status: 401, json: {} }
      }
      assert.equal(sid, 'sid-attempt-2')
      return {
        status: 200,
        json: { jsonrpc: '2.0', result: loadFixture('list-documents.json'), id: 1 },
      }
    })

    const result = await sbisCall('СБИС.СписокДокументов', { Фильтр: { Тип: 'Реализация' } }, stubConfig)
    assert.ok(result.Документ)
    assert.equal(authCalls, 2)
    assert.equal(rpcCalls, 2)
  })
})

test('handler integration uses cached auth via transport', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    resetAuthMetrics()
    clearSession()

    setAuthTransport(async () => ({
      status: 200,
      json: { jsonrpc: '2.0', result: 'handler-session', id: 0 },
    }))

    setRpcTransport(async (_url, _body, sid) => {
      assert.equal(sid, 'handler-session')
      return {
        status: 200,
        json: { jsonrpc: '2.0', result: loadFixture('list-documents.json'), id: 1 },
      }
    })

    const raw = await handleListDocuments({ docType: 'Реализация' })
    const parsed = JSON.parse(raw)
    assert.ok(parsed.Документ)
    assert.equal(getAuthCallCount(), 1)
  })
})

test('authenticate stores sid only in memory', async () => {
  await withTempConfig(async () => {
    clearSession()
    setAuthTransport(async () => ({
      status: 200,
      json: { jsonrpc: '2.0', result: 'in-memory-only-sid', id: 0 },
    }))
    const sid = await authenticate(stubConfig)
    assert.equal(sid, 'in-memory-only-sid')
    const again = await authenticate(stubConfig)
    assert.equal(again, 'in-memory-only-sid')
    assert.equal(getAuthCallCount(), 1)
  })
})
