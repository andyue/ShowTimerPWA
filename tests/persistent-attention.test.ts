import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toggleAttention } from '../src/services/PersistentAttention'
import { moveCueMark } from '../src/services/CueMarkOrder'
import type { CueMark } from '../src/models/CueMark'
test('screen and cue reminders stop, switch, and can restart during green', () => {
 const screen = toggleAttention(null, 'screen', undefined, '', 100)
 assert.equal(screen.phase, 'active')
 const cue = toggleAttention(screen, 'cue', 'cue-1', 'Lights GO', 200)
 assert.equal(cue.note, 'Lights GO')
 const other = toggleAttention(cue, 'cue', 'cue-2', 'Sound GO', 300)
 assert.equal(other.phase, 'active')
 const done = toggleAttention(other, 'cue', 'cue-2', '', 400)
 assert.equal(done.until, 4400)
 assert.equal(done.note, 'Sound GO')
 assert.equal(toggleAttention(cue, 'screen', undefined, '', 500).phase, 'complete')
 assert.equal(toggleAttention(done, 'screen', undefined, '', 600).phase, 'active')
})
test('drag inserts at target and preserves notes and intermediate order', () => {
 const marks = ['a','b','c','d'].map((id, displayOrder) => ({ id, note: id, displayOrder })) as CueMark[]
 assert.deepEqual(moveCueMark(marks, 'a', 'd').map(m => m.note), ['b','c','d','a'])
 assert.deepEqual(moveCueMark(marks, 'd', 'a').map(m => m.note), ['d','a','b','c'])
 assert.equal(moveCueMark(marks, 'a', 'missing'), marks)
})
