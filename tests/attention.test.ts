import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAttention, rememberAttention } from '../src/services/Attention'
test('reminders reject stale or malformed events and bound duplicate history', () => {
 const event = { id: 'one', target: 'screen', sentAtMs: 1000, expiresAtMs: 3500 }
 assert.ok(parseAttention(event, 1200))
 assert.equal(parseAttention(event, 3501), null)
 assert.equal(parseAttention({...event, target:'cue'}, 1200), null)
 assert.equal(parseAttention({...event, expiresAtMs: 10000}, 1200), null)
 const ids = new Set<string>()
 assert.equal(rememberAttention(ids,'one'),true)
 assert.equal(rememberAttention(ids,'one'),false)
 for(let i=0;i<300;i++) rememberAttention(ids,String(i))
 assert.equal(ids.size,256)
})
