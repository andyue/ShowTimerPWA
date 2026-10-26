import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getRunElapsedSeconds, getPausedMs, pauseRun, resumeRun, closePauses, getDisplaySeconds, createSegmentResult } from '../src/services/TimerEngine.ts'
import type { TimerRunState } from '../src/stores/useShowTimerStore.tsx'
import { createShowProject } from '../src/models/ShowProject.ts'
import { createAct } from '../src/models/ShowSegment.ts'
import { exportProjectToCsv, importProjectFromCsv } from '../src/services/ExcelExporter.ts'
import { exportProjectToJson, validateShowProject } from '../src/services/JsonProjectService.ts'
import { isValidTimerRun } from '../src/services/RunValidation.ts'
import { makeSnapshot, projectSnapshot } from '../src/services/Broadcast.ts'

const run = (): TimerRunState => ({ status: 'running', currentSegmentIndex: 0, startedAtIso: new Date(1000).toISOString(), startedAtMs: 1000, nowMs: 1000, pauses: [] })
test('multiple pauses preserve milliseconds and exclude all pauses from performance time', () => {
  let state = pauseRun(run(), 2800)
  assert.equal(getRunElapsedSeconds(state, 9600), 1)
  assert.equal(getPausedMs(state, 9600), 6800)
  assert.equal(pauseRun(state, 9000), state)
  state = resumeRun(state, 9600)
  assert.equal(resumeRun(state, 10000), state)
  state = pauseRun(state, 10800)
  assert.equal(getRunElapsedSeconds(state, 15000), 3)
  state = resumeRun(state, 15100)
  assert.equal(getRunElapsedSeconds(state, 16100), 4)
  assert.equal(getPausedMs(state, 16100), 11100)
})
test('finishing while paused closes the open interval; restored pause keeps accumulating', () => {
  const state = pauseRun(run(), 11000)
  assert.equal(isValidTimerRun(JSON.parse(JSON.stringify(state)), 1), true)
  assert.equal(getRunElapsedSeconds(state, 61000), 10)
  assert.equal(getPausedMs(state, 61000), 50000)
  assert.equal(closePauses(state, 61000)[0].endedAtMs, 61000)
  assert.equal(state.pauses[0].endedAtMs, null)
  assert.equal(isValidTimerRun({ ...state, pauses: [] }, 1), false)
})
test('intermission countdown freezes and resumes using net elapsed time', () => {
  const segment = { ...createAct(), type: 'intermission' as const, plannedSeconds: 20 }
  const paused = pauseRun(run(), 6000)
  assert.equal(getDisplaySeconds(segment, getRunElapsedSeconds(paused, 16000)), 15)
  assert.equal(getDisplaySeconds(segment, getRunElapsedSeconds(resumeRun(paused, 16000), 18000)), 13)
})
test('CSV and JSON preserve pause notes, totals and legacy records', () => {
  const project = createShowProject('Test')
  const segment = createAct('Act 1'); project.segments.push(segment)
  const result = createSegmentResult(segment, 30, '2026-01-01T00:00:00Z', '2026-01-01T00:00:33Z')
  result.pausedSeconds = 3; result.totalSeconds = 33
  result.pauses = [{ id: 'p', startedAtMs: 1000, endedAtMs: 4000, note: '音響, "測試"\n第二行' }]
  project.results.push(result)
  const csv = importProjectFromCsv(exportProjectToCsv(project))
  assert.deepEqual(csv.results[0].pauses, result.pauses)
  assert.equal(csv.results[0].pausedSeconds, 3)
  assert.equal(csv.results[0].totalSeconds, 33)
  assert.deepEqual(validateShowProject(JSON.parse(exportProjectToJson(project))).results[0], result)
  const old = { ...project, version: 1, results: [{ ...result, pauses: undefined, pausedSeconds: undefined, totalSeconds: undefined }] }
  assert.equal(validateShowProject(old).results[0].elapsedSeconds, 30)
})
test('broadcast compensates for clocks and interpolates only the active clock', () => {
  const project = createShowProject(); project.segments.push(createAct('Act 1'))
  const snapshot = makeSnapshot(project, run(), 6000, 2000)
  assert.equal(projectSnapshot(snapshot, 10000).elapsedMs, 7000)
  const paused = makeSnapshot(project, pauseRun(run(), 6000), 9000, 2000)
  assert.deepEqual(projectSnapshot(paused, 13000), { elapsedMs: 5000, pausedMs: 5000, currentPauseMs: 5000 })
})

test('unencrypted LAN sockets are limited to the matching HTTP private-network origin', async () => {
  const { validateSocketUrl } = await import('../src/services/Broadcast.ts')
  assert.equal(validateSocketUrl('ws://192.168.1.10:8789', false, 'http://192.168.1.10:8789/'), 'ws://192.168.1.10:8789/')
  assert.throws(() => validateSocketUrl('ws://192.168.1.10:8789', false, 'https://andyue.github.io/ShowTimerPWA/'))
  assert.throws(() => validateSocketUrl('ws://192.168.1.10:8789', false, 'http://192.168.1.11:8789/'))
  assert.throws(() => validateSocketUrl('ws://192.168.1.10:8788', false, 'http://192.168.1.10:8789/'))
  assert.throws(() => validateSocketUrl('ws://8.8.8.8:8789', false, 'http://8.8.8.8:8789/'))
  assert.throws(() => validateSocketUrl('ws://192.168.1.10:8789', true, 'http://192.168.1.10:8789/'))
  assert.equal(validateSocketUrl('wss://sync.example.com'), 'wss://sync.example.com/')
})


test('broadcast always includes all Q Marks and notes in the same order as the controller', () => {
  const project = createShowProject(); project.segments.push(createAct('Act 1'))
  const base = { segmentId: 'act', segmentOrder: 0, segmentName: 'Act 1', segmentType: 'act' as const, note: 'Cue note', createdAt: new Date().toISOString() }
  project.cueMarks = [{ ...base, id: 'b', label: 'M2', elapsedSeconds: 20 }, { ...base, id: 'a', label: 'M1', elapsedSeconds: 10 }]
  const result = makeSnapshot(project, run(), 6000)
  assert.deepEqual(result.cueMarks?.map(m => m.id), ['a', 'b'])
  assert.equal(result.cueMarks?.[0].note, 'Cue note')
  assert.equal(project.cueMarks[0].id, 'b')
  project.cueMarks = []
  assert.deepEqual(makeSnapshot(project, run(), 6000).cueMarks, [])
})
