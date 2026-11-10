import { CueTagManager } from '../components/CueTags'
import ConnectionsPanel from '../components/ConnectionsPanel'
import {
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import { useShowTimerStore } from '../stores/useShowTimerStore'

export default function ToolsPage() {
  const {
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
  } = useShowTimerStore()

  const isActive = timerRun.status === 'running' || timerRun.status === 'paused'

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
      'Importing JSON will replace the current Show File. Continue?',
    )

    if (!confirmed) {
      return
    }

    try {
      await importJson(file)

      setImportMessage(
        'Show File imported.',
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Show File import failed.'

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
      'Importing Excel CSV will replace the current Show File. Continue?',
    )

    if (!confirmed) {
      return
    }

    try {
      await importExcel(file)

      setImportMessage(
        'Excel CSV imported.',
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Excel CSV import failed.'

      setImportMessage(message)

      window.alert(message)
    }
  }

  function handleResetShow() {
    const confirmed = window.confirm(
      'Reset this show run? Segments and Q Marks will be kept. Results and timers will be reset.',
    )

    if (confirmed) {
      resetShow()
    }
  }

  function handleResetProject() {
    const confirmed = window.confirm(
      'Clear the current Show File?',
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
              disabled={isActive}
              onClick={addAct}
            >
              Add Act
            </button>

            <button
              type="button"
              disabled={isActive}
              onClick={addIntermission}
            >
              Add Intermission
            </button>
          </div>

          {project.segments.length === 0 ? (
            <p className="empty-message">
              No segments yet.
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
                        disabled={isActive || index === 0}
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
                          isActive || index ===
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
                        disabled={isActive}
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

        <CueTagManager />

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
            Excel import and export use CSV files, which can be opened in Excel.
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
              Keep the show name, segments and Q Marks. Clear results and reset timers for this run.
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
        <ConnectionsPanel />
        <section className="tool-section resource-links">
          <h2>Downloads and help</h2>
          <a href="https://github.com/andyue/ShowTimerPWA" target="_blank" rel="noopener noreferrer">GitHub project and companion tools ↗</a>
          <p className="section-note">LAN launchers, the OSC bridge and setup guides are in the project. On GitHub, choose Code → Download ZIP.</p>
          <a href="https://github.com/andyue/ShowTimerPWA/blob/main/docs/lan.md" target="_blank" rel="noopener noreferrer">LAN broadcast guide ↗</a>
          <div className="button-row">
            <a href={`https://andyue.github.io/ShowTimerPWA/downloads/Update-ShowTimer-Windows.cmd`} download>Download Windows updater</a>
            <a href={`https://andyue.github.io/ShowTimerPWA/downloads/Update-ShowTimer-Mac.command`} download>Download Mac updater</a>
          </div>
          <div className="button-row">
            <a href="https://andyue.github.io/ShowTimerPWA/downloads/Update-OSC-Windows.cmd" download>Download Windows OSC installer/updater</a>
            <a href="https://andyue.github.io/ShowTimerPWA/downloads/Update-OSC-Mac.command" download>Download Mac OSC installer/updater</a>
          </div>
          <p className="section-note">Back up your Show File and stop the LAN host and OSC before updating. The updater installs the latest tested release and keeps the old version. See the LAN guide for first-time Mac setup.</p>
          <a href="https://nodejs.org/download/release/latest-v24.x/" target="_blank" rel="noopener noreferrer">Download Node.js 24 ↗</a>
          <p className="section-note">Install Node.js 24 on the host computer. Usually choose x64.msi for Windows or .pkg for Mac. Downloads require internet access.</p>
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
