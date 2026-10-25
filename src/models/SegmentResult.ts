import type { SegmentType } from './ShowSegment'

export interface SegmentResult {
  id: string

  segmentId: string
  segmentOrder: number
  segmentName: string
  segmentType: SegmentType

  plannedSeconds: number
  elapsedSeconds: number
  pausedSeconds?: number
  totalSeconds?: number
  pauses?: PauseRecord[]

  startedAt: string
  endedAt: string
}
export interface PauseRecord {
  id: string
  startedAtMs: number
  endedAtMs: number | null
  note: string
}
