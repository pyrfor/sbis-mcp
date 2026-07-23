# sbis-mcp

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Read-only MCP server for Saby (СБИС) EDI** — list/read documents and counterparties via the official JSON-RPC API, so agents can see legally significant paperwork without copy-paste.

> ⚠️ **Unofficial.** Not affiliated with Tensor LLC / Saby. Needs your own Saby account with API access.  
> **v0.1 is read-only.** Digital signatures (КЭП) and write paths are out of scope until v0.2.

> ⚠️ **Неофициальный.** Не аффилирован с ООО «Тензор» / Saby. Нужен свой аккаунт.  
> **v0.1 — только чтение.** КЭП и запись — не в этом релизе.

## Proof — seven tools (v0.1)

| Tool | SBIS method |
|------|-------------|
| `sbis_config` | — |
| `sbis_current_user` | `СБИС.ИнформацияОТекущемПользователе` |
| `sbis_list_documents` | `СБИС.СписокДокументов` |
| `sbis_list_documents_by_event` | `СБИС.СписокДокументовПоСобытиям` |
| `sbis_read_document` | `СБИС.ПрочитатьДокумент` |
| `sbis_list_counterparties` | `СБИС.СписокКонтрагентов` |
| `sbis_get_attachment` | GET by temporary link |

Writes (`ЗаписатьДокумент`, `ПодготовитьДействие`, …) stay off until v0.2 (`writable`, default `false`).

## First use

**Env (recommended):**

```bash
export SBIS_LOGIN="<LOGIN>"
export SBIS_PASSWORD="<PASSWORD>"
# optional:
export SBIS_BASE_URL="https://online.sbis.ru"   # test: https://fix-online.sbis.ru
export SBIS_ACCOUNT="<ACCOUNT>"
```

**Or** `~/.sbis-mcp/config.json`:

```json
{
  "login": "<LOGIN>",
  "password": "<PASSWORD>",
  "baseUrl": "https://online.sbis.ru",
  "writable": false
}
```

Build & run (Node.js ≥ 18):

```bash
npm install
npm run build
npm start
```

Claude Desktop example: [examples/claude_desktop_config.json](examples/claude_desktop_config.json).

## Limits (from Saby docs)

- Auth: ≤300 calls/min per IP  
- Session `sid`: ~21 days (`X-SBISSessionID`)  
- Attachment: ≤73 MB, up to 10 per document  
- Temporary file links: ~1 month  

Source: [saby.ru tech requirements](https://saby.ru/help/integration/api/techreq_edo)

API docs: [JSON-RPC format](https://saby.ru/help/integration/api/all_methods/format) · [auth](https://saby.ru/help/integration/api/authentication) · [documents](https://saby.ru/help/integration/api/documents) · [counterparties](https://saby.ru/help/integration/api/counterparty)

## Live smoke & tests

Live smoke is **manual** (real account + tariff «Обмен с контрагентами»):

```bash
npm run build
SBIS_LOGIN="…" SBIS_PASSWORD="…" node scripts/live-smoke.mjs
```

Unit tests mock RPC — no live account:

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
