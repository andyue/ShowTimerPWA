import {
  useEffect,
  useMemo,
  useRef,
} from 'react'

import {
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

  const sortedCueMarks = useMemo(
    () =>
      [...project.cueMarks].sort(
        (first, second) => {
          const segmentOrderDifference =
            first.segmentOrder -
            second.segmentOrder

          if (
            segmentOrderDifference !== 0
          ) {
            return segmentOrderDifference
          }

          const elapsedDifference =
            first.elapsedSeconds -
            second.elapsedSeconds

          if (elapsedDifference !== 0) {
            return elapsedDifference
          }

          return (
            new Date(
              first.createdAt,
            ).getTime() -
            new Date(
              second.createdAt,
            ).getTime()
          )
        },
      ),
    [project.cueMarks],
  )

  const newestCueMarkId = useMemo(
    () =>
      project.cueMarks.reduce(
        (newestId, cueMark) => {
          if (!newestId) {
            return cueMark.id
          }

          const newestCueMark =
            project.cueMarks.find(
              (candidate) =>
                candidate.id === newestId,
            )

          if (!newestCueMark) {
            return cueMark.id
          }

          return new Date(
            cueMark.createdAt,
          ).getTime() >
            new Date(
              newestCueMark.createdAt,
            ).getTime()
            ? cueMark.id
            : newestId
        },
        '',
      ),
    [project.cueMarks],
  )

  const newestCueMarkRef =
    useRef<HTMLTableRowElement | null>(null)

  const previousCueMarkCountRef = useRef(
    project.cueMarks.length,
  )

  useEffect(() => {
    if (
      project.cueMarks.length >
      previousCueMarkCountRef.current
    ) {
      newestCueMarkRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }

    previousCueMarkCountRef.current =
      project.cueMarks.length
  }, [project.cueMarks.length, newestCueMarkId])

  return (
    <section className="page qmark-page">
      <div className="page-content qmark-page-content">
        {currentSegment ? (
          <section
            className={
              currentSegment.type ===
              'intermission'
                ? 'qmark-mobile-timer-panel qmark-countdown-panel'
                : 'qmark-mobile-timer-panel'
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
          <section className="qmark-mobile-timer-panel">
            <span className="segment-meta">
              Timer
            </span>

            <strong>Not Running</strong>

            <div className="qmark-live-time muted-time">
              00:00:00
            </div>
          </section>
        )}

        <div className="qmark-table-frame">
          <table className="qmark-table">
            <thead>
              <tr>
                <th scope="col">M</th>
                <th scope="col">Time</th>
                <th scope="col">Act</th>
                <th scope="col">Note</th>
                <th scope="col">Delete</th>
              </tr>
            </thead>

            <tbody>
              {sortedCueMarks.length === 0 ? (
                <tr>
                  <td
                    className="qmark-empty-cell"
                    colSpan={5}
                  >
                    目前還沒有 Q Mark。
                  </td>
                </tr>
              ) : (
                sortedCueMarks.map(
                  (cueMark, index) => (
                    <tr
                      key={cueMark.id}
                      ref={
                        cueMark.id ===
                        newestCueMarkId
                          ? newestCueMarkRef
                          : undefined
                      }
                    >
                      <td>{index + 1}</td>

                      <td className="qmark-table-time">
                        {formatTimerSeconds(
                          cueMark.elapsedSeconds,
                        )}
                      </td>

                      <td className="qmark-table-act">
                        <span className="qmark-table-act-text">
                          {cueMark.segmentName}
                        </span>
                      </td>

                      <td>
                        <label
                          className="qmark-table-note"
                          aria-label={`${cueMark.label} note`}
                        >
                          <textarea
                            value={cueMark.note}
                            placeholder={
                              `Q${index + 1}`
                            }
                            rows={1}
                            onChange={(
                              event,
                            ) =>
                              updateCueMarkNote(
                                cueMark.id,
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </td>

                      <td>
                        <button
                          className="danger-button qmark-delete-button"
                          type="button"
                          onClick={() =>
                            deleteCueMark(
                              cueMark.id,
                            )
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        className="primary-button qmark-mark-button"
        type="button"
        disabled={!canAddCueMark}
        onClick={addCueMark}
      >
        Add Mark
      </button>
    </section>
  )
}
