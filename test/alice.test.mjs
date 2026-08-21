import assert from 'node:assert/strict'
import test from 'node:test'
import { ALICE_SKILLS } from '../lib/constants.mjs'
import { buildAliceRequest, extractAliceResult, parseSsePayload } from '../lib/alice.mjs'

test('Alice request selects the Chinese skill prefix for Chinese prompts', () => {
  const request = buildAliceRequest('核验贵州茅台的营收数据', 'Fact Check')
  assert.equal(request.method, 'message/stream')
  assert.equal(request.params.message.parts[0].text, '使用「事实核验」技能：核验贵州茅台的营收数据')
})

test('Alice request selects the English skill prefix for English prompts', () => {
  const request = buildAliceRequest('Compare Apple with Microsoft.', '可比公司分析')
  assert.equal(request.params.message.parts[0].text, 'Using "Comps Analysis" skill:Compare Apple with Microsoft.')
})

test('Alice skill catalog contains unique bilingual names', () => {
  assert.equal(new Set(ALICE_SKILLS.map((skill) => skill.zh)).size, ALICE_SKILLS.length)
  assert.equal(new Set(ALICE_SKILLS.map((skill) => skill.en)).size, ALICE_SKILLS.length)
})

test('SSE parser extracts the latest agentResult artifact', () => {
  const first = {
    jsonrpc: '2.0',
    result: {
      kind: 'artifact-update',
      artifact: { name: 'agentResult', parts: [{ kind: 'data', data: { data: 'draft' } }] },
    },
  }
  const second = {
    jsonrpc: '2.0',
    result: {
      kind: 'artifact-update',
      artifact: { name: 'agentResult', parts: [{ kind: 'data', data: { data: 'final' } }] },
    },
  }
  const events = parseSsePayload(`event: message\ndata: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(second)}\n\n`)
  assert.equal(extractAliceResult(events), 'final')
})

test('Alice result errors are not mistaken for successful empty output', () => {
  assert.throws(() => extractAliceResult([{
    result: { isError: true, content: [{ type: 'text', text: '余额不足' }] },
  }]), /余额不足/)
})

