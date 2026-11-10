import { useConnections } from '../stores/ConnectionsContext'
import FitTime from '../components/FitTime'
import WallClock from '../components/WallClock'
import { SubTimerControl, SubTimerHistory } from '../components/SubTimer'
import GuardedAction from '../components/GuardedAction'
import PauseHistory from '../components/PauseHistory'
import {
  formatClockTime,
  formatTimerSeconds,
  getDisplaySeconds,
  getRunElapsedSeconds,
  getPausedMs,
  getRemainingOrDelaySeconds,
} from '../services/TimerEngine'
import { useShowTimerStore } from '../stores/useShowTimerStore'

export default function TimerPage() {
  const { canSendAttention, sendAttention, attentionStatus } = useConnections()
  const {
    project,
    timerRun,
    startShow,
    nextSegment,
    resetRun,
    pauseShow,
    resumeShow,
    updatePauseNote,
  } = useShowTimerStore()

  const currentSegment =
    timerRun.currentSegmentIndex >= 0
      ? project.segments[
          timerRun.currentSegmentIndex
        ]
      : project.segments[0]

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

  const isLastSegment =
    (timerRun.status === 'running' || timerRun.status === 'paused') &&
    timerRun.currentSegmentIndex ===
      project.segments.length - 1

  const plannedEndMs =
    currentSegment &&
    (timerRun.status === 'running' || timerRun.status === 'paused')
      ? timerRun.startedAtMs +
        currentSegment.plannedSeconds * 1000 + getPausedMs(timerRun)
      : 0

  const nextSegmentName =
    !isLastSegment &&
    (timerRun.status === 'running' || timerRun.status === 'paused')
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
    <section className="page timer-page">
      <header className="page-header">
        <h1>
          {project.projectName.trim() ||
            'Untitled Show'}
        </h1>
      </header>

      <div className="timer-clock-row">
      <WallClock />
      <button type="button" disabled={!canSendAttention} onClick={() => sendAttention('screen')} aria-label="Send screen reminder" title={attentionStatus}
        className={
          currentSegment?.type ===
            'intermission' &&
          (timerRun.status === 'running' || timerRun.status === 'paused')
            ? 'timer-display countdown-display attention-trigger'
            : 'timer-display attention-trigger'
        }
      >
        <FitTime>{formatTimerSeconds(displaySeconds)}</FitTime>
      </button>
      <SubTimerControl />
      </div>

      {timerRun.status === 'paused' && <div className="pause-banner" role="status">
        <strong>Show paused</strong>
        <span>Current pause {formatTimerSeconds((timerRun.nowMs - timerRun.pauses.at(-1)!.startedAtMs) / 1000)}</span>
      </div>}
      <div className="page-content">
        <SubTimerHistory />
        {(timerRun.status === 'running' || timerRun.status === 'paused') &&
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
              <PauseHistory pauses={timerRun.pauses} nowMs={timerRun.nowMs} onNote={updatePauseNote} />

              <div className="timer-stat-grid">
                <div className="timer-stat">
                  <span>Started At</span>

                  <strong>
                    <FitTime>{formatClockTime(
                      timerRun.startedAtMs,
                    )}</FitTime>
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
                        <FitTime>{formatTimerSeconds(
                          getRemainingOrDelaySeconds(
                            currentSegment,
                            elapsedSeconds,
                          ),
                        )}</FitTime>
                      </strong>
                    </div>

                    <div className="timer-stat">
                      <span>Planned End</span>

                      <strong>
                        <FitTime>{formatClockTime(
                          plannedEndMs,
                        )}</FitTime>
                      </strong>
                    </div>
                  </>
                )}

                <div className="timer-stat elapsed-stat">
                  <span>Net show time</span>

                  <strong>
                    <FitTime>{formatTimerSeconds(
                      elapsedSeconds,
                    )}</FitTime>
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
            Go to Tools and add an Act or
            Intermission.
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
          <p>No show segments yet.</p>
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

                  {(timerRun.status === 'running' || timerRun.status === 'paused') &&
                  segment.id ===
                    currentSegment?.id ? (
                    <span>{timerRun.status === 'paused' ? 'Paused' : 'Running'}</span>
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
          <p>No completed segments yet.</p>
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

                <div>
                  <span>Net show {formatTimerSeconds(result.elapsedSeconds)}</span>
                  <span className="segment-meta inline-meta">Paused {formatTimerSeconds(result.pausedSeconds ?? 0)} · Total time {formatTimerSeconds(result.totalSeconds ?? result.elapsedSeconds)}</span>
                  <PauseHistory pauses={result.pauses ?? []} nowMs={timerRun.nowMs} onNote={updatePauseNote} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="timer-action-bar" key={`${project.projectId}:${currentSegment?.id}:${timerRun.status}:${timerRun.startedAtIso}`}>
        {timerRun.status === 'running' && <GuardedAction className="secondary-button pause-button" onClick={pauseShow}>Pause</GuardedAction>}
        {timerRun.status === 'paused' && <>
          <GuardedAction className="primary-button" onClick={resumeShow}>Resume</GuardedAction>
          <GuardedAction className="secondary-button" confirmation="End the pause and finish this segment? The current pause will be recorded." onClick={nextSegment}>Finish segment</GuardedAction>
        </>}
        {timerRun.status === 'paused' ? null : <>
        {timerRun.status === 'running' ? (
          <GuardedAction
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
          </GuardedAction>
        ) : (
          <GuardedAction
            className="primary-button"
            type="button"
            disabled={
              project.segments.length === 0 || timerRun.status === 'finished'
            }
            onClick={startShow}
          >
            {currentSegment
              ? `Start ${currentSegment.name}`
              : 'Start'}
          </GuardedAction>
        )}

        {timerRun.status === 'finished' && (
          <GuardedAction
            className="secondary-button"
            type="button"
            onClick={resetRun}
          >
            Reset Run
          </GuardedAction>
        )}
        </>}
      </div>
    </section>
  )
}
