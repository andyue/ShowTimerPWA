import { useConnections } from '../stores/ConnectionsContext'
import MarkTimeEditor from '../components/MarkTimeEditor'
import FitTime from '../components/FitTime'
import { useTagFilter } from '../services/useTagFilter'
import WallClock from '../components/WallClock'
import { TagChoices, TagDropdown } from '../components/CueTags'
import { matchesTags, cueRowBackground } from '../services/CueTags'
import { SubTimerControl } from '../components/SubTimer'
import { sortCueMarks } from '../services/CueMarkOrder'
import {
  useEffect,
  useMemo,
  useRef,
} from 'react'

import {
  formatTimerSeconds,
  getDisplaySeconds,
  getRunElapsedSeconds,
} from '../services/TimerEngine'
import { useShowTimerStore } from '../stores/useShowTimerStore'

export default function QMarkPage() {
  const { canSendAttention, sendAttention, attentionStatus } = useConnections()
  const {
    project,
    timerRun,
    addCueMark,
    updateCueMarkNote,
    deleteCueMark,
    moveCueMark,
    setCueMarkTags,
    updateCueMarkTime,
    setSelectedTagIds,
  } = useShowTimerStore()

  const [filter, setFilter] = useTagFilter(`qmarks:${project.projectId}`)
  const tags = project.cueTags ?? []
  const effectiveFilter = filter.filter(id => id === 'untagged' || tags.some(tag => tag.id === id))

  const canAddCueMark =
    timerRun.status === 'running'

  const currentSegment =
    (timerRun.status === 'running' || timerRun.status === 'paused')
      ? project.segments[
          timerRun.currentSegmentIndex
        ]
      : undefined

  const elapsedSeconds =
    (timerRun.status === 'running' || timerRun.status === 'paused')
      ? getRunElapsedSeconds(
          timerRun,
          timerRun.nowMs,
        )
      : 0

  const displaySeconds =
    (timerRun.status === 'running' || timerRun.status === 'paused')
      ? getDisplaySeconds(
          currentSegment,
          elapsedSeconds,
        )
      : 0

  const sortedCueMarks = useMemo(
    () => sortCueMarks(project.cueMarks),
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
        <div className="mark-filter qmark-top-filter" aria-label="Q Mark filter" title="Selected tags also apply to new Q Marks. All or Untagged creates untagged marks.">
          <span>Show tags</span><TagChoices tags={tags} selected={effectiveFilter} onChange={ids => { setFilter(ids); setSelectedTagIds(ids.filter(id => id !== 'untagged')) }} filter />
        </div>
        <div className="qmark-mobile-clock-row">
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

            <strong>{currentSegment.name}{timerRun.status === 'paused' ? ' · Paused' : ''}</strong>

            <WallClock />
            <div className="qmark-live-time">
              <FitTime>{formatTimerSeconds(displaySeconds)}</FitTime>
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

            <WallClock />
            <div className="qmark-live-time muted-time">
              <FitTime>00:00:00</FitTime>
            </div>
          </section>
        )}

        <SubTimerControl />
        </div>

        <div className="qmark-table-frame">
          <table className="qmark-table">
            <thead>
              <tr>
                <th scope="col" className="qmark-order-cell" aria-label="Reorder" />
                <th scope="col">M</th>
                <th scope="col">Time</th>
                <th scope="col">Act</th>
                <th scope="col">Note</th>
                <th scope="col" aria-label="Color">Color</th>
                <th scope="col" aria-label="Delete">×</th>
              </tr>
            </thead>

            <tbody>
              {sortedCueMarks.filter(mark => matchesTags(mark, effectiveFilter, tags)).length === 0 ? (
                <tr>
                  <td
                    className="qmark-empty-cell"
                    colSpan={7}
                  >
                    No matching Q Marks.
                  </td>
                </tr>
              ) : (
                sortedCueMarks.map(
                  (cueMark, index) => matchesTags(cueMark, effectiveFilter, tags) && (
                    <tr
                      key={cueMark.id}
                      style={{ backgroundImage: cueRowBackground(cueMark, tags) }}
                      ref={
                        cueMark.id ===
                        newestCueMarkId
                          ? newestCueMarkRef
                          : undefined
                      }
                    >
                      <td className="qmark-order-cell">
                        <div className="qmark-order-controls">
                          <button type="button" aria-label={`Move up Q${index + 1}`} disabled={index === 0} onClick={() => moveCueMark(cueMark.id, 'up')}>↑</button>
                          <button type="button" aria-label={`Move down Q${index + 1}`} disabled={index === sortedCueMarks.length - 1} onClick={() => moveCueMark(cueMark.id, 'down')}>↓</button>
                        </div>
                      </td>
                      <td><button type="button" className="cue-reminder-trigger" disabled={!canSendAttention} title={attentionStatus} aria-label={`Remind viewers of Q${index + 1}`} onClick={() => sendAttention('cue', cueMark.id)}>{index + 1}</button></td>

                      <td className="qmark-table-time">
                        <MarkTimeEditor seconds={cueMark.elapsedSeconds} number={index + 1} onChange={seconds => updateCueMarkTime(cueMark.id, seconds)} />
                      </td>

                      <td className="qmark-table-act">
                        <span className="qmark-table-act-text">
                          {cueMark.segmentName}
                        </span>
                      </td>

                      <td>
                        <label
                          className="qmark-table-note"
                          data-note={cueMark.note || `Q${index + 1}`}
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

                      <td className="qmark-color-cell">
                        <TagDropdown tags={tags} mark={cueMark} number={index + 1} onChange={ids => setCueMarkTags(cueMark.id, ids)} />
                      </td>
                      <td className="qmark-delete-cell">
                        <button
                          className="danger-button qmark-delete-button"
                          aria-label="Delete" title={`Delete Q${index + 1}`}
                          type="button"
                          onClick={() =>
                            deleteCueMark(
                              cueMark.id,
                            )
                          }
                        >
                          ×
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
        onClick={() => addCueMark(effectiveFilter.filter(id => id !== 'untagged'))}
      >
        Add Mark
      </button>
    </section>
  )
}
