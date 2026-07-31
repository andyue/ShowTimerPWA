import type { SegmentType } from './ShowSegment'

export interface SegmentResult {
  id: string

  segmentId: string
  segmentOrder: number
  segmentName: string
  segmentType: SegmentType

  plannedSeconds: number
  elapsedSeconds: number

  startedAt: string
  endedAt: string
}