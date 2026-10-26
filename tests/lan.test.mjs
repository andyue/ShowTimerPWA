import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { createLanServer, lanAddresses } from '../server/lan.mjs'

function message(ws) {
  return Promise.race([once(ws, 'message').then(([raw]) => JSON.parse(raw.toString())), new Promise((_, reject) => { const id = setTimeout(() => reject(new Error('Message timeout')), 2000); id.unref() })])
}

test('LAN discovery excludes loopback/public addresses and deduplicates interface addresses', () => {
  const ip = address => ({ family: 'IPv4', internal: false, address })
  assert.deepEqual(lanAddresses({ wifi: [ip('192.168.1.5')], vpn: [ip('10.0.0.2'), ip('192.168.1.5')], wan: [ip('8.8.8.8')], loopback: [{ ...ip('127.0.0.1'), internal: true }] }), [
    { name: 'wifi', address: '192.168.1.5' }, { name: 'vpn', address: '10.0.0.2' },
  ])
})

test('LAN server serves built assets, protects bootstrap key, and enforces host/origin and room permissions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'showtimer-lan-'))
  await mkdir(join(root, 'assets'))
  await writeFile(join(root, 'index.html'), '<html>LAN test</html>')
  await writeFile(join(root, 'assets/app.js'), 'console.log("LAN")')
  await writeFile(join(root, '.env'), 'PRIVATE=never-serve')
  const service = createLanServer({ port: 0, root, addresses: [{ name: 'Wi-Fi', address: '192.168.1.10' }] })
  await once(service.http, 'listening')
  const port = service.http.address().port
  const base = `http://127.0.0.1:${port}`
  try {
    const config = await (await fetch(base + '/lan-config.json')).json()
    assert.equal(config.serviceUrl, `ws://127.0.0.1:${port}`)
    assert.equal(config.viewerBases[0].url, `http://192.168.1.10:${port}/`)
    assert.match(await (await fetch(base)).text(), /LAN test/)
    assert.equal((await fetch(base + '/assets/app.js')).headers.get('content-type'), 'text/javascript')
    assert.equal((await fetch(base + '/.env')).status, 404)
    assert.equal((await fetch(base + '/lan-config.json', { headers: { Origin: 'http://attacker.example' } })).status, 403)
    // A private-IP URL cannot read the controller bootstrap, even from the host computer.
    const { request } = await import('node:http')
    const statusWithHost = host => new Promise(resolve => {
      const req = request(base + '/lan-config.json', { headers: { Host: host } }, res => { res.resume(); resolve(res.statusCode) }); req.end()
    })
    assert.equal(await statusWithHost(`192.168.1.10:${port}`), 403)
    assert.equal(await statusWithHost(`attacker.example:${port}`), 403)
    const blocked = new WebSocket(config.serviceUrl, { origin: 'http://attacker.example' })
    const rejected = await once(blocked, 'error'); assert.match(rejected[0].message, /401/)
    const host = new WebSocket(config.serviceUrl, { origin: base }); await once(host, 'open')
    let result = message(host); host.send(JSON.stringify({ type: 'create' })); assert.equal((await result).type, 'error')
    result = message(host); host.send(JSON.stringify({ type: 'create', key: config.key })); const room = await result
    const viewer = new WebSocket(config.serviceUrl, { origin: `http://192.168.1.10:${port}` }); await once(viewer, 'open')
    result = message(viewer); viewer.send(JSON.stringify({ type: 'join', id: room.id, token: room.viewerToken })); assert.equal((await result).role, 'viewer')
    result = message(viewer); viewer.send(JSON.stringify({ type: 'publish', snapshot: {} })); assert.equal((await result).type, 'error')
  } finally { await service.close(); await rm(root, { recursive: true, force: true }) }
})
