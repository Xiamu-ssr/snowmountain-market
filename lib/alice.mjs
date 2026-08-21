import { randomBytes } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ALICE_SKILLS, DEFAULT_ALICE_TIMEOUT_MS, WIND_ALICE_ENDPOINT } from './constants.mjs'

const QUOTA_MESSAGE = '很抱歉，今日已超出体验期任务限额，欢迎您明日再来尝试。'
const MAX_RESULT_BYTES = 4 * 1024 * 1024

function uuidV7() {
  const bytes = randomBytes(16)
  const now = BigInt(Date.now())
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number((now >> BigInt((5 - index) * 8)) & 0xffn)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function containsChinese(value) {
  return /[\u3400-\u9fff]/.test(value)
}

function resolveSkill(value) {
  if (value === undefined) return undefined
  const normalized = value.trim().toLowerCase().replace(/[\s\-_&"'`“”‘’]+/g, '')
  const match = ALICE_SKILLS.find((skill) =>
    skill.zh === value || skill.en === value ||
    skill.zh.toLowerCase().replace(/[\s\-_&"'`“”‘’]+/g, '') === normalized ||
    skill.en.toLowerCase().replace(/[\s\-_&"'`“”‘’]+/g, '') === normalized)
  if (match === undefined) throw new Error(`Unknown Wind Alice skill: ${value}`)
  return match
}

export function buildAliceRequest(prompt, skillName) {
  const skill = resolveSkill(skillName)
  const prefix = skill === undefined
    ? ''
    : containsChinese(prompt)
      ? `使用「${skill.zh}」技能：`
      : `Using "${skill.en}" skill:`
  return {
    jsonrpc: '2.0',
    method: 'message/stream',
    params: {
      message: {
        messageId: uuidV7(),
        role: 'user',
        kind: 'message',
        parts: [
          { kind: 'text', text: `${prefix}${prompt}` },
          {
            kind: 'data',
            data: {
              chatMode: '12',
              originalChatMode: '4',
              switchMode: 'auto',
              timezone: 'Asia/Shanghai',
            },
            metadata: {
              key: 'Wind.WindSearch.ChatService.A2A',
              version: '1.0.0',
            },
          },
        ],
        contextId: uuidV7(),
        taskId: uuidV7(),
      },
    },
    id: uuidV7(),
  }
}

export function parseSsePayload(payload) {
  return payload
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
      if (data.length === 0) return []
      try {
        return [JSON.parse(data)]
      } catch {
        return []
      }
    })
}

export function extractAliceResult(events) {
  let lastValue
  for (const event of events) {
    if (event?.error !== undefined) {
      throw new Error(event.error.message ?? JSON.stringify(event.error))
    }
    if (event?.result?.isError === true) {
      const text = (event.result.content ?? [])
        .map((part) => typeof part?.text === 'string' ? part.text : '')
        .filter(Boolean)
        .join('\n')
      throw new Error(text || 'Wind Alice returned an error')
    }
    const artifact = event?.result?.artifact
    if (event?.result?.kind !== 'artifact-update' || artifact?.name !== 'agentResult') continue
    for (const part of artifact.parts ?? []) {
      const value = part?.kind === 'data' ? part?.data?.data : undefined
      if (value !== undefined) lastValue = value
    }
  }
  return lastValue
}

function resultText(value) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

async function readAliceResponse(response, signal) {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 2000)
    throw new Error(`Wind Alice HTTP ${response.status}: ${detail}`)
  }
  if (response.body === null) throw new Error('Wind Alice returned an empty response')

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/event-stream')) {
    const raw = await response.text()
    if (Buffer.byteLength(raw) > MAX_RESULT_BYTES) throw new Error('Wind Alice response exceeded 4 MiB')
    let events
    if (raw.includes('data:')) {
      events = parseSsePayload(raw)
    } else {
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error(`Wind Alice returned an unsupported response: ${raw.slice(0, 1000)}`)
      }
      events = Array.isArray(parsed) ? parsed : [parsed]
    }
    if (raw.includes(QUOTA_MESSAGE)) throw new Error('Wind Alice daily trial quota is exhausted')
    const result = extractAliceResult(events)
    if (result === undefined) throw new Error('Wind Alice completed without an agentResult artifact')
    return resultText(result)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latest
  let received = 0
  while (true) {
    if (signal.aborted) throw signal.reason
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_RESULT_BYTES) throw new Error('Wind Alice response exceeded 4 MiB')
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    const events = parseSsePayload(blocks.join('\n\n'))
    if (JSON.stringify(events).includes(QUOTA_MESSAGE)) throw new Error('Wind Alice daily trial quota is exhausted')
    const next = extractAliceResult(events)
    if (next !== undefined) latest = next
  }
  buffer += decoder.decode()
  if (buffer.trim().length > 0) {
    const events = parseSsePayload(buffer)
    if (JSON.stringify(events).includes(QUOTA_MESSAGE)) throw new Error('Wind Alice daily trial quota is exhausted')
    const next = extractAliceResult(events)
    if (next !== undefined) latest = next
  }
  if (latest === undefined) throw new Error('Wind Alice completed without an agentResult artifact')
  return resultText(latest)
}

function operationSignal(parent, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`Wind Alice timed out after ${timeoutMs}ms`)), timeoutMs)
  timer.unref?.()
  const abort = () => controller.abort(parent.reason)
  if (parent.aborted) abort()
  else parent.addEventListener('abort', abort, { once: true })
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parent.removeEventListener('abort', abort)
    },
  }
}

export function createAliceTool({ resolveApiKey, timeoutMs = DEFAULT_ALICE_TIMEOUT_MS, fetchImpl = fetch }) {
  return defineTool({
    name: 'wind_alice',
    description: 'Run a Wind Alice professional financial-analysis workflow. Use for company one-pagers, due-diligence questions, earnings reviews, thematic screening, fact checks, macro, bond, credit, fund, market-sizing, and comparable-company analysis. The Wind API key remains host-side.',
    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: 'The financial-analysis request sent to Wind Alice.',
      },
      skill: {
        type: 'string',
        enum: ALICE_SKILLS.flatMap((skill) => [skill.zh, skill.en]),
        description: 'Optional Wind Alice workflow. Omit for automatic routing.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          skill: { type: 'string' },
          output: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.output }],
    },
    async execute(args, exec) {
      const apiKey = await resolveApiKey()
      const operation = operationSignal(exec.signal, timeoutMs)
      try {
        const response = await fetchImpl(WIND_ALICE_ENDPOINT, {
          method: 'POST',
          headers: {
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(buildAliceRequest(args.prompt, args.skill)),
          redirect: 'error',
          signal: operation.signal,
        })
        const output = await readAliceResponse(response, operation.signal)
        return { ...(args.skill === undefined ? {} : { skill: args.skill }), output }
      } finally {
        operation.dispose()
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: args.skill === undefined ? 'Wind Alice' : `Wind Alice · ${args.skill}`,
      kind: 'read',
      rawInput: args.prompt,
    }),
  })
}
