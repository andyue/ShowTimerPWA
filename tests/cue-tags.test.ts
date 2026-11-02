import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createShowProject } from '../src/models/ShowProject.ts'
import { createAct } from '../src/models/ShowSegment.ts'
import { validateShowProject, exportProjectToJson } from '../src/services/JsonProjectService.ts'
import { exportProjectToCsv, importProjectFromCsv } from '../src/services/ExcelExporter.ts'
import { makeSnapshot } from '../src/services/Broadcast.ts'
import { matchesTags, parseCueTags, parseTagIds } from '../src/services/CueTags.ts'

test('multi-tags survive JSON, CSV and broadcast, with legacy support', () => {
  const project = createShowProject('Tagged show')
  const segment = createAct('Act 1'); project.segments.push(segment)
  project.cueTags = [{ id: 'light', name: '燈光', color: '#f87171' }, { id: 'sound', name: '音響', color: '#60a5fa' }]
  project.cueMarks.push({ id: 'cue', label: 'M1', segmentId: segment.id, segmentOrder: 0, segmentName: segment.name, segmentType: 'act', elapsedSeconds: 1, note: 'GO', createdAt: new Date().toISOString(), tagIds: ['light', 'sound'] })
  for (const restored of [validateShowProject(JSON.parse(exportProjectToJson(project))), importProjectFromCsv(exportProjectToCsv(project))]) {
    assert.deepEqual(restored.cueTags, project.cueTags)
    assert.deepEqual(restored.cueMarks[0].tagIds, ['light', 'sound'])
  }
  const snapshot = makeSnapshot(project, { status: 'idle', currentSegmentIndex: 0, startedAtIso: '', startedAtMs: 0, nowMs: 0, pauses: [] }, 0)
  assert.deepEqual(snapshot.cueTags, project.cueTags)
  assert.deepEqual(snapshot.cueMarks?.[0].tagIds, ['light', 'sound'])
  assert.equal(matchesTags(project.cueMarks[0], ['sound'], project.cueTags), true)
  assert.equal(matchesTags(project.cueMarks[0], ['untagged'], project.cueTags), false)
  assert.equal(matchesTags({ ...project.cueMarks[0], tagIds: [] }, ['untagged'], project.cueTags), true)
  delete project.cueTags; delete project.cueMarks[0].tagIds
  assert.deepEqual(validateShowProject(project).cueTags, [])
})
test('invalid imported tag definitions and assignments are rejected', () => {
  assert.throws(() => parseCueTags([{ id: 'x', name: 'bad', color: 'url(evil)' }]))
  assert.throws(() => parseTagIds([{}]))
  assert.throws(() => parseCueTags([{ id: 'x', name: '', color: '#ffffff' }]))
})
