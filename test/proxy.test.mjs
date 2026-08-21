import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createWindMcpProxy } from '../lib/proxy.mjs'

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  return `http://127.0.0.1:${address.port}/mcp/`
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve))
}

test('loopback proxy injects the credential and preserves MCP responses', async (t) => {
  const seen = {}
  const upstream = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    seen.authorization = request.headers.authorization
    seen.body = Buffer.concat(chunks).toString('utf8')
    response.statusCode = 200
    response.setHeader('content-type', 'application/json')
    response.setHeader('mcp-session-id', 'wind-session')
    response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }))
  })
  const endpoint = await listen(upstream)
  t.after(() => close(upstream))

  const proxy = await createWindMcpProxy({
    domains: [{ id: 'test', endpoint }],
    resolveApiKey: async () => 'test-secret',
  })
  t.after(() => proxy.close())

  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
  const response = await fetch(proxy.urlFor('test'), {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body,
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('mcp-session-id'), 'wind-session')
  assert.deepEqual(await response.json(), { jsonrpc: '2.0', id: 1, result: { tools: [] } })
  assert.equal(seen.authorization, 'Bearer test-secret')
  assert.equal(seen.body, body)
})

test('loopback proxy returns a bounded error without exposing credential details', async (t) => {
  const proxy = await createWindMcpProxy({
    domains: [{ id: 'test', endpoint: 'https://example.invalid/mcp' }],
    resolveApiKey: async () => { throw new Error('secret-value') },
  })
  t.after(() => proxy.close())

  const response = await fetch(proxy.urlFor('test'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  const text = await response.text()
  assert.equal(response.status, 401)
  assert.doesNotMatch(text, /secret-value/)
  assert.match(text, /credential is not configured/)
})

