import type { SegmentResult } from '../models/SegmentResult'
import type { ShowSegment } from '../models/ShowSegment'

export function getElapsedSeconds(
  startedAtMs: number,
  nowMs: number,
) {
  return Math.max(
    0,
    Math.floor((nowMs - startedAtMs) / 1000),
  )
}

export function getDisplaySeconds(
  segment: ShowSegment | undefined,
  elapsedSeconds: number,
) {
  if (!segment) {
    return 0
  }

  if (segment.type === 'intermission') {
    return Math.max(
      0,
      segment.plannedSeconds - elapsedSeconds,
    )
  }

  return elapsedSeconds
}

export function getRemainingOrDelaySeconds(
  segment: ShowSegment,
  elapsedSeconds: number,
) {
  return Math.abs(
    segment.plannedSeconds - elapsedSeconds,
  )
}

export function formatTimerSeconds(
  totalSeconds: number,
) {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds),
  )

  const hours = Math.floor(
    safeSeconds / 3600,
  )

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  )

  const seconds = safeSeconds % 60

  return [
    hours,
    minutes,
    seconds,
  ]
    .map((value) =>
      String(value).padStart(2, '0'),
    )
    .join(':')
}

export function formatClockTime(
  timestampMs: number,
) {
  if (timestampMs <= 0) {
    return '--:--:--'
  }

  const date = new Date(timestampMs)

  return [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ]
    .map((value) =>
      String(value).padStart(2, '0'),
    )
    .join(':')
}

export function createSegmentResult(
  segment: ShowSegment,
  elapsedSeconds: number,
  startedAtIso: string,
  endedAtIso: string,
): SegmentResult {
  return {
    id: crypto.randomUUID(),
    segmentId: segment.id,
    segmentOrder: segment.order,
    segmentName: segment.name,
    segmentType: segment.type,
    plannedSeconds: segment.plannedSeconds,
    elapsedSeconds,
    startedAt: startedAtIso,
    endedAt: endedAtIso,
  }
}
