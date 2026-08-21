import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('package declares an installable DSH bundle', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-mcp-client'].includes('0.1.0-rc.1'), true)
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.match(patch, /id: wind-aifin/)
  assert.match(patch, /@xiamu-ssr\/dsh-wind-aifin/)
})

