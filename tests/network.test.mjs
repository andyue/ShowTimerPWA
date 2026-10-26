import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createSocket } from 'node:dgram'
import { WebSocket } from 'ws'
import { createSyncServer, validSnapshot } from '../server/sync.mjs'
import { createOscBridge, decodeOsc, allowedOscPeer } from '../server/osc.mjs'
const origin = 'http://localhost:5173'
const send = (ws, value) => ws.send(JSON.stringify(value))
function next(ws, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { ws.off('message', listener); reject(new Error('Timed out: ' + type)) }, 3000)
    const listener = raw => { const value = JSON.parse(raw); if (value.type === type && predicate(value)) { clearTimeout(timeout); ws.off('message', listener); resolve(value) } }
    ws.on('message', listener)
  })
}
async function connect(port) { const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin }); await once(ws, 'open'); return ws }
const snapshot = { projectName: 'Test', segment: { name: 'Act', type: 'act', plannedSeconds: 30 }, nextSegmentName: '', status: 'running', elapsedMs: 5000, pausedMs: 0, currentPauseMs: 0, capturedAtMs: Date.now() }

test('room auth, late join, read-only viewers, host disconnect/reconnect and end', async () => {
  const service = createSyncServer({ port: 0, createKey: 'secret' }); await once(service.http, 'listening')
  try {
    const port = service.http.address().port
    const host = await connect(port)
    let message = next(host, 'error'); send(host, { type: 'create', key: 'wrong' }); await message
    message = next(host, 'created'); send(host, { type: 'create', key: 'secret' }); const room = await message
    message = next(host, 'published'); send(host, { type: 'publish', snapshot }); await message
    const viewer = await connect(port)
    message = next(viewer, 'snapshot'); send(viewer, { type: 'join', id: room.id, token: room.viewerToken }); assert.equal((await message).snapshot.elapsedMs, 5000)
    message = next(viewer, 'error'); send(viewer, { type: 'publish', snapshot: { ...snapshot, elapsedMs: 0 } }); await message
    const stranger = await connect(port)
    message = next(stranger, 'error'); send(stranger, { type: 'join', id: room.id, token: 'fake' }); await message
    const secondHost = await connect(port)
    message = next(secondHost, 'error'); send(secondHost, { type: 'join', id: room.id, token: room.hostToken }); await message
    message = next(viewer, 'snapshot'); host.close(); assert.equal((await message).hostOnline, false)
    message = next(secondHost, 'joined'); send(secondHost, { type: 'join', id: room.id, token: room.hostToken }); await message
    message = next(viewer, 'snapshot', value => value.snapshot?.status === 'paused'); send(secondHost, { type: 'publish', snapshot: { ...snapshot, status: 'paused' } }); assert.equal((await message).snapshot.status, 'paused')
    message = next(viewer, 'ended'); send(secondHost, { type: 'end' }); await message
    stranger.close()
  } finally { await service.close() }
})
function oscString(value) { const buffer = Buffer.alloc(Math.ceil((Buffer.byteLength(value) + 1) / 4) * 4); buffer.write(value); return buffer }
function osc(command, value) {
  return Buffer.concat([oscString('/showtimer/' + command), oscString(value === undefined ? ',' : ',i'), ...(value === undefined ? [] : [Buffer.from([0, 0, 0, value])])])
}
test('OSC parser handles triggers and immediate bundles, rejects release/malformed/scheduled packets', () => {
  assert.deepEqual(decodeOsc(osc('pause')), ['pause'])
  assert.deepEqual(decodeOsc(osc('resume', 1)), ['resume'])
  assert.deepEqual(decodeOsc(osc('next', 0)), [])
  assert.deepEqual(decodeOsc(osc('destroy')), [])
  assert.deepEqual(decodeOsc(Buffer.from('/bad')), [])
  const message = osc('pause'); const length = Buffer.alloc(4); length.writeInt32BE(message.length)
  const bundle = Buffer.concat([oscString('#bundle'), Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), length, message])
  assert.deepEqual(decodeOsc(bundle), ['pause'])
  bundle.writeUInt32BE(100, 8); assert.deepEqual(decodeOsc(bundle), [])
})
test('real UDP OSC bridge requires pairing and deduplicates rapid repeated triggers', async () => {
  const bridge = createOscBridge({ wsPort: 0, udpPort: 0, pairingToken: 'test' })
  await Promise.all([once(bridge.http, 'listening'), once(bridge.udp, 'listening')])
  const udp = createSocket('udp4')
  try {
    const wrong = await connect(bridge.http.address().port)
    const closed = once(wrong, 'close'); send(wrong, { type: 'pair', token: 'wrong' }); assert.equal((await closed)[0], 1008)
    const host = await connect(bridge.http.address().port)
    let message = next(host, 'paired'); send(host, { type: 'pair', token: 'test' }); await message
    const received = []; host.on('message', raw => { const value = JSON.parse(raw); if (value.type === 'command') received.push(value) })
    message = next(host, 'command')
    udp.send(osc('pause'), bridge.udp.address().port, '127.0.0.1')
    udp.send(osc('pause'), bridge.udp.address().port, '127.0.0.1')
    assert.equal((await message).command, 'pause')
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(received.length, 1)
    host.close()
  } finally { udp.close(); await bridge.close() }
})

test('persistent room survives a service restart and keeps credentials and last snapshot', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = await mkdtemp(join(tmpdir(), 'showtimer-sync-'))
  const dataFile = join(directory, 'rooms.json')
  let service = createSyncServer({ port: 0, dataFile }); await once(service.http, 'listening')
  try {
    const host = await connect(service.http.address().port)
    let message = next(host, 'created'); send(host, { type: 'create' }); const room = await message
    message = next(host, 'published'); send(host, { type: 'publish', snapshot }); await message
    message = next(host, 'error'); send(host, { type: 'publish', snapshot: { ...snapshot, elapsedMs: -1 } }); await message
    await service.close()
    service = createSyncServer({ port: 0, dataFile }); await once(service.http, 'listening')
    const viewer = await connect(service.http.address().port)
    message = next(viewer, 'snapshot'); send(viewer, { type: 'join', id: room.id, token: room.viewerToken })
    const restored = await message
    assert.equal(restored.hostOnline, false); assert.equal(restored.snapshot.elapsedMs, 5000)
    const reconnected = await connect(service.http.address().port)
    message = next(reconnected, 'joined'); send(reconnected, { type: 'join', id: room.id, token: room.hostToken }); await message
  } finally { await service.close(); await rm(directory, { recursive: true, force: true }) }
})


test('Q Mark snapshots validate fields and support shows larger than the old 16 KB limit', async () => {
  const cueMarks = Array.from({ length: 100 }, (_, index) => ({ id: `m${index}`, label: `M${index + 1}`, segmentId: 'act', segmentOrder: 0, segmentName: 'Act 1', segmentType: 'act', elapsedSeconds: index, note: '音樂與燈光提示'.repeat(30), createdAt: new Date().toISOString() }))
  const state = { ...snapshot, cueMarks }
  assert.equal(validSnapshot(state), true)
  assert.equal(validSnapshot({ ...snapshot, cueMarks: [{ ...cueMarks[0], note: {} }] }), false)
  assert.equal(validSnapshot({ ...snapshot, cueMarks: [cueMarks[0], cueMarks[0]] }), false)
  assert.ok(Buffer.byteLength(JSON.stringify(state)) > 16384)
  const service = createSyncServer({ port: 0 }); await once(service.http, 'listening')
  try {
    const host = await connect(service.http.address().port)
    let message = next(host, 'created'); send(host, { type: 'create' }); const room = await message
    message = next(host, 'published'); send(host, { type: 'publish', snapshot: state }); await message
    const viewer = await connect(service.http.address().port)
    message = next(viewer, 'snapshot'); send(viewer, { type: 'join', id: room.id, token: room.viewerToken })
    assert.deepEqual((await message).snapshot.cueMarks, cueMarks)
    message = next(viewer, 'snapshot'); send(host, { type: 'publish', snapshot: { ...snapshot, cueMarks: [] } })
    assert.deepEqual((await message).snapshot.cueMarks, [])
  } finally { await service.close() }
})


test('OSC LAN mode accepts private-network controllers and ignores released TouchOSC buttons', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.2', '172.16.0.2', '192.168.1.2']) assert.equal(allowedOscPeer(ip), true)
  for (const ip of ['8.8.8.8', '172.32.0.2', '0.0.0.0']) assert.equal(allowedOscPeer(ip), false)
  const bridge = createOscBridge({ wsPort: 0, udpPort: 0, udpHost: '0.0.0.0', pairingToken: 'touch-test' })
  await Promise.all([once(bridge.http, 'listening'), once(bridge.udp, 'listening')])
  const udp = createSocket('udp4')
  try {
    assert.equal(bridge.udp.address().address, '0.0.0.0')
    assert.equal(bridge.http.address().address, '127.0.0.1')
    const host = await connect(bridge.http.address().port)
    let message = next(host, 'paired'); send(host, { type: 'pair', token: 'touch-test' }); await message
    const { lanAddresses } = await import('../server/lan.mjs')
    const destination = lanAddresses()[0]?.address || '127.0.0.1'
    const received = []; host.on('message', raw => { const value = JSON.parse(raw); if (value.type === 'command') received.push(value.command) })
    for (const command of ['start', 'pause', 'resume', 'next', 'mark']) {
      const press = Buffer.alloc(4); press.writeFloatBE(1)
      const packet = Buffer.concat([oscString('/showtimer/' + command), oscString(',f'), press])
      message = next(host, 'command')
      udp.send(packet, bridge.udp.address().port, destination)
      assert.equal((await message).command, command)
      udp.send(osc(command, 0), bridge.udp.address().port, destination)
    }
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.deepEqual(received, ['start', 'pause', 'resume', 'next', 'mark'])
    host.close()
  } finally { udp.close(); await bridge.close() }
})
