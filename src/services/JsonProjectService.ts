import { parseCueTags, parseTagIds } from './CueTags'
import { parseSubTimer } from './SubTimer'
import { parsePauseRecords } from './PauseValidation'
import type { SegmentResult } from '../models/SegmentResult'
import {
  SHOWTIMER_FORMAT_NAME,
  SHOWTIMER_FORMAT_VERSION,
  type ShowProject,
} from '../models/ShowProject'
import type { CueMark } from '../models/CueMark'
import type { ShowSegment } from '../models/ShowSegment'

export function exportProjectToJson(
  project: ShowProject,
): string {
  return JSON.stringify(project, null, 2)
}

export function downloadProjectJson(
  project: ShowProject,
) {
  const json = exportProjectToJson(project)

  const blob = new Blob([json], {
    type: 'application/json',
  })

  const objectUrl =
    URL.createObjectURL(blob)

  const downloadLink =
    document.createElement('a')

  const showFileName = sanitizeFileName(
    project.projectName.trim() ||
      'Untitled-Show',
  )

  const timestamp =
    formatFileTimestamp(new Date())

  downloadLink.href = objectUrl
  downloadLink.download =
    `${showFileName}-${timestamp}.showtimer.json`

  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()

  URL.revokeObjectURL(objectUrl)
}

export async function importProjectFromJsonFile(
  file: File,
): Promise<ShowProject> {
  const text = await file.text()

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(
      'This file is not valid JSON.',
    )
  }

  return validateShowProject(parsed)
}

export function validateShowProject(
  value: unknown,
): ShowProject {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid Show File data.',
    )
  }

  if (
    value.format !== SHOWTIMER_FORMAT_NAME
  ) {
    throw new Error(
      `Unrecognized file. Expected format "${SHOWTIMER_FORMAT_NAME}".`,
    )
  }

  if (
    typeof value.version !== 'number'
  ) {
    throw new Error(
      'Show File is missing a valid version.',
    )
  }

  if (
    value.version >
    SHOWTIMER_FORMAT_VERSION
  ) {
    throw new Error(
      `This Show File uses version ${value.version}. This app supports up to version ${SHOWTIMER_FORMAT_VERSION}.`,
    )
  }

  if (
    typeof value.projectId !== 'string' ||
    typeof value.projectName !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new Error(
      'Show File metadata is incomplete.',
    )
  }

  if (!Array.isArray(value.segments)) {
    throw new Error(
      'Show File is missing Segments.',
    )
  }

  if (!Array.isArray(value.results)) {
    throw new Error(
      'Show File is missing Results.',
    )
  }

  if (!Array.isArray(value.cueMarks)) {
    throw new Error(
      'Show File is missing Q Marks.',
    )
  }

  const segments = value.segments.map(
    (segment, index) =>
      validateSegment(segment, index),
  )

  const cueMarks = value.cueMarks.map(
    (cueMark, index) =>
      validateCueMark(cueMark, index),
  )

  return {
    format: SHOWTIMER_FORMAT_NAME,
    version: value.version,
    projectId: value.projectId,
    projectName: value.projectName,
    createdAt: value.createdAt,
    updatedAt: new Date().toISOString(),

    segments,
    results:
      value.results.map((result): SegmentResult => {
        if (!isRecord(result) || typeof result.id !== 'string' || typeof result.segmentId !== 'string' ||
          typeof result.segmentName !== 'string' || !Number.isInteger(result.segmentOrder) ||
          !['act', 'intermission'].includes(String(result.segmentType)) ||
          !Number.isFinite(result.elapsedSeconds) || Number(result.elapsedSeconds) < 0 ||
          !Number.isFinite(result.plannedSeconds) || Number(result.plannedSeconds) < 0 ||
          typeof result.startedAt !== 'string' || typeof result.endedAt !== 'string') throw new Error('Invalid completed result')
        for (const field of ['pausedSeconds', 'totalSeconds']) {
          if (result[field] !== undefined && (!Number.isFinite(result[field]) || Number(result[field]) < 0)) throw new Error('Invalid completed result time')
        }
        return { ...result, ...(result.pauses === undefined ? {} : { pauses: parsePauseRecords(JSON.stringify(result.pauses)) }) } as unknown as SegmentResult
      }),
    cueMarks,
    cueTags: parseCueTags(value.cueTags),
    subTimer: parseSubTimer(value.subTimer),
  }
}

function validateSegment(
  value: unknown,
  index: number,
): ShowSegment {
  if (!isRecord(value)) {
    throw new Error(
      `Segment ${index + 1} has an invalid format.`,
    )
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.order !== 'number' ||
    typeof value.plannedSeconds !==
      'number'
  ) {
    throw new Error(
      `Segment ${index + 1} is incomplete.`,
    )
  }

  if (
    value.type !== 'act' &&
    value.type !== 'intermission'
  ) {
    throw new Error(
      `Segment ${index + 1} has an invalid type.`,
    )
  }

  return {
    id: value.id,
    order: index,
    type: value.type,
    name: value.name,
    plannedSeconds: Math.max(
      0,
      Math.floor(value.plannedSeconds),
    ),
  }
}

function validateCueMark(
  value: unknown,
  index: number,
): CueMark {
  if (!isRecord(value)) {
    throw new Error(
      `Q Mark ${index + 1} has an invalid format.`,
    )
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.segmentId !== 'string' ||
    typeof value.segmentOrder !== 'number' ||
    typeof value.segmentName !== 'string' ||
    typeof value.elapsedSeconds !== 'number' ||
    typeof value.createdAt !== 'string'
  ) {
    throw new Error(
      `Q Mark ${index + 1} is incomplete.`,
    )
  }

  if (
    value.segmentType !== 'act' &&
    value.segmentType !== 'intermission'
  ) {
    throw new Error(
      `Q Mark ${index + 1} has an invalid segment type.`,
    )
  }

  return {
    ...(Number.isInteger(value.displayOrder) && Number(value.displayOrder) >= 0 ? { displayOrder: Number(value.displayOrder) } : {}),
    tagIds: parseTagIds(value.tagIds),
    id: value.id,
    label: value.label,
    segmentId: value.segmentId,
    segmentOrder: value.segmentOrder,
    segmentName: value.segmentName,
    segmentType: value.segmentType,
    elapsedSeconds: Math.max(
      0,
      Math.floor(value.elapsedSeconds),
    ),
    note:
      typeof value.note === 'string'
        ? value.note
        : '',
    createdAt: value.createdAt,
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function formatFileTimestamp(
  date: Date,
) {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  const hour = String(
    date.getHours(),
  ).padStart(2, '0')

  const minute = String(
    date.getMinutes(),
  ).padStart(2, '0')

  return (
    `${year}-${month}-${day}` +
    `-${hour}${minute}`
  )
}

function sanitizeFileName(
  value: string,
) {
  const sanitized = Array.from(value)
    .map((character) => {
      const codePoint =
        character.codePointAt(0) ?? 0

      return codePoint < 32 ||
        '<>:"/\\|?*'.includes(character)
        ? '-'
        : character
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized || 'Untitled-Show'
}
