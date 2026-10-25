import type { ShowProject } from '../models/ShowProject'
import type { TimerRunState } from '../stores/useShowTimerStore'
import { getPausedMs } from './TimerEngine'

export interface BroadcastSnapshot {
  projectName: string
  segment: { name: string; type: 'act' | 'intermission'; plannedSeconds: number } | null
  nextSegmentName: string
  status: TimerRunState['status']
  elapsedMs: number
  pausedMs: number
  currentPauseMs: number
  capturedAtMs: number
}
export interface BroadcastRoom { url: string; id: string; hostToken: string; viewerToken: string }

export function makeSnapshot(project: ShowProject, run: TimerRunState, nowMs: number, offset = 0): BroadcastSnapshot {
  const active = run.status === 'running' || run.status === 'paused'
  const segment = project.segments[run.currentSegmentIndex >= 0 ? run.currentSegmentIndex : 0]
  const pausedMs = active ? getPausedMs(run, nowMs) : 0
  return {
    projectName: project.projectName,
    segment: segment && run.status !== 'finished' ? { name: segment.name, type: segment.type, plannedSeconds: segment.plannedSeconds } : null,
    nextSegmentName: project.segments[(run.currentSegmentIndex >= 0 ? run.currentSegmentIndex : 0) + 1]?.name ?? '',
    status: run.status, elapsedMs: active ? Math.max(0, nowMs - run.startedAtMs - pausedMs) : 0,
    pausedMs, currentPauseMs: run.status === 'paused' ? nowMs - run.pauses.at(-1)!.startedAtMs : 0,
    capturedAtMs: nowMs + offset,
  }
}

export function projectSnapshot(snapshot: BroadcastSnapshot, serverNow: number) {
  const delta = Math.max(0, serverNow - snapshot.capturedAtMs)
  return {
    elapsedMs: snapshot.elapsedMs + (snapshot.status === 'running' ? delta : 0),
    pausedMs: snapshot.pausedMs + (snapshot.status === 'paused' ? delta : 0),
    currentPauseMs: snapshot.currentPauseMs + (snapshot.status === 'paused' ? delta : 0),
  }
}

export function validateSocketUrl(raw: string, localOnly = false) {
  const url = new URL(raw)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.hash || !['wss:', 'ws:'].includes(url.protocol) ||
    (url.protocol === 'ws:' && !local) || (localOnly && !local)) {
    throw new Error(localOnly ? 'OSC 橋接需使用本機 ws://127.0.0.1:8788 或本機 WSS 位址' : '雲端同步位址需使用 wss://；本機測試可用 ws://localhost')
  }
  return url.toString()
}

export function viewerUrl(room: BroadcastRoom) {
  const url = new URL(location.href)
  url.hash = new URLSearchParams({ watch: room.id, token: room.viewerToken, service: room.url }).toString()
  return url.toString()
}
