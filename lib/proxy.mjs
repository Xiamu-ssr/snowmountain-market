import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024
const REQUEST_HEADERS = [
  'accept',
  'content-type',
  'last-event-id',
  'mcp-protocol-version',
  'mcp-session-id',
]
const RESPONSE_HEADERS = [
  'cache-control',
  'content-type',
  'mcp-session-id',
  'retry-after',
]

function jsonRpcError(code, message) {
  return JSON.stringify({
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  })
}

function writeError(response, status, code, message) {
  if (response.headersSent) {
    response.destroy()
    return
  }
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(jsonRpcError(code, message))
}

async function readRequestBody(request, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) {
      const error = new Error(`request body exceeds ${maxBytes} bytes`)
      error.code = 'BODY_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  return chunks.length === 0 ? undefined : Buffer.concat(chunks)
}

function upstreamHeaders(request, apiKey) {
  const headers = new Headers()
  for (const name of REQUEST_HEADERS) {
    const value = request.headers[name]
    if (typeof value === 'string') headers.set(name, value)
  }
  headers.set('authorization', `Bearer ${apiKey}`)
  headers.set('user-agent', 'dsh-wind-aifin/0.1.0')
  return headers
}

function copyResponseHeaders(upstream, response) {
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value !== null) response.setHeader(name, value)
  }
}

async function forward({ request, response, endpoint, resolveApiKey, fetchImpl, maxRequestBytes }) {
  let apiKey
  try {
    apiKey = await resolveApiKey()
  } catch {
    writeError(response, 401, -32001, 'Wind credential is not configured')
    return
  }
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    writeError(response, 401, -32001, 'Wind credential is not configured')
    return
  }

  let body
  try {
    body = await readRequestBody(request, maxRequestBytes)
  } catch (error) {
    const tooLarge = error?.code === 'BODY_TOO_LARGE'
    writeError(response, tooLarge ? 413 : 400, -32600, tooLarge ? 'MCP request is too large' : 'Invalid MCP request')
    return
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  request.once('aborted', abort)
  response.once('close', abort)

  try {
    const upstream = await fetchImpl(endpoint, {
      method: request.method,
      headers: upstreamHeaders(request, apiKey),
      body,
      redirect: 'error',
      signal: controller.signal,
    })
    response.statusCode = upstream.status
    copyResponseHeaders(upstream, response)
    if (upstream.body === null) {
      response.end()
      return
    }
    await pipeline(Readable.fromWeb(upstream.body), response)
  } catch (error) {
    if (!controller.signal.aborted) writeError(response, 502, -32002, 'Wind MCP upstream is unavailable')
  } finally {
    request.off('aborted', abort)
    response.off('close', abort)
  }
}

export async function createWindMcpProxy({
  domains,
  resolveApiKey,
  fetchImpl = fetch,
  maxRequestBytes = DEFAULT_MAX_REQUEST_BYTES,
}) {
  const token = randomBytes(24).toString('base64url')
  const routes = new Map(domains.map((domain) => [`/${token}/${domain.id}`, domain.endpoint]))

  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname.replace(/\/$/, '')
    const endpoint = routes.get(pathname)
    if (endpoint === undefined) {
      writeError(response, 404, -32601, 'Unknown Wind MCP route')
      return
    }
    void forward({ request, response, endpoint, resolveApiKey, fetchImpl, maxRequestBytes })
  })
  server.maxConnections = Math.max(16, domains.length * 4)

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(0, '127.0.0.1')
  })

  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Wind MCP proxy did not bind a TCP port')

  return {
    urlFor(domainId) {
      if (!domains.some((domain) => domain.id === domainId)) throw new Error(`Unknown Wind domain: ${domainId}`)
      return `http://127.0.0.1:${address.port}/${token}/${domainId}`
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => error === undefined ? resolve() : reject(error))
        server.closeAllConnections?.()
      })
    },
  }
}

