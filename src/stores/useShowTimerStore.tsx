import {
  createContext,
  useContext,
} from 'react'

import type { ShowProject } from '../models/ShowProject'

export type TimerRunStatus =
  | 'idle'
  | 'running'
  | 'finished'

export interface TimerRunState {
  status: TimerRunStatus
  currentSegmentIndex: number
  startedAtIso: string
  startedAtMs: number
  nowMs: number
}

export interface ShowTimerStoreValue {
  project: ShowProject
  timerRun: TimerRunState

  setProjectName: (name: string) => void

  addAct: () => void
  addIntermission: () => void

  updateSegmentName: (
    segmentId: string,
    name: string,
  ) => void

  updateSegmentDuration: (
    segmentId: string,
    plannedSeconds: number,
  ) => void

  moveSegment: (
    segmentId: string,
    direction: 'up' | 'down',
  ) => void

  deleteSegment: (segmentId: string) => void

  exportJson: () => void
  exportExcel: () => void
  importJson: (file: File) => Promise<void>
  importExcel: (file: File) => Promise<void>
  resetShow: () => void
  resetProject: () => void

  startShow: () => void
  nextSegment: () => void
  resetRun: () => void
  addCueMark: () => void
  updateCueMarkNote: (
    cueMarkId: string,
    note: string,
  ) => void
  deleteCueMark: (cueMarkId: string) => void
}

export const ShowTimerContext =
  createContext<ShowTimerStoreValue | undefined>(
    undefined,
  )

export function useShowTimerStore() {
  const context =
    useContext(ShowTimerContext)

  if (!context) {
    throw new Error(
      'useShowTimerStore must be used inside ShowTimerProvider',
    )
  }

  return context
}
