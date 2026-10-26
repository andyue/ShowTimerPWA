import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { installLatest, assertPortFree, run } from '../scripts/update-lan.mjs'

const revision = 'a'.repeat(40)
test('updater blocks when a broadcast port is occupied', async () => {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  try { await assert.rejects(assertPortFree(port), /Stop the LAN server/) }
  finally { await new Promise(resolve => server.close(resolve)) }
  await assertPortFree(port)
})

test('updater extracts a pinned release, preserves old installs, and keeps failed updates inactive', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'showtimer-updater-test-'))
  const root = path.join(temporary, '使用者 space', 'ShowTimer')
  try {
    const fixture = path.join(temporary, 'fixture')
    const release = path.join(fixture, 'release')
    await mkdir(release, { recursive: true })
    await writeFile(path.join(release, 'package.json'), JSON.stringify({ name: 'showtimerpwa', version: '1.0.0', scripts: { 'build:lan': 'node build.mjs' } }))
    await writeFile(path.join(release, 'package-lock.json'), JSON.stringify({ name: 'showtimerpwa', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'showtimerpwa', version: '1.0.0' } } }))
    await writeFile(path.join(release, 'build.mjs'), "import { writeFileSync } from 'node:fs'; writeFileSync('build-complete.txt', 'ready')")
    const archive = path.join(temporary, 'fixture.tar.gz')
    await run('tar', ['-czf', archive, '-C', fixture, 'release'], temporary)
    const archiveBytes = await readFile(archive)
    const urls = []
    const fetchImpl = async url => {
      urls.push(url)
      return url.includes('/actions/')
        ? Response.json({ workflow_runs: [{ head_sha: revision }] })
        : new Response(archiveBytes)
    }
    await mkdir(root, { recursive: true })
    const previous = path.join(root, 'old-version')
    await mkdir(previous)
    await writeFile(path.join(previous, 'keep.txt'), 'old showtimer')
    const calls = []
    const execute = async (command, args, cwd) => {
      calls.push([command, args, cwd])
      await run(command, args, cwd)
    }
    const installed = await installLatest({ root, fetchImpl, execute })
    assert.equal(await readFile(path.join(root, 'latest-installed.txt'), 'utf8'), installed + '\n')
    assert.equal(await readFile(path.join(previous, 'keep.txt'), 'utf8'), 'old showtimer')
    assert.equal(await readFile(path.join(installed, 'build-complete.txt'), 'utf8'), 'ready')
    assert.ok(urls[0].includes('status=success'))
    assert.ok(urls[1].endsWith('/' + revision))
    assert.deepEqual(calls.filter(([cmd]) => cmd === 'npm').map(([, args]) => args), [['ci'], ['run', 'build:lan']])
    for (const failingStage of ['ci', 'build:lan']) {
      await assert.rejects(installLatest({ root, fetchImpl, execute: async (command, args, cwd) => {
        if (command === 'npm' && args.includes(failingStage)) throw new Error('simulated failure')
        await execute(command, args, cwd)
      } }), /simulated failure/)
      assert.equal(await readFile(path.join(root, 'latest-installed.txt'), 'utf8'), installed + '\n')
    }
    await assert.rejects(installLatest({ root, fetchImpl: async () => new Response('', { status: 503 }) }), /HTTP 503/)
    await assert.rejects(installLatest({ root, fetchImpl: async () => Response.json({ workflow_runs: [{ head_sha: '../bad' }] }) }), /No verified release/)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
