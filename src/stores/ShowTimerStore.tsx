import { toggleSubTimer, resetSubTimer } from '../services/SubTimer'
import { insertCueMark, moveCueMark as reorderCueMark } from '../services/CueMarkOrder'
import { isValidTimerRun } from '../services/RunValidation'
import {
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from 'react'

import {
  createShowProject,
  SHOWTIMER_FORMAT_VERSION,
  type ShowProject,
} from '../models/ShowProject'

import {
  createAct,
  createIntermission,
  type ShowSegment,
} from '../models/ShowSegment'

import {
  clearProject,
  loadProject,
  saveProject,
} from '../services/ProjectStore'

import {
  downloadProjectCsv,
  importProjectFromCsvFile,
} from '../services/ExcelExporter'

import {
  downloadProjectJson,
  importProjectFromJsonFile,
} from '../services/JsonProjectService'

import {
  createSegmentResult,
  getRunElapsedSeconds,
  getPausedMs,
  pauseRun,
  resumeRun,
  closePauses,
} from '../services/TimerEngine'

import {
  ShowTimerContext,
  type TimerRunState,
  type ShowTimerStoreValue,
} from './useShowTimerStore'

interface ShowTimerProviderProps {
  children: ReactNode
}

const idleTimerRun: TimerRunState = {
  status: 'idle',
  currentSegmentIndex: -1,
  startedAtIso: '',
  startedAtMs: 0,
  nowMs: 0,
  pauses: [],
}

function createIdleTimerRun(
  segmentIndex: number,
): TimerRunState {
  return {
    ...idleTimerRun,
    currentSegmentIndex: segmentIndex,
  }
}

function createRunningTimerRun(
  segmentIndex: number,
  now = new Date(),
): TimerRunState {
  return {
    status: 'running',
    currentSegmentIndex: segmentIndex,
    startedAtIso: now.toISOString(),
    startedAtMs: now.getTime(),
    nowMs: now.getTime(),
    pauses: [],
  }
}

export function ShowTimerProvider({
  children,
}: ShowTimerProviderProps) {
  const [project, setProject] = useState<ShowProject>(
    () => {
      const savedProject = loadProject()

      return savedProject ?? createShowProject()
    },
  )

  const lastFinishedRun = useRef('')

  const [timerRun, setTimerRun] =
    useState<TimerRunState>(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('showtimer-run') || 'null')
        if (saved?.projectId === project.projectId && isValidTimerRun(saved.run, project.segments.length)) {
          return { ...saved.run, nowMs: Date.now() }
        }
      } catch { /* Ignore invalid saved sessions. */ }
      return idleTimerRun
    })

  useEffect(() => {
    if (timerRun.status !== 'running' && timerRun.status !== 'paused') {
      return
    }

    const intervalId = window.setInterval(
      () =>
        setTimerRun((current) =>
          (current.status === 'running' || current.status === 'paused')
            ? {
                ...current,
                nowMs: Date.now(),
              }
            : current,
        ),
      250,
    )

    return () =>
      window.clearInterval(intervalId)
  }, [timerRun.status])

  const savedRunJson = JSON.stringify({ projectId: project.projectId, run: { ...timerRun, nowMs: 0 } })
  useEffect(() => {
    localStorage.setItem('showtimer-run', savedRunJson)
  }, [savedRunJson])

  function pauseShow() { setTimerRun(current => pauseRun(current, Date.now())) }
  function resumeShow() { setTimerRun(current => resumeRun(current, Date.now())) }
  function updatePauseNote(pauseId: string, note: string) {
    setTimerRun(current => ({ ...current, pauses: current.pauses.map(p => p.id === pauseId ? { ...p, note } : p) }))
    updateProject(current => ({ ...current, results: current.results.map(result => ({ ...result,
      pauses: result.pauses?.map(p => p.id === pauseId ? { ...p, note } : p),
    })) }))
  }

  function replaceProject(
    nextProject: ShowProject,
  ) {
    setProject(nextProject)
    saveProject(nextProject)
    setTimerRun(idleTimerRun)
  }

  function updateProject(
    updater: (
      current: ShowProject,
    ) => ShowProject,
  ) {
    setProject((current) => {
      const updatedProject: ShowProject = {
        ...updater(current),
        version: SHOWTIMER_FORMAT_VERSION,
        updatedAt: new Date().toISOString(),
      }

      saveProject(updatedProject)

      return updatedProject
    })
  }

  function setProjectName(name: string) {
    updateProject((current) => ({
      ...current,
      projectName: name,
    }))
  }

  function addAct() {
    if (timerRun.status === 'running' || timerRun.status === 'paused') return
    updateProject((current) => {
      const actNumber =
        countActs(current.segments) + 1

      const segment: ShowSegment = {
        ...createAct(`Act ${actNumber}`),
        order: current.segments.length,
      }

      return {
        ...current,
        segments: [
          ...current.segments,
          segment,
        ],
      }
    })
  }

  function addIntermission() {
    if (timerRun.status === 'running' || timerRun.status === 'paused') return
    updateProject((current) => {
      const intermissionCount =
        current.segments.filter(
          (segment) =>
            segment.type === 'intermission',
        ).length

      const defaultName =
        intermissionCount === 0
          ? 'Intermission'
          : `Intermission ${
              intermissionCount + 1
            }`

      const segment: ShowSegment = {
        ...createIntermission(
          defaultName,
          20 * 60,
        ),
        order: current.segments.length,
      }

      return {
        ...current,
        segments: [
          ...current.segments,
          segment,
        ],
      }
    })
  }

  function updateSegmentName(
    segmentId: string,
    name: string,
  ) {
    updateProject((current) => ({
      ...current,
      segments: current.segments.map(
        (segment) =>
          segment.id === segmentId
            ? {
                ...segment,
                name,
              }
            : segment,
      ),
    }))
  }

  function updateSegmentDuration(
    segmentId: string,
    plannedSeconds: number,
  ) {
    const safeSeconds = Math.max(
      0,
      Math.floor(plannedSeconds),
    )

    updateProject((current) => ({
      ...current,
      segments: current.segments.map(
        (segment) =>
          segment.id === segmentId
            ? {
                ...segment,
                plannedSeconds:
                  safeSeconds,
              }
            : segment,
      ),
    }))
  }

  function moveSegment(
    segmentId: string,
    direction: 'up' | 'down',
  ) {
    if (timerRun.status === 'running' || timerRun.status === 'paused') return
    updateProject((current) => {
      const currentIndex =
        current.segments.findIndex(
          (segment) =>
            segment.id === segmentId,
        )

      if (currentIndex < 0) {
        return current
      }

      const targetIndex =
        direction === 'up'
          ? currentIndex - 1
          : currentIndex + 1

      if (
        targetIndex < 0 ||
        targetIndex >=
          current.segments.length
      ) {
        return current
      }

      const reordered = [
        ...current.segments,
      ]

      const [movedSegment] =
        reordered.splice(
          currentIndex,
          1,
        )

      if (!movedSegment) {
        return current
      }

      reordered.splice(
        targetIndex,
        0,
        movedSegment,
      )

      return {
        ...current,
        segments: reordered.map(
          (segment, index) => ({
            ...segment,
            order: index,
          }),
        ),
      }
    })
  }

  function deleteSegment(
    segmentId: string,
  ) {
    if (timerRun.status === 'running' || timerRun.status === 'paused') return
    updateProject((current) => ({
      ...current,
      segments: current.segments
        .filter(
          (segment) =>
            segment.id !== segmentId,
        )
        .map((segment, index) => ({
          ...segment,
          order: index,
        })),
    }))
  }

  function exportJson() {
    downloadProjectJson(project)
  }

  function exportExcel() {
    downloadProjectCsv(project)
  }

  async function importJson(file: File) {
    const importedProject =
      await importProjectFromJsonFile(file)

    replaceProject(importedProject)
  }

  async function importExcel(file: File) {
    const importedProject =
      await importProjectFromCsvFile(file)

    replaceProject(importedProject)
  }

  function resetProject() {
    clearProject()

    const newProject =
      createShowProject()

    replaceProject(newProject)
  }

  function resetShow() {
    updateProject((current) => ({
      ...current,
      results: [],
    }))

    setTimerRun(
      project.segments.length > 0
        ? createIdleTimerRun(0)
        : idleTimerRun,
    )
  }

  function startShow() {
    if (timerRun.status !== 'idle') return
    if (project.segments.length === 0) {
      return
    }

    const segmentIndex =
      timerRun.currentSegmentIndex >= 0 &&
      timerRun.currentSegmentIndex <
        project.segments.length
        ? timerRun.currentSegmentIndex
        : 0

    setTimerRun(
      createRunningTimerRun(segmentIndex),
    )
  }

  function nextSegment() {
    if (
      (timerRun.status !== 'running' && timerRun.status !== 'paused') ||
      timerRun.currentSegmentIndex < 0
    ) {
      return
    }

    const segment =
      project.segments[
        timerRun.currentSegmentIndex
      ]

    if (!segment) {
      setTimerRun(idleTimerRun)
      return
    }

    const runIdentity = `${timerRun.currentSegmentIndex}:${timerRun.startedAtIso}`
    if (lastFinishedRun.current === runIdentity) return
    lastFinishedRun.current = runIdentity
    const now = new Date()
    const elapsedSeconds =
      getRunElapsedSeconds(
        timerRun,
        now.getTime(),
      )

    const result = createSegmentResult(
      segment,
      elapsedSeconds,
      timerRun.startedAtIso,
      now.toISOString(),
    )

    result.pauses = closePauses(timerRun, now.getTime())
    result.pausedSeconds = Math.floor(getPausedMs(timerRun, now.getTime()) / 1000)
    result.totalSeconds = Math.floor((now.getTime() - timerRun.startedAtMs) / 1000)

    updateProject((currentProject) => ({
      ...currentProject,
      results: [
        ...currentProject.results,
        result,
      ],
    }))

    const nextSegmentIndex =
      timerRun.currentSegmentIndex + 1

    if (
      nextSegmentIndex >= project.segments.length
    ) {
      setTimerRun({
        ...idleTimerRun,
        status: 'finished',
        nowMs: now.getTime(),
      })
      return
    }

    const nextSegment =
      project.segments[nextSegmentIndex]

    if (nextSegment?.type === 'intermission') {
      setTimerRun(
        createRunningTimerRun(
          nextSegmentIndex,
          now,
        ),
      )
      return
    }

    setTimerRun(
      createIdleTimerRun(nextSegmentIndex),
    )
  }

  function resetRun() {
    setTimerRun(idleTimerRun)
  }

  function addCueMark() {
    if (
      timerRun.status !== 'running' ||
      timerRun.currentSegmentIndex < 0
    ) {
      return
    }

    const segment =
      project.segments[
        timerRun.currentSegmentIndex
      ]

    if (!segment) {
      return
    }

    const now = new Date()
    const elapsedSeconds =
      getRunElapsedSeconds(
        timerRun,
        now.getTime(),
      )

    updateProject((currentProject) => ({
      ...currentProject,
      cueMarks: insertCueMark(
        currentProject.cueMarks,
        {
          id: crypto.randomUUID(),
          label: `M${
            getNextCueMarkNumber(
              currentProject.cueMarks,
            )
          }`,
          segmentId: segment.id,
          segmentOrder: segment.order,
          segmentName: segment.name,
          segmentType: segment.type,
          elapsedSeconds,
          note: '',
          createdAt: now.toISOString(),
        },
      ),
    }))
  }

  function updateCueMarkNote(
    cueMarkId: string,
    note: string,
  ) {
    updateProject((currentProject) => ({
      ...currentProject,
      cueMarks: currentProject.cueMarks.map(
        (cueMark) =>
          cueMark.id === cueMarkId
            ? {
                ...cueMark,
                note,
              }
            : cueMark,
      ),
    }))
  }

  function moveCueMark(id: string, direction: 'up' | 'down') {
    updateProject(currentProject => ({
      ...currentProject,
      cueMarks: reorderCueMark(currentProject.cueMarks, id, direction),
    }))
  }

  function deleteCueMark(cueMarkId: string) {
    updateProject((currentProject) => ({
      ...currentProject,
      cueMarks: currentProject.cueMarks.filter(
        (cueMark) =>
          cueMark.id !== cueMarkId,
      ),
    }))
  }

  const value: ShowTimerStoreValue = {
    project,
    timerRun,
    setProjectName,
    addAct,
    addIntermission,
    updateSegmentName,
    updateSegmentDuration,
    moveSegment,
    deleteSegment,
    exportJson,
    exportExcel,
    importJson,
    importExcel,
    resetShow,
    resetProject,
    pauseShow,
    resumeShow,
    updatePauseNote,
    startShow,
    nextSegment,
    resetRun,
    toggleSubTimer: () => {
      const now = Date.now()
      const segmentName = project.segments[Math.max(0, timerRun.currentSegmentIndex)]?.name ?? ''
      updateProject(current => ({ ...current, subTimer: toggleSubTimer(current.subTimer, now, segmentName) }))
    },
    resetSubTimer: () => {
      const now = Date.now()
      updateProject(current => ({ ...current, subTimer: resetSubTimer(current.subTimer, now) }))
    },
    updateSubTimerNote: (id, note) => updateProject(current => ({
      ...current,
      subTimer: current.subTimer ? { ...current.subTimer, records: current.subTimer.records.map(record => record.id === id ? { ...record, note } : record) } : undefined,
    })),
    addCueMark,
    moveCueMark,
    updateCueMarkNote,
    deleteCueMark,
  }

  return (
    <ShowTimerContext.Provider
      value={value}
    >
      {children}
    </ShowTimerContext.Provider>
  )
}

function countActs(
  segments: ShowSegment[],
) {
  return segments.filter(
    (segment) =>
      segment.type === 'act',
  ).length
}

function getNextCueMarkNumber(
  cueMarks: ShowProject['cueMarks'],
) {
  const highestMarkNumber = cueMarks.reduce(
    (highest, cueMark) => {
      const match =
        /^M(\d+)$/.exec(cueMark.label)

      if (!match) {
        return highest
      }

      return Math.max(
        highest,
        Number(match[1]),
      )
    },
    0,
  )

  return highestMarkNumber + 1
}
