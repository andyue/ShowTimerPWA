import test from 'node:test'
import assert from 'node:assert/strict'
import { viewerUrl } from '../src/services/Broadcast'
const room = { id: 'test-room', hostToken: 'host-secret', viewerToken: 'viewer', url: 'wss://sync.example.test', viewerBaseUrl: 'https://andyue.github.io/ShowTimerPWA/' }
test('public viewer page keeps its independent sync service and excludes host credentials', () => {
  const url = new URL(viewerUrl(room))
  const params = new URLSearchParams(url.hash.slice(1))
  assert.equal(params.get('service'), 'wss://sync.example.test/')
  assert.equal(params.get('token'), 'viewer')
  assert.ok(!url.href.includes('host-secret'))
})
test('LAN viewer replaces the controller loopback URL with its shared LAN address', () => {
  const url = new URL(viewerUrl({ ...room, url: 'ws://127.0.0.1:18789', viewerBaseUrl: 'http://192.168.1.9:18789/' }))
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('service'), 'ws://192.168.1.9:18789/')
})
