#!/usr/bin/env node
/**
 * Saby (SBIS) EDI MCP Server — v0.1 read-only
 *
 * JSON-RPC 2.0 → online.sbis.ru/service/?srv=1
 * Auth: СБИС.Аутентифицировать → sid (X-SBISSessionID), in-memory only
 * Config: SBIS_LOGIN / SBIS_PASSWORD / SBIS_BASE_URL or ~/.sbis-mcp/config.json
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { toolDefinitions, toolHandlers } from './handlers.js'

const server = new Server({ name: 'sbis-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...toolDefinitions],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  const handler = toolHandlers[name]
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  }

  try {
    const result = await handler(args ?? {})
    return { content: [{ type: 'text', text: result }] }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('sbis-mcp v0.1 (read-only) running on stdio')
}

main().catch(console.error)
