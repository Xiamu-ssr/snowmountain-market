import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { createAliceTool } from './alice.mjs'
import { DEFAULT_API_KEY_ENV, DEFAULT_MCP_TIMEOUT_MS, MCP_DOMAINS } from './constants.mjs'
import { createWindMcpProxy } from './proxy.mjs'
import { RUNTIME_SKILLS } from './skills.mjs'

export const name = 'wind-aifin'
export const inject = ['tools', 'credentials', 'skills']

const SETTINGS_NAMESPACE = settingsNamespace('wind-aifin')

export const Config = z.object({
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
})

function resolvedConfig(value = {}) {
  return { apiKeyEnv: value.apiKeyEnv ?? DEFAULT_API_KEY_ENV }
}

export async function apply(ctx, entry = {}) {
  let current = () => resolvedConfig(entry)
  installSettingsSection(ctx, SETTINGS_NAMESPACE, Config, resolvedConfig(entry), {
    setSource(source) {
      current = () => resolvedConfig(source())
    },
    onChange() {},
  })

  const resolveApiKey = async () => {
    const ref = credentialRef(current().apiKeyEnv)
    const resolved = await ctx.credentials.resolve(ref)
    if (resolved?.value === undefined || resolved.value.length === 0) {
      throw new Error(`${ref} is not configured in the DSH credential service`)
    }
    return resolved.value
  }

  const proxy = await createWindMcpProxy({ domains: MCP_DOMAINS, resolveApiKey })
  ctx.effect(() => () => proxy.close(), 'wind-aifin.mcp-proxy')

  const children = MCP_DOMAINS.map((domain) => ctx.plugin(mcpClient, {
    transport: 'streamable-http',
    serverName: domain.serverName,
    url: proxy.urlFor(domain.id),
    headers: {},
    toolCallTimeoutMs: DEFAULT_MCP_TIMEOUT_MS,
    failOnStartupError: false,
    reconnect: {
      enabled: true,
      initialDelayMs: 1_000,
      maxDelayMs: 30_000,
      maxAttempts: 100,
    },
  }))
  await Promise.all(children)

  ctx.tools.register(createAliceTool({ resolveApiKey }))
  for (const skill of RUNTIME_SKILLS) ctx.skills.register(skill)
}

