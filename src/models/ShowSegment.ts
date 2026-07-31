export type SegmentType = 'act' | 'intermission'

export interface ShowSegment {
  id: string
  order: number
  type: SegmentType
  name: string
  plannedSeconds: number
}

export function createAct(
  name = 'Act',
): ShowSegment {
  return {
    id: crypto.randomUUID(),
    order: 0,
    name,
    type: 'act',
    plannedSeconds: 0,
  }
}

export function createIntermission(
  name = 'Intermission',
  plannedSeconds = 20 * 60,
): ShowSegment {
  return {
    id: crypto.randomUUID(),
    order: 0,
    name,
    type: 'intermission',
    plannedSeconds,
  }
}