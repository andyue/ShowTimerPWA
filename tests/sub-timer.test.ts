import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toggleSubTimer, resetSubTimer, parseSubTimer } from '../src/services/SubTimer'
import { createShowProject } from '../src/models/ShowProject'
import { exportProjectToCsv, importProjectFromCsv } from '../src/services/ExcelExporter'
import { validateShowProject } from '../src/services/JsonProjectService'

test('sub timer creates separate intervals and reset preserves a running record', () => {
  let state = toggleSubTimer(undefined, 1000, 'Act 1')
  state = toggleSubTimer(state, 2500, 'Act 2')
  assert.equal(state.records[0].endedAtMs, 2500)
  assert.equal(state.records[0].segmentName, 'Act 1')
  state = toggleSubTimer(state, 4000, 'Act 2')
  state = resetSubTimer(state, 6000)
  assert.equal(state.reset, true)
  assert.equal(state.records.length, 2)
  assert.equal(state.records[1].endedAtMs, 6000)
  assert.deepEqual(resetSubTimer(state, 7000).records, state.records)
})
test('sub timer intervals and notes roundtrip in JSON and CSV, legacy files remain valid', () => {
  const project = createShowProject()
  project.segments = [{ id: 'act', order: 0, name: 'Act 1', type: 'act', plannedSeconds: 0 }]
  assert.equal(validateShowProject(project).subTimer, undefined)
  project.subTimer = toggleSubTimer(toggleSubTimer(undefined, 1000, 'Act 1'), 2500, '')
  project.subTimer.records[0].note = '換景,"完成"\n燈光'
  project.subTimer = toggleSubTimer(project.subTimer, 4000, 'Act 1')
  assert.deepEqual(validateShowProject(JSON.parse(JSON.stringify(project))).subTimer, project.subTimer)
  assert.deepEqual(importProjectFromCsv(exportProjectToCsv(project)).subTimer, project.subTimer)
  assert.throws(() => parseSubTimer({ records: [{ id: 'bad' }], reset: false }))
})
