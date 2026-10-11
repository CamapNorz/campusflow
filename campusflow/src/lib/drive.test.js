import test from 'node:test'
import assert from 'node:assert/strict'
import { PROJECT_FOLDER_ID, FOLDER_MIME, readProjectDirectory, driveLink, filterDriveFiles, sameNamePreviews, driveErrorMessage } from './drive.js'

test('Directory client sends Firebase bearer token, selected folder and explicit pagination only to the configured backend', async () => {
  const controller = new AbortController()
  let calls = 0
  const result = await readProjectDirectory('temporary-token', PROJECT_FOLDER_ID, { endpoint:'https://directory.example', pageToken: 'opaque+/page', signal: controller.signal, fetcher: async (url, options) => {
    calls++
    const params = new URL(url).searchParams
    assert.equal(new URL(url).origin, 'https://directory.example')
    assert.equal(params.get('folderId'), PROJECT_FOLDER_ID)
    assert.equal(params.get('pageToken'), 'opaque+/page')
    assert.equal(params.has('q'), false)
    assert.equal(options.headers.Authorization, 'Bearer temporary-token')
    assert.equal(options.signal, controller.signal)
    assert.equal(options.cache, 'no-store')
    return { ok: true, json: async () => ({ files: [], nextPageToken: 'next', incompleteSearch: true }) }
  } })
  assert.equal(calls, 1)
  assert.equal(result.nextPageToken, 'next')
  assert.equal(result.incompleteSearch, true)
  await assert.rejects(readProjectDirectory('token', "id' in parents or true", { fetcher: () => assert.fail('Invalid ID must not send a request') }), /Invalid folder/)
})

test('Drive metadata errors distinguish inaccessible folders, expiration and disabled APIs without exposing raw server text', async () => {
  for (const status of [401, 404]) {
    await assert.rejects(readProjectDirectory('token', PROJECT_FOLDER_ID, { endpoint:'https://directory.example', fetcher: async () => ({ ok: false, status, json: async () => ({ error: { message: 'private backend details' } }) }) }), error => {
      assert.equal(error.status, status)
      assert.equal(error.message.includes('private'), false)
      assert.match(driveErrorMessage(error), status === 401 ? /過期/ : /專題空間/)
      return true
    })
  }
  assert.match(driveErrorMessage({ status: 403, reason: 'SERVICE_DISABLED' }), /API/)
  assert.match(driveErrorMessage({ status: 403, reason: 'userRateLimitExceeded' }), /稍後/)
  await assert.rejects(readProjectDirectory('token', PROJECT_FOLDER_ID), /endpoint unavailable/)
})

test('Drive links reject injected schemes and offsite URLs while keeping native Google Docs links', () => {
  const file = { id: 'valid-file-id-1234', webViewLink: 'javascript:alert(1)' }
  assert.equal(driveLink(file), 'https://drive.google.com/file/d/valid-file-id-1234/view')
  assert.equal(driveLink({ ...file, webViewLink: 'https://drive.google.com.evil.example/file' }), driveLink(file))
  assert.equal(driveLink({ ...file, webViewLink: 'https://docs.google.com/document/d/example/edit' }), 'https://docs.google.com/document/d/example/edit')
  assert.equal(driveLink({ id: "'bad" }), null)
})

test('Same-name previews match exact stems and common image extensions, never older versions or a partial name', () => {
  const model = { name: 'Desk_v003.blend' }
  const files = ['Desk_v003.PNG', 'desk_v003.jpg', 'Desk_v002.png', 'Desk_v003_side.png', 'Desk_v003.webp'].map(name => ({ name, mimeType: 'image/png' }))
  assert.deepEqual(sameNamePreviews(model, files).map(file => file.name), ['Desk_v003.PNG', 'desk_v003.jpg'])
})

test('Directory filter and natural sort preserve folder-first ordering without mutating loaded files', () => {
  const files = [{ name: 'desk_v010.blend' }, { name: 'desk_v002.blend' }, { name: 'Props', mimeType: FOLDER_MIME }]
  assert.deepEqual(filterDriveFiles(files, '', 'all', 'name').map(file => file.name), ['Props', 'desk_v002.blend', 'desk_v010.blend'])
  assert.deepEqual(filterDriveFiles(files, ' DESK ', 'blender', 'name').map(file => file.name), ['desk_v002.blend', 'desk_v010.blend'])
  assert.equal(files[0].name, 'desk_v010.blend')
})
