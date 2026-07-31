import {
  formatClockTime,
  formatTimerSeconds,
  getDisplaySeconds,
  getElapsedSeconds,
} from '../services/TimerEngine'
import { useShowTimerStore } from '../stores/useShowTimerStore'

export default function QMarkPage() {
  const {
    project,
    timerRun,
    addCueMark,
    updateCueMarkNote,
    deleteCueMark,
  } = useShowTimerStore()

  const canAddCueMark =
    timerRun.status === 'running'

  const currentSegment =
    timerRun.status === 'running'
      ? project.segments[
          timerRun.currentSegmentIndex
        ]
      : undefined

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

  const sortedCueMarks = [
    ...project.cueMarks,
  ].sort((first, second) => {
    const segmentOrderDifference =
      first.segmentOrder - second.segmentOrder

    if (segmentOrderDifference !== 0) {
      return segmentOrderDifference
    }

    const elapsedDifference =
      first.elapsedSeconds - second.elapsedSeconds

    if (elapsedDifference !== 0) {
      return elapsedDifference
    }

    return (
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime()
    )
  })

  return (
    <section className="page">
      <header className="page-header">
        <h1>Q Marks</h1>
      </header>

      <div className="page-content">
        {currentSegment ? (
          <section
            className={
              currentSegment.type ===
              'intermission'
                ? 'qmark-timer-panel qmark-countdown-panel'
                : 'qmark-timer-panel'
            }
          >
            <span className="segment-meta">
              {currentSegment.type === 'act'
                ? 'Act'
                : 'Intermission'}
            </span>

            <strong>{currentSegment.name}</strong>

            <div className="qmark-live-time">
              {formatTimerSeconds(displaySeconds)}
            </div>

            {currentSegment.type ===
              'intermission' && (
              <span className="segment-meta">
                Remaining
              </span>
            )}
          </section>
        ) : (
          <section className="qmark-timer-panel">
            <span className="segment-meta">
              Timer
            </span>

            <strong>Not Running</strong>

            <div className="qmark-live-time muted-time">
              00:00:00
            </div>
          </section>
        )}

        {sortedCueMarks.length === 0 ? (
          <p>目前還沒有 Q Mark。</p>
        ) : (
          <div className="qmark-list">
            {sortedCueMarks.map((cueMark) => (
              <article
                className="qmark-row"
                key={cueMark.id}
              >
                <div className="qmark-main">
                  <div>
                    <strong>{cueMark.label}</strong>

                    <span className="segment-meta inline-meta">
                      {cueMark.segmentName} ·{' '}
                      {cueMark.segmentType === 'act'
                        ? 'Act'
                        : 'Intermission'}
                    </span>
                  </div>

                  <label
                    className="qmark-note-field"
                    aria-label={`${cueMark.label} note`}
                  >
                    <textarea
                      value={cueMark.note}
                      placeholder="Add note"
                      rows={2}
                      onChange={(event) =>
                        updateCueMarkNote(
                          cueMark.id,
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>

                <div className="qmark-side">
                  <div className="qmark-time">
                    <span>
                      {formatTimerSeconds(
                        cueMark.elapsedSeconds,
                      )}
                    </span>

                    <small>
                      {formatClockTime(
                        new Date(
                          cueMark.createdAt,
                        ).getTime(),
                      )}
                    </small>
                  </div>

                  <button
                    className="danger-button qmark-delete-button"
                    type="button"
                    onClick={() =>
                      deleteCueMark(cueMark.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <button
        className="primary-button"
        type="button"
        disabled={!canAddCueMark}
        onClick={addCueMark}
      >
        Add Mark
      </button>
    </section>
  )
}
