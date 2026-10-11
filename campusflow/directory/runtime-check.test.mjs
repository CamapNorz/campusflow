import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {Miniflare} from 'miniflare'

// Separate from unit tests: this starts workerd and makes one synthetic, unauthorized
// Google request. No real identity/token, service key, or private metadata is used.
test('Workers accepts actual member-check fetch options and reaches upstream authorization', async () => {
  const source = await readFile(new URL('./index.js', import.meta.url), 'utf8')
  const functions = source.slice(source.indexOf('const FOLDER'), source.indexOf('export async function serviceToken')).replaceAll('export async function', 'async function')
  const script = functions + `
    export default {async fetch() {
      try {
        await assertMember('synthetic-runtime-probe','synthetic-invalid-token', {FIREBASE_PROJECT:'campusflow-3edb8',GROUP_ID:'2LpXms9L1hDyM2AS37e6'})
        return Response.json({unexpected:true})
      } catch(error) { return Response.json({name:error.name,status:error.status,upstreamStatus:error.upstreamStatus}) }
    }}
  `
  // Date supported by the bundled workerd binary; deployed config uses newer date.
  const runtime = new Miniflare({modules:true,compatibilityDate:'2026-06-05',script})
  try {
    const response = await runtime.dispatchFetch('http://localhost/')
    const result = await response.json()
    assert.notEqual(result.name,'TypeError')
    assert.equal(result.status,403)
    assert.equal(result.upstreamStatus,401)
  } finally { await runtime.dispose() }
})
