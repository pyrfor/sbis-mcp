import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { SbisConfig } from './types.js'
import { CONFIG_SETUP_INSTRUCTIONS } from './types.js'

export function getConfigPath(): string {
  return process.env.SBIS_CONFIG_PATH ?? join(homedir(), '.sbis-mcp', 'config.json')
}

/** @deprecated use getConfigPath() — kept for messages */
export const CONFIG_PATH = getConfigPath()

/**
 * Resolve SBIS connection config.
 *
 * Precedence:
 *   1. Environment: SBIS_LOGIN, SBIS_PASSWORD, SBIS_ACCOUNT?, SBIS_BASE_URL?, SBIS_WRITABLE?
 *   2. JSON file at getConfigPath() (~/.sbis-mcp/config.json)
 */
export function getConfig(): SbisConfig | null {
  if (process.env.SBIS_LOGIN && process.env.SBIS_PASSWORD) {
    const env: SbisConfig = {
      login: process.env.SBIS_LOGIN,
      password: process.env.SBIS_PASSWORD,
    }
    if (process.env.SBIS_ACCOUNT) env.account = process.env.SBIS_ACCOUNT
    if (process.env.SBIS_BASE_URL) env.baseUrl = process.env.SBIS_BASE_URL
    if (process.env.SBIS_WRITABLE === 'true' || process.env.SBIS_WRITABLE === '1') {
      env.writable = true
    }
    return env
  }

  const configPath = getConfigPath()
  if (!existsSync(configPath)) return null
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as SbisConfig
    if (parsed.writable === undefined) parsed.writable = false
    return parsed
  } catch {
    return null
  }
}

export function configMissingResponse(): string {
  return JSON.stringify(
    {
      error: 'Saby (СБИС) не настроен',
      configPath: getConfigPath(),
      instructions: CONFIG_SETUP_INSTRUCTIONS,
      fix: 'Set SBIS_LOGIN / SBIS_PASSWORD env vars, or create ~/.sbis-mcp/config.json',
    },
    null,
    2,
  )
}

export function assertWritable(config: SbisConfig): string | null {
  if (config.writable) return null
  return JSON.stringify(
    {
      error: 'Запись в Saby/СБИС отключена (writable=false)',
      hint: 'Операции записи (ЗаписатьДокумент, ПодготовитьДействие и др.) появятся в v0.2. v0.1 — только чтение.',
      writable: false,
    },
    null,
    2,
  )
}
