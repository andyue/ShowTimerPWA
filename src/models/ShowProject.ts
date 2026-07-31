import type { CueMark } from './CueMark'
import type { SegmentResult } from './SegmentResult'
import type { ShowSegment } from './ShowSegment'

export const SHOWTIMER_FORMAT_NAME = 'ShowTimer'
export const SHOWTIMER_FORMAT_VERSION = 1

export interface ShowProject {
  format: typeof SHOWTIMER_FORMAT_NAME
  version: number

  projectId: string
  projectName: string

  createdAt: string
  updatedAt: string

  segments: ShowSegment[]
  results: SegmentResult[]
  cueMarks: CueMark[]
}

export function createShowProject(
  projectName = '',
): ShowProject {
  const now = new Date().toISOString()

  return {
    format: SHOWTIMER_FORMAT_NAME,
    version: SHOWTIMER_FORMAT_VERSION,

    projectId: crypto.randomUUID(),
    projectName,

    createdAt: now,
    updatedAt: now,

    segments: [],
    results: [],
    cueMarks: [],
  }
}