import type { CueMark } from '../models/CueMark'
import type { ShowProject } from '../models/ShowProject'
import type { TimerRunState } from '../stores/useShowTimerStore'
import { getPausedMs } from './TimerEngine'

export interface BroadcastSnapshot {
  cueMarks?: CueMark[]
  projectName: string
  segment: { name: string; type: 'act' | 'intermission'; plannedSeconds: number } | null
  nextSegmentName: string
  status: TimerRunState['status']
  elapsedMs: number
  pausedMs: number
  currentPauseMs: number
  capturedAtMs: number
}
export interface BroadcastRoom { url: string; id: string; hostToken: string; viewerToken: string; viewerBaseUrl?: string }

export function makeSnapshot(project: ShowProject, run: TimerRunState, nowMs: number, offset = 0): BroadcastSnapshot {
  const active = run.status === 'running' || run.status === 'paused'
  const segment = project.segments[run.currentSegmentIndex >= 0 ? run.currentSegmentIndex : 0]
  const pausedMs = active ? getPausedMs(run, nowMs) : 0
  return {
    cueMarks: [...project.cueMarks].sort((a, b) => a.segmentOrder - b.segmentOrder || a.elapsedSeconds - b.elapsedSeconds || Date.parse(a.createdAt) - Date.parse(b.createdAt)).map(mark => ({
      id: mark.id, label: mark.label, segmentId: mark.segmentId, segmentOrder: mark.segmentOrder,
      segmentName: mark.segmentName, segmentType: mark.segmentType, elapsedSeconds: mark.elapsedSeconds,
      note: mark.note, createdAt: mark.createdAt,
    })),
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

export function isPrivateIPv4(host: string) {
  const parts = host.split('.').map(Number)
  return parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168))
}

export function validateSocketUrl(raw: string, localOnly = false, pageUrl = typeof location === 'undefined' ? 'https://example.invalid/' : location.href) {
  const url = new URL(raw)
  const page = new URL(pageUrl)
  const sameLanOrigin = page.protocol === 'http:' && page.host === url.host && isPrivateIPv4(url.hostname)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.hash || !['wss:', 'ws:'].includes(url.protocol) ||
    (url.protocol === 'ws:' && !local && !sameLanOrigin) || (localOnly && !local)) {
    throw new Error(localOnly ? 'OSC 橋接需使用本機 ws://127.0.0.1:8788 或本機 WSS 位址' : '雲端同步需使用 wss://；區網觀看請掃描現場主控的 QR Code')
  }
  return url.toString()
}

export function viewerUrl(room: BroadcastRoom) {
  const url = new URL(room.viewerBaseUrl || location.href)
  const service = room.viewerBaseUrl ? new URL(room.viewerBaseUrl) : new URL(room.url)
  if (room.viewerBaseUrl) service.protocol = service.protocol === 'https:' ? 'wss:' : 'ws:'
  url.hash = new URLSearchParams({ watch: room.id, token: room.viewerToken, service: service.toString() }).toString()
  return url.toString()
}
