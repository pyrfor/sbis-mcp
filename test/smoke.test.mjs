import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  handleConfig,
  handleCurrentUser,
  handleListDocuments,
  handleListDocumentsByEvent,
  handleReadDocument,
  handleListCounterparties,
  handleGetAttachment,
} from '../dist/handlers.js'
import { setRpcClient } from '../dist/rpc-client.js'
import { setAttachmentFetcher } from '../dist/attachments.js'
import { assertWritable } from '../dist/config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture(name) {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf-8'))
}

function withTempConfig(run) {
  const dir = mkdtempSync(join(tmpdir(), 'sbis-mcp-'))
  const configPath = join(dir, 'config.json')
  const prevConfig = process.env.SBIS_CONFIG_PATH
  const prevLogin = process.env.SBIS_LOGIN
  const prevPassword = process.env.SBIS_PASSWORD
  const prevBase = process.env.SBIS_BASE_URL

  delete process.env.SBIS_LOGIN
  delete process.env.SBIS_PASSWORD
  delete process.env.SBIS_BASE_URL
  process.env.SBIS_CONFIG_PATH = configPath

  return run(configPath).finally(() => {
    if (prevConfig === undefined) delete process.env.SBIS_CONFIG_PATH
    else process.env.SBIS_CONFIG_PATH = prevConfig
    if (prevLogin === undefined) delete process.env.SBIS_LOGIN
    else process.env.SBIS_LOGIN = prevLogin
    if (prevPassword === undefined) delete process.env.SBIS_PASSWORD
    else process.env.SBIS_PASSWORD = prevPassword
    if (prevBase === undefined) delete process.env.SBIS_BASE_URL
    else process.env.SBIS_BASE_URL = prevBase
    setRpcClient(null)
    setAttachmentFetcher(null)
    rmSync(dir, { recursive: true, force: true })
  })
}

const stubConfig = {
  login: 'cfg-login',
  password: 'cfg-secret',
  baseUrl: 'https://mock.sbis.test',
  writable: false,
}

test('handleConfig without config returns setup instructions in Russian', async () => {
  await withTempConfig(async () => {
    const raw = await handleConfig({})
    const parsed = JSON.parse(raw)
    assert.equal(parsed.configured, false)
    assert.ok(parsed.instructions?.ru)
    assert.ok(parsed.configPath.includes('config.json'))
  })
})

test('handlers return config error when not configured', async () => {
  await withTempConfig(async () => {
    for (const handler of [
      handleCurrentUser,
      handleListDocuments,
      handleListDocumentsByEvent,
      handleReadDocument,
      handleListCounterparties,
      handleGetAttachment,
    ]) {
      const raw = await handler({ docType: 'Реализация', registryType: 'Входящие', documentId: 'x', url: 'http://x', inn: '7700000000' })
      const parsed = JSON.parse(raw)
      assert.ok(parsed.error || parsed.instructions, `expected config error from ${handler.name}`)
    }
  })
})

test('sbis_current_user returns fixture shape via rpc override', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    const fixture = loadFixture('current-user.json')
    setRpcClient(async (method) => {
      assert.equal(method, 'СБИС.ИнформацияОТекущемПользователе')
      return fixture
    })
    const raw = await handleCurrentUser({})
    const parsed = JSON.parse(raw)
    assert.equal(parsed.Пользователь.Фамилия, 'Примеров')
    assert.ok(fixture._fixture.includes('документации'))
  })
})

test('sbis_list_documents returns fixture documents', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    const fixture = loadFixture('list-documents.json')
    setRpcClient(async (method, params) => {
      assert.equal(method, 'СБИС.СписокДокументов')
      assert.equal(params.Фильтр.Тип, 'Реализация')
      return fixture
    })
    const raw = await handleListDocuments({ docType: 'Реализация', dateFrom: '2026-06-01', dateTo: '2026-06-30' })
    const parsed = JSON.parse(raw)
    assert.ok(Array.isArray(parsed.Документ))
    assert.equal(parsed.Документ[0].Тип, 'Реализация')
    assert.equal(parsed.Навигация.ЕстьЕще, 'Нет')
  })
})

test('sbis_list_documents_by_event returns registry fixture', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    const fixture = loadFixture('list-documents-by-event.json')
    setRpcClient(async (method, params) => {
      assert.equal(method, 'СБИС.СписокДокументовПоСобытиям')
      assert.equal(params.Фильтр.ТипРеестра, 'Входящие')
      return fixture
    })
    const raw = await handleListDocumentsByEvent({ registryType: 'Входящие' })
    const parsed = JSON.parse(raw)
    assert.ok(Array.isArray(parsed.Реестр))
    assert.equal(parsed.Реестр[0].Документ.Номер, 'СЧ-042')
  })
})

test('sbis_read_document returns full document fixture', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    const fixture = loadFixture('read-document.json')
    setRpcClient(async (method, params) => {
      assert.equal(method, 'СБИС.ПрочитатьДокумент')
      assert.equal(params.Документ.Идентификатор, '00000000-0000-4000-8000-000000000030')
      return fixture
    })
    const raw = await handleReadDocument({ documentId: '00000000-0000-4000-8000-000000000030' })
    const parsed = JSON.parse(raw)
    assert.equal(parsed.Документ.Вложение[0].Файл.Имя, 'UPD_example.xml')
    assert.ok(parsed.Документ.Вложение[0].Файл.Ссылка.includes('https://'))
  })
})

test('sbis_list_counterparties returns counterparties fixture', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    const fixture = loadFixture('list-counterparties.json')
    setRpcClient(async (method, params) => {
      assert.equal(method, 'СБИС.СписокКонтрагентов')
      assert.equal(params.Фильтр.ИНН, '7700000003')
      return fixture
    })
    const raw = await handleListCounterparties({ inn: '7700000003' })
    const parsed = JSON.parse(raw)
    assert.equal(parsed.Контрагент[0].СвЮЛ.ИНН, '7700000003')
  })
})

test('sbis_get_attachment uses fetch override not live SBIS', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    const bytesFixture = loadFixture('attachment-bytes.json')
    const url = 'https://mock.sbis.test/docs/example/attachment/test'
    setAttachmentFetcher(async (fetchUrl) => {
      assert.equal(fetchUrl, url)
      const data = Buffer.from(bytesFixture.bytes, 'utf-8')
      return {
        url: fetchUrl,
        contentType: bytesFixture.contentType,
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        size: data.length,
      }
    })
    const raw = await handleGetAttachment({ url, includeContent: true })
    const parsed = JSON.parse(raw)
    assert.equal(parsed.contentType, 'application/pdf')
    assert.ok(parsed.sha256)
    assert.ok(parsed.contentBase64)
    assert.ok(bytesFixture._fixture.includes('документации') || bytesFixture._fixture.includes('схемы'))
  })
})

test('writable:false returns v0.2 message', () => {
  const raw = assertWritable({ login: 'x', password: 'y', writable: false })
  assert.ok(raw)
  const parsed = JSON.parse(raw)
  assert.match(parsed.hint, /v0\.2/)
  assert.equal(parsed.writable, false)
})

test('read handlers do not call fetch without rpc override', async () => {
  await withTempConfig(async (configPath) => {
    writeFileSync(configPath, JSON.stringify(stubConfig))
    const originalFetch = globalThis.fetch
    globalThis.fetch = () => {
      throw new Error('fetch must not be called when rpc override is set')
    }
    setRpcClient(async () => loadFixture('current-user.json'))
    try {
      const raw = await handleCurrentUser({})
      assert.ok(JSON.parse(raw).Пользователь)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
