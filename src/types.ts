export type SbisConfig = {
  login: string
  password: string
  account?: string
  baseUrl?: string
  /** v0.2 — write tools. Default false (read-only). */
  writable?: boolean
}

export type SbisDocument = {
  Идентификатор?: string
  Дата?: string
  Номер?: string
  Сумма?: string
  Название?: string
  Тип?: string
  Направление?: string
  Состояние?: { Код?: string; Название?: string; Примечание?: string }
  Контрагент?: SbisCounterparty
  Вложение?: SbisAttachment[]
  [key: string]: unknown
}

export type SbisCounterparty = {
  СвЮЛ?: {
    ИНН?: string
    КПП?: string
    Название?: string
  }
  СвФЛ?: {
    ИНН?: string
    Фамилия?: string
    Имя?: string
    Отчество?: string
  }
  Идентификатор?: string
  [key: string]: unknown
}

export type SbisAttachment = {
  Идентификатор?: string
  Название?: string
  Тип?: string
  Файл?: {
    Имя?: string
    Ссылка?: string
  }
  [key: string]: unknown
}

export type SbisNavigation = {
  РазмерСтраницы?: string
  Страница?: string
  ЕстьЕще?: string
}

export const DEFAULT_BASE_URL = 'https://online.sbis.ru'

export const CONFIG_PATH_SUFFIX = '.sbis-mcp/config.json'

export const WRITES_V02_MESSAGE =
  'Запись в Saby/СБИС отключена (writable=false). Операции записи появятся в v0.2.'

export const CONFIG_SETUP_INSTRUCTIONS = {
  ru: 'Настройте подключение к Saby (СБИС) через переменные окружения или файл конфигурации.',
  en: 'Configure the Saby (SBIS) connection via environment variables or a config file.',
  steps: [
    '1. Убедитесь, что у организации подключён тариф «Обмен с контрагентами» (ЭДО API).',
    '2a. Рекомендуется — задайте env: SBIS_LOGIN, SBIS_PASSWORD (опционально SBIS_ACCOUNT, SBIS_BASE_URL).',
    '2b. Либо создайте ~/.sbis-mcp/config.json с полями login, password.',
    '3. Проверьте: вызовите sbis_config или sbis_current_user.',
  ],
  example: {
    login: '<ВАШ_ЛОГИН>',
    password: '<ВАШ_ПАРОЛЬ>',
    account: '<НОМЕР_АККАУНТА_ЕСЛИ_НЕСКОЛЬКО>',
    baseUrl: 'https://online.sbis.ru',
    writable: false,
  },
  limits: {
    authPerMinute: 300,
    sessionDays: 21,
    attachmentMaxMb: 73,
    pageSizeMax: 200,
  },
  docs: [
    'https://saby.ru/help/integration/api/all_methods/format',
    'https://saby.ru/help/integration/api/authentication',
    'https://saby.ru/help/integration/api/documents',
    'https://saby.ru/help/integration/api/techreq_edo',
  ],
}
