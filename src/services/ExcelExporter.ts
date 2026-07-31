import type { CueMark } from '../models/CueMark'
import {
  SHOWTIMER_FORMAT_NAME,
  SHOWTIMER_FORMAT_VERSION,
  type ShowProject,
} from '../models/ShowProject'
import type {
  SegmentType,
  ShowSegment,
} from '../models/ShowSegment'
import type { SegmentResult } from '../models/SegmentResult'
import { formatTimerSeconds } from './TimerEngine'

type CsvRow = Array<string | number>

export function downloadProjectCsv(
  project: ShowProject,
) {
  const csv = exportProjectToCsv(project)

  const blob = new Blob(
    [`\uFEFF${csv}`],
    {
      type: 'text/csv;charset=utf-8',
    },
  )

  const objectUrl =
    URL.createObjectURL(blob)

  const downloadLink =
    document.createElement('a')

  const showFileName = sanitizeFileName(
    project.projectName.trim() ||
      'Untitled-Show',
  )

  downloadLink.href = objectUrl
  downloadLink.download =
    `${showFileName}-${formatFileTimestamp(
      new Date(),
    )}.showtimer.csv`

  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()

  URL.revokeObjectURL(objectUrl)
}

export function exportProjectToCsv(
  project: ShowProject,
) {
  const rows: CsvRow[] = [
    ['Show File', project.projectName || 'Untitled Show'],
    ['Exported At', new Date().toISOString()],
    [],
    ['Segments'],
    [
      'Order',
      'Type',
      'Name',
      'Planned Duration',
      'Planned Seconds',
    ],
    ...project.segments.map((segment) => [
      segment.order + 1,
      segment.type === 'act'
        ? 'Act'
        : 'Intermission',
      segment.name,
      formatTimerSeconds(segment.plannedSeconds),
      segment.plannedSeconds,
    ]),
    [],
    ['Completed Results'],
    [
      'Segment Order',
      'Type',
      'Name',
      'Planned Duration',
      'Elapsed Duration',
      'Elapsed Seconds',
      'Started At',
      'Ended At',
    ],
    ...project.results.map((result) => [
      result.segmentOrder + 1,
      result.segmentType === 'act'
        ? 'Act'
        : 'Intermission',
      result.segmentName,
      formatTimerSeconds(result.plannedSeconds),
      formatTimerSeconds(result.elapsedSeconds),
      result.elapsedSeconds,
      result.startedAt,
      result.endedAt,
    ]),
    [],
    ['Marks'],
    [
      'Label',
      'Segment Order',
      'Type',
      'Segment Name',
      'Time',
      'Elapsed Seconds',
      'Created At',
      'Note',
    ],
    ...getSortedCueMarks(project).map(
      (cueMark) => [
        cueMark.label,
        cueMark.segmentOrder + 1,
        cueMark.segmentType === 'act'
          ? 'Act'
          : 'Intermission',
        cueMark.segmentName,
        formatTimerSeconds(
          cueMark.elapsedSeconds,
        ),
        cueMark.elapsedSeconds,
        cueMark.createdAt,
        cueMark.note,
      ],
    ),
  ]

  return rows.map(formatCsvRow).join('\r\n')
}

export async function importProjectFromCsvFile(
  file: File,
) {
  const csv = await file.text()

  return importProjectFromCsv(csv)
}

export function importProjectFromCsv(
  csv: string,
): ShowProject {
  const rows = parseCsvRows(csv).map((row) =>
    row.map((cell) => cell.trim()),
  )

  const projectName =
    getMetadataValue(rows, 'Show File') ||
    'Untitled Show'

  const segments = parseSegments(
    getSectionRows(rows, 'Segments'),
  )

  if (segments.length === 0) {
    throw new Error(
      'Excel 匯入失敗：找不到 Segments 資料。',
    )
  }

  const results = parseResults(
    getSectionRows(
      rows,
      'Completed Results',
    ),
    segments,
  )

  const cueMarks = parseCueMarks(
    getSectionRows(rows, 'Marks'),
    segments,
  )

  const now = new Date().toISOString()

  return {
    format: SHOWTIMER_FORMAT_NAME,
    version: SHOWTIMER_FORMAT_VERSION,
    projectId: crypto.randomUUID(),
    projectName,
    createdAt: now,
    updatedAt: now,
    segments,
    results,
    cueMarks,
  }
}

function getSortedCueMarks(
  project: ShowProject,
) {
  return [...project.cueMarks].sort(
    (first, second) => {
      const segmentOrderDifference =
        first.segmentOrder -
        second.segmentOrder

      if (segmentOrderDifference !== 0) {
        return segmentOrderDifference
      }

      const elapsedDifference =
        first.elapsedSeconds -
        second.elapsedSeconds

      if (elapsedDifference !== 0) {
        return elapsedDifference
      }

      return (
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime()
      )
    },
  )
}

function parseSegments(
  sectionRows: string[][],
): ShowSegment[] {
  const { headers, dataRows } =
    getHeaderAndDataRows(sectionRows)

  return dataRows
    .map<ShowSegment | null>((row, fallbackIndex) => {
      const order =
        parsePositiveInteger(
          getCell(row, headers, 'Order'),
        ) ?? fallbackIndex + 1

      const type = parseSegmentType(
        getCell(row, headers, 'Type'),
      )

      if (!type) {
        return null
      }

      const name =
        getCell(row, headers, 'Name') ||
        (type === 'act'
          ? `Act ${fallbackIndex + 1}`
          : 'Intermission')

      const plannedSeconds =
        parseNonNegativeInteger(
          getCell(
            row,
            headers,
            'Planned Seconds',
          ),
        ) ??
        parseDurationSeconds(
          getCell(
            row,
            headers,
            'Planned Duration',
          ),
        ) ??
        0

      return {
        id: crypto.randomUUID() as string,
        order: order - 1,
        type,
        name,
        plannedSeconds,
      }
    })
    .filter(
      (segment): segment is ShowSegment =>
        segment !== null,
    )
    .sort(
      (first, second) =>
        first.order - second.order,
    )
    .map((segment, index) => ({
      ...segment,
      order: index,
    }))
}

function parseResults(
  sectionRows: string[][],
  segments: ShowSegment[],
): SegmentResult[] {
  const { headers, dataRows } =
    getHeaderAndDataRows(sectionRows)

  return dataRows.flatMap((row) => {
    const segment = getSegmentByOrder(
      segments,
      getCell(row, headers, 'Segment Order'),
    )

    if (!segment) {
      return []
    }

    const elapsedSeconds =
      parseNonNegativeInteger(
        getCell(
          row,
          headers,
          'Elapsed Seconds',
        ),
      ) ??
      parseDurationSeconds(
        getCell(
          row,
          headers,
          'Elapsed Duration',
        ),
      ) ??
      0

    const plannedSeconds =
      parseNonNegativeInteger(
        getCell(
          row,
          headers,
          'Planned Seconds',
        ),
      ) ??
      parseDurationSeconds(
        getCell(
          row,
          headers,
          'Planned Duration',
        ),
      ) ??
      segment.plannedSeconds

    const now = new Date().toISOString()

    return [
      {
        id: crypto.randomUUID(),
        segmentId: segment.id,
        segmentOrder: segment.order,
        segmentName:
          getCell(row, headers, 'Name') ||
          segment.name,
        segmentType:
          parseSegmentType(
            getCell(row, headers, 'Type'),
          ) ?? segment.type,
        plannedSeconds,
        elapsedSeconds,
        startedAt:
          getCell(
            row,
            headers,
            'Started At',
          ) || now,
        endedAt:
          getCell(
            row,
            headers,
            'Ended At',
          ) || now,
      },
    ]
  })
}

function parseCueMarks(
  sectionRows: string[][],
  segments: ShowSegment[],
): CueMark[] {
  const { headers, dataRows } =
    getHeaderAndDataRows(sectionRows)

  return dataRows.flatMap((row) => {
    const segment = getSegmentByOrder(
      segments,
      getCell(row, headers, 'Segment Order'),
    )

    if (!segment) {
      return []
    }

    const elapsedSeconds =
      parseNonNegativeInteger(
        getCell(
          row,
          headers,
          'Elapsed Seconds',
        ),
      ) ??
      parseDurationSeconds(
        getCell(row, headers, 'Time'),
      ) ??
      0

    return [
      {
        id: crypto.randomUUID(),
        label:
          getCell(row, headers, 'Label') ||
          'M',
        segmentId: segment.id,
        segmentOrder: segment.order,
        segmentName:
          getCell(
            row,
            headers,
            'Segment Name',
          ) || segment.name,
        segmentType:
          parseSegmentType(
            getCell(row, headers, 'Type'),
          ) ?? segment.type,
        elapsedSeconds,
        note: getCell(row, headers, 'Note'),
        createdAt:
          getCell(
            row,
            headers,
            'Created At',
          ) || new Date().toISOString(),
      },
    ]
  })
}

function parseCsvRows(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let isQuoted = false

  const text = csv.replace(/^\uFEFF/, '')

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"') {
      if (isQuoted && nextCharacter === '"') {
        cell += '"'
        index += 1
      } else {
        isQuoted = !isQuoted
      }

      continue
    }

    if (character === ',' && !isQuoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if (
      (character === '\n' ||
        character === '\r') &&
      !isQuoted
    ) {
      if (
        character === '\r' &&
        nextCharacter === '\n'
      ) {
        index += 1
      }

      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += character
  }

  row.push(cell)
  rows.push(row)

  return rows.filter((currentRow) =>
    currentRow.some(
      (currentCell) =>
        currentCell.trim() !== '',
    ),
  )
}

function getMetadataValue(
  rows: string[][],
  label: string,
) {
  return (
    rows.find((row) => row[0] === label)?.[1] ??
    ''
  )
}

function getSectionRows(
  rows: string[][],
  sectionName: string,
) {
  const startIndex = rows.findIndex(
    (row) => row[0] === sectionName,
  )

  if (startIndex < 0) {
    return []
  }

  const sectionRows: string[][] = []

  for (
    let index = startIndex + 1;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index]

    if (
      row.length === 1 &&
      ['Segments', 'Completed Results', 'Marks'].includes(
        row[0],
      )
    ) {
      break
    }

    sectionRows.push(row)
  }

  return sectionRows
}

function getHeaderAndDataRows(
  rows: string[][],
) {
  if (rows.length === 0) {
    return {
      headers: new Map<string, number>(),
      dataRows: [],
    }
  }

  const headers = new Map<string, number>()

  rows[0].forEach((header, index) => {
    headers.set(header, index)
  })

  return {
    headers,
    dataRows: rows
      .slice(1)
      .filter((row) =>
        row.some((cell) => cell !== ''),
      ),
  }
}

function getCell(
  row: string[],
  headers: Map<string, number>,
  header: string,
) {
  const index = headers.get(header)

  if (index === undefined) {
    return ''
  }

  return row[index] ?? ''
}

function getSegmentByOrder(
  segments: ShowSegment[],
  orderValue: string,
) {
  const order =
    parsePositiveInteger(orderValue)

  if (!order) {
    return null
  }

  return segments[order - 1] ?? null
}

function parseSegmentType(
  value: string,
): SegmentType | null {
  const normalized = value
    .trim()
    .toLowerCase()

  if (normalized === 'act') {
    return 'act'
  }

  if (
    normalized === 'intermission' ||
    normalized === 'break'
  ) {
    return 'intermission'
  }

  return null
}

function parsePositiveInteger(
  value: string,
) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function parseNonNegativeInteger(
  value: string,
) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function parseDurationSeconds(
  value: string,
) {
  const parts = value
    .split(':')
    .map((part) => Number.parseInt(part, 10))

  if (
    parts.length !== 3 ||
    parts.some(
      (part) =>
        !Number.isFinite(part) || part < 0,
    )
  ) {
    return null
  }

  const [hours, minutes, seconds] = parts

  return (
    hours * 3600 +
    minutes * 60 +
    seconds
  )
}

function formatCsvRow(row: CsvRow) {
  return row
    .map((value) =>
      escapeCsvCell(String(value)),
    )
    .join(',')
}

function escapeCsvCell(value: string) {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function formatFileTimestamp(date: Date) {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')
  const day = String(date.getDate()).padStart(
    2,
    '0',
  )
  const hour = String(date.getHours()).padStart(
    2,
    '0',
  )
  const minute = String(
    date.getMinutes(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}-${hour}${minute}`
}

function sanitizeFileName(value: string) {
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
