# sbis-mcp

> ⚠️ **Неофициальный проект.** Не аффилирован с ООО «Тензор» / Saby. Требуется ваш собственный аккаунт СБИС (Saby) с доступом к API. **v0.1 — только чтение.** КЭП и подписание документов не поддерживаются.

> ⚠️ **Unofficial, third-party project.** Not affiliated with Tensor LLC / Saby. Requires your own Saby (SBIS) account with API access. **v0.1 is read-only.** Digital signatures (КЭП) are out of scope.

MCP-сервер для чтения электронных документов Saby (СБИС) через JSON-RPC 2.0 API.

## Инструменты v0.1 (read-only)

| Tool | SBIS method |
|------|-------------|
| `sbis_config` | — |
| `sbis_current_user` | `СБИС.ИнформацияОТекущемПользователе` |
| `sbis_list_documents` | `СБИС.СписокДокументов` |
| `sbis_list_documents_by_event` | `СБИС.СписокДокументовПоСобытиям` |
| `sbis_read_document` | `СБИС.ПрочитатьДокумент` |
| `sbis_list_counterparties` | `СБИС.СписокКонтрагентов` |
| `sbis_get_attachment` | GET по временной ссылке |

Запись (`ЗаписатьДокумент`, `ПодготовитьДействие` и др.) — **v0.2**, флаг `writable` (по умолчанию `false`).

## Быстрый старт

### Конфигурация

**Через env (рекомендуется):**

```bash
export SBIS_LOGIN="<ВАШ_ЛОГИН>"
export SBIS_PASSWORD="<ВАШ_ПАРОЛЬ>"
# опционально:
export SBIS_BASE_URL="https://online.sbis.ru"   # тест: https://fix-online.sbis.ru
export SBIS_ACCOUNT="<НОМЕР_АККАУНТА>"
```

**Через файл** `~/.sbis-mcp/config.json`:

```json
{
  "login": "<ВАШ_ЛОГИН>",
  "password": "<ВАШ_ПАРОЛЬ>",
  "baseUrl": "https://online.sbis.ru",
  "writable": false
}
```

### Claude Desktop

См. [examples/claude_desktop_config.json](examples/claude_desktop_config.json).

### Сборка и запуск

```bash
npm install
npm run build
npm start
```

## Лимиты API (из документации Saby)

- Аутентификация: ≤300 вызовов/мин с IP
- Сессия `sid`: ~21 день (заголовок `X-SBISSessionID`)
- Вложение: ≤73 МБ, до 10 вложений/документ
- Временные ссылки на файлы: ~1 месяц

Источник: [saby.ru/help/integration/api/techreq_edo](https://saby.ru/help/integration/api/techreq_edo)

## Документация API

- [Формат JSON-RPC](https://saby.ru/help/integration/api/all_methods/format)
- [Аутентификация](https://saby.ru/help/integration/api/authentication)
- [Документы](https://saby.ru/help/integration/api/documents)
- [Контрагенты](https://saby.ru/help/integration/api/counterparty)

## Live-smoke (вручную)

Скрипт `scripts/live-smoke.mjs` — **не в CI**, требует реальный аккаунт с тарифом «Обмен с контрагентами»:

```bash
npm run build
SBIS_LOGIN="<ВАШ_ЛОГИН>" SBIS_PASSWORD="<ВАШ_ПАРОЛЬ>" node scripts/live-smoke.mjs
```

## Тесты

```bash
npm test
```

Тесты используют `setRpcClient()` и фикстуры из публичной документации — **без живого аккаунта**.

## English

**sbis-mcp** exposes seven read-only MCP tools over the official Saby (SBIS) EDI JSON-RPC API. Configure via `SBIS_LOGIN` / `SBIS_PASSWORD` or `~/.sbis-mcp/config.json`. Session id (`sid`) is kept in process memory only. Write operations are disabled until v0.2 (`writable: false`).

## License

MIT — see [LICENSE](LICENSE).
