import test from 'node:test'
import assert from 'node:assert/strict'
import { PROJECT_FOLDER_ID, FOLDER_MIME, listDriveFiles, getDriveFolder, driveLink, filterDriveFiles, sameNamePreviews, driveErrorMessage } from './drive.js'

test('Drive requests stay inside selected parent, exclude trash and request metadata only with explicit pagination', async () => {
  const controller = new AbortController()
  let calls = 0
  const result = await listDriveFiles('temporary-token', PROJECT_FOLDER_ID, { pageToken: 'opaque+/page', signal: controller.signal, fetcher: async (url, options) => {
    calls++
    const params = new URL(url).searchParams
    assert.equal(params.get('q'), `'${PROJECT_FOLDER_ID}' in parents and trashed = false`)
    assert.equal(params.get('pageToken'), 'opaque+/page')
    assert.equal(params.get('supportsAllDrives'), 'true')
    assert.equal(params.get('fields').includes('owners'), false)
    assert.equal(params.get('fields').includes('content'), false)
    assert.equal(options.headers.Authorization, 'Bearer temporary-token')
    assert.equal(options.signal, controller.signal)
    assert.equal(options.cache, 'no-store')
    return { ok: true, json: async () => ({ files: [], nextPageToken: 'next', incompleteSearch: true }) }
  } })
  assert.equal(calls, 1)
  assert.equal(result.nextPageToken, 'next')
  assert.equal(result.incompleteSearch, true)
  await assert.rejects(listDriveFiles('token', "id' in parents or true", { fetcher: () => assert.fail('Invalid ID must not send a request') }), /Invalid folder/)
})

test('Drive metadata errors distinguish inaccessible folders, expiration and disabled APIs without exposing raw server text', async () => {
  for (const status of [401, 404]) {
    await assert.rejects(getDriveFolder('token', PROJECT_FOLDER_ID, { fetcher: async () => ({ ok: false, status, json: async () => ({ error: { message: 'private backend details' } }) }) }), error => {
      assert.equal(error.status, status)
      assert.equal(error.message.includes('private'), false)
      assert.match(driveErrorMessage(error), status === 401 ? /過期/ : /權限/)
      return true
    })
  }
  assert.match(driveErrorMessage({ status: 403, reason: 'SERVICE_DISABLED' }), /API/)
  assert.match(driveErrorMessage({ status: 403, reason: 'userRateLimitExceeded' }), /稍後/)
  await assert.rejects(getDriveFolder('token', PROJECT_FOLDER_ID, { fetcher: async () => ({ ok: true, json: async () => ({ mimeType: 'image/png' }) }) }), /Not a folder/)
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
