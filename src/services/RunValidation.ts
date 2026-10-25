import type { TimerRunState } from '../stores/useShowTimerStore'

export function isValidTimerRun(value: unknown, segmentCount: number): value is TimerRunState {
  if (!value || typeof value !== 'object') return false
  const run = value as TimerRunState
  if (!['idle', 'running', 'paused', 'finished'].includes(run.status) ||
    !Number.isInteger(run.currentSegmentIndex) || run.currentSegmentIndex < -1 ||
    run.currentSegmentIndex >= segmentCount || !Number.isFinite(run.startedAtMs) ||
    typeof run.startedAtIso !== 'string' || !Array.isArray(run.pauses)) return false
  if (['running', 'paused'].includes(run.status) && (run.currentSegmentIndex < 0 || run.startedAtMs <= 0)) return false
  let end = run.startedAtMs
  for (const [index, pause] of run.pauses.entries()) {
    if (!pause || typeof pause.id !== 'string' || typeof pause.note !== 'string' ||
      !Number.isFinite(pause.startedAtMs) || pause.startedAtMs < end ||
      (pause.endedAtMs !== null && (!Number.isFinite(pause.endedAtMs) || pause.endedAtMs < pause.startedAtMs))) return false
    if (pause.endedAtMs === null && (run.status !== 'paused' || index !== run.pauses.length - 1)) return false
    end = pause.endedAtMs ?? pause.startedAtMs
  }
  return run.status !== 'paused' || run.pauses.at(-1)?.endedAtMs === null
}
