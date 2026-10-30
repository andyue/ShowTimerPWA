import { test } from 'node:test'
import assert from 'node:assert/strict'
import { insertCueMark, moveCueMark, sortCueMarks } from '../src/services/CueMarkOrder'
import type { CueMark } from '../src/models/CueMark'
const mark = (id: string, elapsedSeconds: number, segmentOrder = 0): CueMark => ({
  id, label: id, elapsedSeconds, segmentOrder, segmentId: String(segmentOrder),
  segmentName: 'Act', segmentType: 'act', note: id, createdAt: '2026-01-01T00:00:00Z',
})
test('rerun inserts between existing cues and before later segments', () => {
  const marks = insertCueMark([mark('late', 30), mark('next act', 0, 1), mark('early', 5)], mark('new', 10))
  assert.deepEqual(marks.map(m => m.id), ['early', 'new', 'late', 'next act'])
})
test('manual moves persist and insertion preserves the relative order of existing rows', () => {
  const moved = moveCueMark([mark('a', 5), mark('b', 10), mark('c', 30)], 'b', 'up')
  const restored = sortCueMarks(JSON.parse(JSON.stringify(moved)))
  assert.deepEqual(restored.map(m => m.id), ['b', 'a', 'c'])
  assert.equal(restored[0].elapsedSeconds, 10)
  assert.deepEqual(insertCueMark(restored, mark('new', 20)).map(m => m.id), ['b', 'a', 'new', 'c'])
  assert.deepEqual(moveCueMark(restored, 'b', 'up'), restored)
  assert.deepEqual(moveCueMark(restored, 'missing', 'down'), restored)
  assert.deepEqual(moveCueMark(restored, 'b', 'down').map(m => m.id), ['a', 'b', 'c'])
})

import { createShowProject } from '../src/models/ShowProject'
import { exportProjectToCsv, importProjectFromCsv } from '../src/services/ExcelExporter'
import { validateShowProject } from '../src/services/JsonProjectService'
import { makeSnapshot } from '../src/services/Broadcast'
test('manual order survives JSON, CSV and viewer snapshots', () => {
  const project = createShowProject('Order')
  project.segments = [{ id: '0', order: 0, name: 'Act', type: 'act', plannedSeconds: 60 }]
  project.cueMarks = moveCueMark([mark('a', 5), mark('b', 10)], 'b', 'up')
  for (const restored of [validateShowProject(JSON.parse(JSON.stringify(project))), importProjectFromCsv(exportProjectToCsv(project))]) {
    assert.deepEqual(sortCueMarks(restored.cueMarks).map(m => m.note), ['b', 'a'])
  }
  const snapshot = makeSnapshot(project, { status: 'idle', currentSegmentIndex: -1, startedAtIso: '', startedAtMs: 0, nowMs: 0, pauses: [] }, 0)
  assert.deepEqual(snapshot.cueMarks?.map(m => m.note), ['b', 'a'])
})
