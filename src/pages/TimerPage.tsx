import {
  formatClockTime,
  formatTimerSeconds,
  getDisplaySeconds,
  getElapsedSeconds,
  getRemainingOrDelaySeconds,
} from '../services/TimerEngine'
import { useShowTimerStore } from '../stores/useShowTimerStore'

export default function TimerPage() {
  const {
    project,
    timerRun,
    startShow,
    nextSegment,
    resetRun,
  } = useShowTimerStore()

  const currentSegment =
    timerRun.currentSegmentIndex >= 0
      ? project.segments[
          timerRun.currentSegmentIndex
        ]
      : project.segments[0]

  const elapsedSeconds =
    timerRun.status === 'running'
      ? getElapsedSeconds(
          timerRun.startedAtMs,
          timerRun.nowMs,
        )
      : 0

  const displaySeconds =
    timerRun.status === 'running'
      ? getDisplaySeconds(
          currentSegment,
          elapsedSeconds,
        )
      : 0

  const isLastSegment =
    timerRun.status === 'running' &&
    timerRun.currentSegmentIndex ===
      project.segments.length - 1

  const plannedEndMs =
    currentSegment &&
    timerRun.status === 'running'
      ? timerRun.startedAtMs +
        currentSegment.plannedSeconds * 1000
      : 0

  const nextSegmentName =
    !isLastSegment &&
    timerRun.status === 'running'
      ? project.segments[
          timerRun.currentSegmentIndex + 1
        ]?.name
      : undefined

  const currentSegmentNumber =
    timerRun.currentSegmentIndex >= 0
      ? timerRun.currentSegmentIndex + 1
      : project.segments.length > 0
        ? 1
        : 0

  return (
    <section className="page">
      <header className="page-header">
        <h1>
          {project.projectName.trim() ||
            'Untitled Show'}
        </h1>
      </header>

      <div
        className={
          currentSegment?.type ===
            'intermission' &&
          timerRun.status === 'running'
            ? 'timer-display countdown-display'
            : 'timer-display'
        }
      >
        {formatTimerSeconds(displaySeconds)}
      </div>

      <div className="page-content">
        {timerRun.status === 'running' &&
          currentSegment && (
            <section
              className={
                currentSegment.type ===
                'intermission'
                  ? 'running-summary intermission-summary'
                  : 'running-summary'
              }
            >
              <h2>{currentSegment.name}</h2>

              <div className="timer-stat-grid">
                <div className="timer-stat">
                  <span>Started At</span>

                  <strong>
                    {formatClockTime(
                      timerRun.startedAtMs,
                    )}
                  </strong>
                </div>

                {currentSegment.type ===
                  'intermission' && (
                  <>
                    <div className="timer-stat emphasis-stat">
                      <span>
                        Remaining / Delay
                      </span>

                      <strong>
                        {formatTimerSeconds(
                          getRemainingOrDelaySeconds(
                            currentSegment,
                            elapsedSeconds,
                          ),
                        )}
                      </strong>
                    </div>

                    <div className="timer-stat">
                      <span>Planned End</span>

                      <strong>
                        {formatClockTime(
                          plannedEndMs,
                        )}
                      </strong>
                    </div>
                  </>
                )}

                <div className="timer-stat elapsed-stat">
                  <span>Elapsed</span>

                  <strong>
                    {formatTimerSeconds(
                      elapsedSeconds,
                    )}
                  </strong>
                </div>
              </div>
            </section>
          )}

        <h2>Current Segment</h2>

        {currentSegment ? (
          <div className="current-segment-card">
            <div>
              <strong>{currentSegment.name}</strong>

              {currentSegmentNumber > 0 && (
                <span className="segment-meta inline-meta">
                  Segment {currentSegmentNumber}{' '}
                  of {project.segments.length}
                </span>
              )}
            </div>

            <span>
              {currentSegment.type === 'act'
                ? 'Act'
                : 'Intermission'}
            </span>
          </div>
        ) : (
          <p>
            請先到 Tools 新增 Act 或
            Intermission。
          </p>
        )}

        {timerRun.status === 'finished' && (
          <p className="section-note success-note">
            Show completed. Results are saved
            in this Show File.
          </p>
        )}

        <h2>Show Review</h2>

        {project.segments.length === 0 ? (
          <p>目前還沒有演出段落。</p>
        ) : (
          <div className="review-list">
            {project.segments.map(
              (segment, index) => (
                <div
                  className="review-row"
                  key={segment.id}
                >
                  <div>
                    <span>{segment.name}</span>

                    <span className="segment-meta inline-meta">
                      {segment.type === 'act'
                        ? 'Act'
                        : `Intermission ${formatTimerSeconds(
                            segment.plannedSeconds,
                          )}`}
                    </span>
                  </div>

                  {timerRun.status ===
                    'running' &&
                  segment.id ===
                    currentSegment?.id ? (
                    <span>Running</span>
                  ) : timerRun.status ===
                      'idle' &&
                    timerRun.currentSegmentIndex ===
                      index ? (
                    <span>Ready</span>
                  ) : (
                    <span>#{index + 1}</span>
                  )}
                </div>
              ),
            )}
          </div>
        )}

        <h2>Completed Results</h2>

        {project.results.length === 0 ? (
          <p>目前還沒有完成的 Segment。</p>
        ) : (
          <div className="review-list">
            {project.results.map((result) => (
              <div
                className="review-row"
                key={result.id}
              >
                <div>
                  <span>
                    {result.segmentName}
                  </span>

                  <span className="segment-meta inline-meta">
                    {result.segmentType ===
                    'act'
                      ? 'Act'
                      : 'Intermission'}
                  </span>
                </div>

                <span>
                  {formatTimerSeconds(
                    result.elapsedSeconds,
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="timer-action-bar">
        {timerRun.status === 'running' ? (
          <button
            className="primary-button"
            type="button"
            onClick={nextSegment}
          >
            {isLastSegment
              ? 'Finish'
              : `Next${
                  nextSegmentName
                    ? `: ${nextSegmentName}`
                    : ''
                }`}
          </button>
        ) : (
          <button
            className="primary-button"
            type="button"
            disabled={
              project.segments.length === 0
            }
            onClick={startShow}
          >
            {currentSegment
              ? `Start ${currentSegment.name}`
              : 'Start'}
          </button>
        )}

        {timerRun.status === 'finished' && (
          <button
            className="secondary-button"
            type="button"
            onClick={resetRun}
          >
            Reset Run
          </button>
        )}
      </div>
    </section>
  )
}
