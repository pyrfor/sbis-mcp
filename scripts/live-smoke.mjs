#!/usr/bin/env node
/**
 * Ручной live-smoke против online.sbis.ru / fix-online.sbis.ru.
 * Требуется аккаунт СБИС с тарифом «Обмен с контрагентами»; запускает Саша.
 * НЕ входит в npm test и CI.
 *
 * Env: SBIS_LOGIN, SBIS_PASSWORD, опционально SBIS_BASE_URL, SBIS_ACCOUNT
 */

import { getConfig } from '../dist/config.js'
import { sbisCall } from '../dist/rpc-client.js'

function yesterdayRu() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

const config = getConfig()
if (!config) {
  fail('Конфиг не найден. Задайте SBIS_LOGIN и SBIS_PASSWORD (или ~/.sbis-mcp/config.json).')
}

if (!process.env.SBIS_LOGIN || !process.env.SBIS_PASSWORD) {
  console.warn('Рекомендуется передавать SBIS_LOGIN/SBIS_PASSWORD через env, не файл.')
}

try {
  console.log('1/3 СБИС.СписокНашихОрганизаций …')
  const orgs = await sbisCall('СБИС.СписокНашихОрганизаций', { Фильтр: {} }, config)
  console.log(JSON.stringify(orgs, null, 2).slice(0, 2000))

  const date = yesterdayRu()
  console.log(`2/3 СБИС.СписокДокументов за ${date} …`)
  const docs = await sbisCall(
    'СБИС.СписокДокументов',
    {
      Фильтр: {
        Тип: 'Корреспонденция',
        ДатаС: date,
        ДатаПо: date,
        Навигация: { РазмерСтраницы: '5', Страница: '0' },
      },
    },
    config,
  )
  console.log(JSON.stringify(docs, null, 2).slice(0, 2000))

  console.log('3/3 СБИС.ИнформацияОТекущемПользователе …')
  const user = await sbisCall('СБИС.ИнформацияОТекущемПользователе', { Параметр: {} }, config)
  console.log(JSON.stringify(user, null, 2).slice(0, 1000))

  console.log('live-smoke OK')
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}
