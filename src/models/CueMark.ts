import type { SegmentType } from './ShowSegment'

export interface CueMark {
  displayOrder?: number
  id: string
  label: string
  segmentId: string
  segmentOrder: number
  segmentName: string
  segmentType: SegmentType
  elapsedSeconds: number
  note: string
  createdAt: string
}
