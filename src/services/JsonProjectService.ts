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
      '這個檔案不是有效的 JSON。',
    )
  }

  return validateShowProject(parsed)
}

export function validateShowProject(
  value: unknown,
): ShowProject {
  if (!isRecord(value)) {
    throw new Error(
      'Show File 的資料格式不正確。',
    )
  }

  if (
    value.format !== SHOWTIMER_FORMAT_NAME
  ) {
    throw new Error(
      `無法辨識這個檔案。格式必須是 "${SHOWTIMER_FORMAT_NAME}"。`,
    )
  }

  if (
    typeof value.version !== 'number'
  ) {
    throw new Error(
      'Show File 缺少有效的版本號。',
    )
  }

  if (
    value.version >
    SHOWTIMER_FORMAT_VERSION
  ) {
    throw new Error(
      `這個 Show File 是較新的版本 ${value.version}，目前程式只支援版本 ${SHOWTIMER_FORMAT_VERSION}。`,
    )
  }

  if (
    typeof value.projectId !== 'string' ||
    typeof value.projectName !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new Error(
      'Show File 的基本資料不完整。',
    )
  }

  if (!Array.isArray(value.segments)) {
    throw new Error(
      'Show File 缺少 Segments 資料。',
    )
  }

  if (!Array.isArray(value.results)) {
    throw new Error(
      'Show File 缺少 Results 資料。',
    )
  }

  if (!Array.isArray(value.cueMarks)) {
    throw new Error(
      'Show File 缺少 Q Marks 資料。',
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
      value.results as ShowProject['results'],
    cueMarks,
  }
}

function validateSegment(
  value: unknown,
  index: number,
): ShowSegment {
  if (!isRecord(value)) {
    throw new Error(
      `第 ${index + 1} 個 Segment 格式不正確。`,
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
      `第 ${index + 1} 個 Segment 資料不完整。`,
    )
  }

  if (
    value.type !== 'act' &&
    value.type !== 'intermission'
  ) {
    throw new Error(
      `第 ${index + 1} 個 Segment Type 不正確。`,
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
      `第 ${index + 1} 個 Q Mark 格式不正確。`,
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
      `第 ${index + 1} 個 Q Mark 資料不完整。`,
    )
  }

  if (
    value.segmentType !== 'act' &&
    value.segmentType !== 'intermission'
  ) {
    throw new Error(
      `第 ${index + 1} 個 Q Mark Segment Type 不正確。`,
    )
  }

  return {
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
