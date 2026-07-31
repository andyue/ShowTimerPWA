import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  createShowProject,
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
  getElapsedSeconds,
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

  const [timerRun, setTimerRun] =
    useState<TimerRunState>(idleTimerRun)

  useEffect(() => {
    if (timerRun.status !== 'running') {
      return
    }

    const intervalId = window.setInterval(
      () =>
        setTimerRun((current) =>
          current.status === 'running'
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
      setTimerRun(idleTimerRun)
      return
    }

    const now = new Date()
    const elapsedSeconds =
      getElapsedSeconds(
        timerRun.startedAtMs,
        now.getTime(),
      )

    const result = createSegmentResult(
      segment,
      elapsedSeconds,
      timerRun.startedAtIso,
      now.toISOString(),
    )

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
      getElapsedSeconds(
        timerRun.startedAtMs,
        now.getTime(),
      )

    updateProject((currentProject) => ({
      ...currentProject,
      cueMarks: [
        ...currentProject.cueMarks,
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
      ],
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
    startShow,
    nextSegment,
    resetRun,
    addCueMark,
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
