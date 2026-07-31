import {
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import { useShowTimerStore } from '../stores/useShowTimerStore'

export default function ToolsPage() {
  const {
    project,
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
  } = useShowTimerStore()

  const jsonFileInputRef =
    useRef<HTMLInputElement>(null)
  const excelFileInputRef =
    useRef<HTMLInputElement>(null)

  const [importMessage, setImportMessage] =
    useState('')

  async function handleJsonImport(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    const confirmed = window.confirm(
      '匯入 JSON 會取代目前的 Show File。確定要繼續嗎？',
    )

    if (!confirmed) {
      return
    }

    try {
      await importJson(file)

      setImportMessage(
        'Show File 匯入成功。',
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Show File 匯入失敗。'

      setImportMessage(message)

      window.alert(message)
    }
  }

  async function handleExcelImport(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    const confirmed = window.confirm(
      '匯入 Excel CSV 會取代目前的 Show File。確定要繼續嗎？',
    )

    if (!confirmed) {
      return
    }

    try {
      await importExcel(file)

      setImportMessage(
        'Excel CSV 匯入成功。',
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Excel CSV 匯入失敗。'

      setImportMessage(message)

      window.alert(message)
    }
  }

  function handleResetShow() {
    const confirmed = window.confirm(
      '確定要重置本輪 Show 嗎？Segments 和 Q Marks 會保留，只會清除 Results 並重置計時。',
    )

    if (confirmed) {
      resetShow()
    }
  }

  function handleResetProject() {
    const confirmed = window.confirm(
      '確定要清除目前的 Show File 嗎？',
    )

    if (confirmed) {
      resetProject()
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Tools</h1>
      </header>

      <div className="page-content tool-content">
        <section className="tool-section">
          <h2>Show File</h2>

          <label className="field">
            <span>Show File Name</span>

            <input
              type="text"
              value={project.projectName}
              placeholder="Untitled Show"
              onChange={(event) =>
                setProjectName(event.target.value)
              }
            />
          </label>
        </section>

        <section className="tool-section">
          <div className="section-heading">
            <h2>Segment Setup</h2>

            <span>
              {project.segments.length} Segments
            </span>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={addAct}
            >
              Add Act
            </button>

            <button
              type="button"
              onClick={addIntermission}
            >
              Add Intermission
            </button>
          </div>

          {project.segments.length === 0 ? (
            <p className="empty-message">
              目前還沒有 Segment。
            </p>
          ) : (
            <div className="segment-list">
              {project.segments.map(
                (segment, index) => (
                  <article
                    className="segment-editor"
                    key={segment.id}
                  >
                    <div className="segment-order">
                      {index + 1}
                    </div>

                    <div className="segment-editor-content">
                      <label className="field compact-field">
                        <span>
                          {segment.type === 'act'
                            ? 'Act Name'
                            : 'Intermission Name'}
                        </span>

                        <input
                          type="text"
                          value={segment.name}
                          onChange={(event) =>
                            updateSegmentName(
                              segment.id,
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      {segment.type ===
                        'intermission' && (
                        <DurationEditor
                          totalSeconds={
                            segment.plannedSeconds
                          }
                          onChange={(seconds) =>
                            updateSegmentDuration(
                              segment.id,
                              seconds,
                            )
                          }
                        />
                      )}

                      <div className="segment-type-label">
                        {segment.type === 'act'
                          ? 'Act'
                          : 'Intermission'}
                      </div>
                    </div>

                    <div className="segment-actions">
                      <button
                        type="button"
                        aria-label="Move segment up"
                        title="Move Up"
                        disabled={index === 0}
                        onClick={() =>
                          moveSegment(
                            segment.id,
                            'up',
                          )
                        }
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        aria-label="Move segment down"
                        title="Move Down"
                        disabled={
                          index ===
                          project.segments.length - 1
                        }
                        onClick={() =>
                          moveSegment(
                            segment.id,
                            'down',
                          )
                        }
                      >
                        ↓
                      </button>

                      <button
                        className="danger-button"
                        type="button"
                        onClick={() =>
                          deleteSegment(segment.id)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section className="tool-section">
          <h2>Show File Control</h2>

          <div className="file-control-grid">
            <button type="button" disabled>
              Open
            </button>

            <button type="button" disabled>
              Save
            </button>

            <button
              type="button"
              onClick={() =>
                jsonFileInputRef.current?.click()
              }
            >
              Import JSON
            </button>

            <input
              ref={jsonFileInputRef}
              className="hidden-file-input"
              type="file"
              accept=".json,.showtimer.json,application/json"
              onChange={handleJsonImport}
            />

            <button
              type="button"
              onClick={exportJson}
            >
              Export JSON
            </button>

            <button
              type="button"
              onClick={() =>
                excelFileInputRef.current?.click()
              }
            >
              Import Excel
            </button>

            <input
              ref={excelFileInputRef}
              className="hidden-file-input"
              type="file"
              accept=".csv,.showtimer.csv,text/csv"
              onChange={handleExcelImport}
            />

            <button
              type="button"
              onClick={exportExcel}
            >
              Export Excel
            </button>
          </div>

          <p className="section-note">
            Excel 匯入 / 匯出目前支援 CSV，可直接用 Excel 開啟。
          </p>

          {importMessage && (
            <p className="section-note">
              {importMessage}
            </p>
          )}
        </section>

        <section className="tool-section">
          <h2>Reset</h2>

          <div className="reset-control-stack">
            <button
              className="reset-button"
              type="button"
              onClick={handleResetShow}
            >
              Reset Show
            </button>

            <p className="section-note">
              保留 Show File Name、Segments 和 Q Marks，只清除本輪 Results 並重置計時。
            </p>
          </div>

          <button
            className="danger-button reset-button"
            type="button"
            onClick={handleResetProject}
          >
            Reset Show File
          </button>
        </section>
      </div>
    </section>
  )
}

interface DurationEditorProps {
  totalSeconds: number
  onChange: (seconds: number) => void
}

function DurationEditor({
  totalSeconds,
  onChange,
}: DurationEditorProps) {
  const hours = Math.floor(
    totalSeconds / 3600,
  )

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  )

  const seconds = totalSeconds % 60

  function updateDuration(
    nextHours: number,
    nextMinutes: number,
    nextSeconds: number,
  ) {
    const safeHours = clamp(
      nextHours,
      0,
      99,
    )

    const safeMinutes = clamp(
      nextMinutes,
      0,
      59,
    )

    const safeSeconds = clamp(
      nextSeconds,
      0,
      59,
    )

    onChange(
      safeHours * 3600 +
        safeMinutes * 60 +
        safeSeconds,
    )
  }

  return (
    <fieldset className="duration-editor">
      <legend>Planned Duration</legend>

      <label>
        <span>HH</span>

        <input
          type="number"
          min="0"
          max="99"
          value={hours}
          onChange={(event) =>
            updateDuration(
              Number(event.target.value),
              minutes,
              seconds,
            )
          }
        />
      </label>

      <span className="duration-separator">
        :
      </span>

      <label>
        <span>MM</span>

        <input
          type="number"
          min="0"
          max="59"
          value={minutes}
          onChange={(event) =>
            updateDuration(
              hours,
              Number(event.target.value),
              seconds,
            )
          }
        />
      </label>

      <span className="duration-separator">
        :
      </span>

      <label>
        <span>SS</span>

        <input
          type="number"
          min="0"
          max="59"
          value={seconds}
          onChange={(event) =>
            updateDuration(
              hours,
              minutes,
              Number(event.target.value),
            )
          }
        />
      </label>
    </fieldset>
  )
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.min(
    maximum,
    Math.max(minimum, Math.floor(value)),
  )
}
