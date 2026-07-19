import { configMissingResponse, getConfig, getConfigPath } from './config.js'
import { CONFIG_SETUP_INSTRUCTIONS } from './types.js'
import { sbisCall } from './rpc-client.js'
import { attachmentSha256, attachmentToBase64, downloadAttachment } from './attachments.js'
import type { SbisConfig } from './types.js'

function requireConfig(): SbisConfig | null {
  return getConfig()
}

function formatDateRu(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function buildNavigation(page?: number, pageSize?: number): Record<string, string> {
  const nav: Record<string, string> = {}
  if (pageSize !== undefined) nav.РазмерСтраницы = String(Math.min(200, Math.max(1, pageSize)))
  if (page !== undefined) nav.Страница = String(Math.max(0, page))
  return nav
}

export async function handleConfig(_args: Record<string, unknown>): Promise<string> {
  const config = getConfig()
  if (!config) {
    return JSON.stringify(
      {
        configured: false,
        configPath: getConfigPath(),
        setup: CONFIG_SETUP_INSTRUCTIONS.example,
        instructions: CONFIG_SETUP_INSTRUCTIONS,
        note: 'v0.1 read-only. КЭП/подписание не поддерживаются.',
      },
      null,
      2,
    )
  }

  return JSON.stringify(
    {
      configured: true,
      baseUrl: (config.baseUrl ?? 'https://online.sbis.ru').replace(/\/$/, ''),
      account: config.account ?? null,
      writable: config.writable ?? false,
      limits: CONFIG_SETUP_INSTRUCTIONS.limits,
      note: 'Connection is configured. Try sbis_current_user or sbis_list_documents.',
    },
    null,
    2,
  )
}

export async function handleCurrentUser(_args: Record<string, unknown>): Promise<string> {
  const config = requireConfig()
  if (!config) return configMissingResponse()

  const params: Record<string, unknown> = { Параметр: {} }
  if (typeof _args.extraFields === 'string' && _args.extraFields) {
    ;(params.Параметр as Record<string, unknown>).ДопПоля = _args.extraFields
  }

  const result = await sbisCall('СБИС.ИнформацияОТекущемПользователе', params, config)
  return JSON.stringify(result, null, 2)
}

export async function handleListDocuments(args: Record<string, unknown>): Promise<string> {
  const config = requireConfig()
  if (!config) return configMissingResponse()

  const docType = String(args.docType ?? args.type ?? '')
  if (!docType) {
    return JSON.stringify({
      error: 'Missing required field: docType',
      hint: 'Тип документа, напр. «Реализация», «Корреспонденция», «ДокОтгрИсх» — см. документацию СБИС.СписокДокументов',
    })
  }

  const filter: Record<string, unknown> = { Тип: docType }

  if (args.dateFrom) filter.ДатаС = formatDateRu(String(args.dateFrom))
  if (args.dateTo) filter.ДатаПо = formatDateRu(String(args.dateTo))
  if (args.direction) filter.Направление = String(args.direction)
  if (args.mask) filter.Маска = String(args.mask)
  if (args.state) filter.Состояние = String(args.state)

  if (args.counterpartyInn) {
    filter.Контрагент = { СвЮЛ: { ИНН: String(args.counterpartyInn) } }
    if (args.counterpartyKpp) {
      ;(filter.Контрагент as Record<string, unknown>).СвЮЛ = {
        ИНН: String(args.counterpartyInn),
        КПП: String(args.counterpartyKpp),
      }
    }
  }

  const nav = buildNavigation(
    args.page !== undefined ? Number(args.page) : undefined,
    args.pageSize !== undefined ? Number(args.pageSize) : args.limit !== undefined ? Number(args.limit) : 50,
  )
  if (Object.keys(nav).length > 0) filter.Навигация = nav

  const result = await sbisCall('СБИС.СписокДокументов', { Фильтр: filter }, config)
  return JSON.stringify(result, null, 2)
}

export async function handleListDocumentsByEvent(args: Record<string, unknown>): Promise<string> {
  const config = requireConfig()
  if (!config) return configMissingResponse()

  const registryType = String(args.registryType ?? args.registry ?? '')
  if (!registryType) {
    return JSON.stringify({
      error: 'Missing required field: registryType',
      hint: 'ТипРеестра: «Входящие», «Исходящие» или «Ответы от контрагентов»',
    })
  }

  const filter: Record<string, unknown> = { ТипРеестра: registryType }

  if (args.dateFrom) filter.ДатаС = formatDateRu(String(args.dateFrom))
  if (args.dateTo) filter.ДатаПо = formatDateRu(String(args.dateTo))
  if (args.state) filter.Состояние = String(args.state)

  if (args.counterpartyInn) {
    filter.Контрагент = { СвЮЛ: { ИНН: String(args.counterpartyInn) } }
  }

  const nav = buildNavigation(
    args.page !== undefined ? Number(args.page) : undefined,
    args.pageSize !== undefined ? Number(args.pageSize) : args.limit !== undefined ? Number(args.limit) : 50,
  )
  if (Object.keys(nav).length > 0) filter.Навигация = nav

  const result = await sbisCall('СБИС.СписокДокументовПоСобытиям', { Фильтр: filter }, config)
  return JSON.stringify(result, null, 2)
}

export async function handleReadDocument(args: Record<string, unknown>): Promise<string> {
  const config = requireConfig()
  if (!config) return configMissingResponse()

  const docId = String(args.documentId ?? args.id ?? '')
  if (!docId) {
    return JSON.stringify({ error: 'Missing required field: documentId' })
  }

  const doc: Record<string, unknown> = { Идентификатор: docId }
  if (args.editionId) doc.Редакция = { Идентификатор: String(args.editionId) }

  const params: Record<string, unknown> = { Документ: doc }
  if (args.extraFields) {
    params.ДопПоля = String(args.extraFields)
  }

  const result = await sbisCall('СБИС.ПрочитатьДокумент', params, config)
  return JSON.stringify(result, null, 2)
}

export async function handleListCounterparties(args: Record<string, unknown>): Promise<string> {
  const config = requireConfig()
  if (!config) return configMissingResponse()

  const filter: Record<string, unknown> = {}

  if (args.inn) filter.ИНН = String(args.inn)
  if (args.kpp) filter.КПП = String(args.kpp)
  if (args.name) filter.Название = String(args.name)
  if (args.query) {
    const q = String(args.query)
    if (/^\d{10}$|^\d{12}$/.test(q)) filter.ИНН = q
    else filter.Название = q
  }

  if (Object.keys(filter).length === 0) {
    return JSON.stringify({
      error: 'Укажите хотя бы один фильтр: inn, kpp, name или query',
      hint: 'Поиск через СБИС.СписокКонтрагентов (Фильтр по ИНН/КПП/названию)',
    })
  }

  const nav = buildNavigation(
    args.page !== undefined ? Number(args.page) : undefined,
    args.pageSize !== undefined ? Number(args.pageSize) : 25,
  )
  if (Object.keys(nav).length > 0) filter.Навигация = nav

  const result = await sbisCall('СБИС.СписокКонтрагентов', { Фильтр: filter }, config)
  return JSON.stringify(result, null, 2)
}

export async function handleGetAttachment(args: Record<string, unknown>): Promise<string> {
  const config = requireConfig()
  if (!config) return configMissingResponse()

  const url = String(args.url ?? '')
  if (!url) {
    return JSON.stringify({
      error: 'Missing required field: url',
      hint: 'Временная ссылка из Документ.Вложение[].Файл.Ссылка (sbis_read_document). Действует ~1 месяц.',
    })
  }

  const download = await downloadAttachment(url)
  const sha256 = await attachmentSha256(download)
  const includeContent = args.includeContent === true

  const payload: Record<string, unknown> = {
    url,
    contentType: download.contentType,
    size: download.size,
    sha256,
    note: 'Ссылка временная (~1 месяц). КЭП/подписи — вне v0.1.',
  }

  if (includeContent) {
    payload.contentBase64 = attachmentToBase64(download)
  }

  return JSON.stringify(payload, null, 2)
}

export const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<string> | string> = {
  sbis_config: handleConfig,
  sbis_current_user: handleCurrentUser,
  sbis_list_documents: handleListDocuments,
  sbis_list_documents_by_event: handleListDocumentsByEvent,
  sbis_read_document: handleReadDocument,
  sbis_list_counterparties: handleListCounterparties,
  sbis_get_attachment: handleGetAttachment,
}

export const toolDefinitions = [
  {
    name: 'sbis_config',
    description: 'Check Saby/SBIS configuration status and setup instructions (read-only v0.1)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'sbis_current_user',
    description: 'Current authenticated user (СБИС.ИнформацияОТекущемПользователе). КЭП auth not supported in v0.1.',
    inputSchema: {
      type: 'object',
      properties: {
        extraFields: {
          type: 'string',
          description: 'ДопПоля, напр. «СписокВнешнихПровайдеров»',
        },
      },
    },
  },
  {
    name: 'sbis_list_documents',
    description:
      'List documents by type and period (СБИС.СписокДокументов). docType required: Реализация, Корреспонденция, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        docType: { type: 'string', description: 'Тип документа (Тип)' },
        dateFrom: { type: 'string', description: 'YYYY-MM-DD → ДатаС' },
        dateTo: { type: 'string', description: 'YYYY-MM-DD → ДатаПо' },
        direction: { type: 'string', enum: ['Входящий', 'Исходящий'], description: 'Направление' },
        counterpartyInn: { type: 'string' },
        counterpartyKpp: { type: 'string' },
        state: { type: 'string', description: 'Состояние документа' },
        mask: { type: 'string', description: 'Маска по номеру/примечанию' },
        page: { type: 'number', description: 'Страница (0-based)' },
        pageSize: { type: 'number', description: 'РазмерСтраницы 1–200' },
        limit: { type: 'number', description: 'Alias for pageSize' },
      },
      required: ['docType'],
    },
  },
  {
    name: 'sbis_list_documents_by_event',
    description:
      'Registry lists: Входящие / Исходящие / Ответы от контрагентов (СБИС.СписокДокументовПоСобытиям)',
    inputSchema: {
      type: 'object',
      properties: {
        registryType: {
          type: 'string',
          enum: ['Входящие', 'Исходящие', 'Ответы от контрагентов'],
        },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        state: { type: 'string' },
        counterpartyInn: { type: 'string' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['registryType'],
    },
  },
  {
    name: 'sbis_read_document',
    description: 'Full document card with attachments metadata (СБИС.ПрочитатьДокумент)',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Идентификатор документа' },
        editionId: { type: 'string', description: 'Идентификатор редакции (optional)' },
        extraFields: { type: 'string', description: 'ДопПоля' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'sbis_list_counterparties',
    description: 'Search counterparties by INN/KPP/name (СБИС.СписокКонтрагентов)',
    inputSchema: {
      type: 'object',
      properties: {
        inn: { type: 'string' },
        kpp: { type: 'string' },
        name: { type: 'string' },
        query: { type: 'string', description: 'INN or name' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
      },
    },
  },
  {
    name: 'sbis_get_attachment',
    description:
      'Download attachment by temporary URL from read_document (GET, no sid). Pass includeContent:true for base64.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Документ.Вложение[].Файл.Ссылка' },
        includeContent: { type: 'boolean', description: 'Include contentBase64 (large files up to 73MB)' },
      },
      required: ['url'],
    },
  },
] as const
