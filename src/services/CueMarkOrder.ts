import type { CueMark } from '../models/CueMark'

export function compareCueTime(a: CueMark, b: CueMark) {
  return a.segmentOrder - b.segmentOrder ||
    a.elapsedSeconds - b.elapsedSeconds ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

export function sortCueMarks(marks: CueMark[]): CueMark[] {
  if (marks.every(mark => Number.isFinite(mark.displayOrder))) {
    return [...marks].sort((a, b) => a.displayOrder! - b.displayOrder! || compareCueTime(a, b))
  }
  return [...marks].sort(compareCueTime)
}

function numberRows(marks: CueMark[]): CueMark[] {
  return marks.map((mark, displayOrder) => ({ ...mark, displayOrder }))
}

export function insertCueMark(marks: CueMark[], added: CueMark): CueMark[] {
  const ordered = sortCueMarks(marks)
  // Insert before the first later cue without undoing existing manual moves.
  const next = ordered.findIndex(mark => compareCueTime(added, mark) < 0)
  ordered.splice(next < 0 ? ordered.length : next, 0, added)
  return numberRows(ordered)
}

export function moveCueMark(marks: CueMark[], id: string, direction: 'up' | 'down'): CueMark[] {
  const ordered = sortCueMarks(marks)
  const index = ordered.findIndex(mark => mark.id === id)
  const target = index + (direction === 'up' ? -1 : 1)
  if (index < 0 || target < 0 || target >= ordered.length) return marks
  ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
  return numberRows(ordered)
}
