import { useState } from 'react'
import TimerPage from './pages/TimerPage'
import QMarkPage from './pages/QMarkPage'
import ToolsPage from './pages/ToolsPage'
import './App.css'

type PageName = 'tools' | 'timer' | 'qmarks'

function App() {
  const [selectedPage, setSelectedPage] =
    useState<PageName>('timer')
  const [isToolsHidden, setIsToolsHidden] =
    useState(false)

  return (
    <main className="app">
      <div
        className={
          isToolsHidden
            ? 'desktop-layout tools-hidden'
            : 'desktop-layout'
        }
      >
        <aside className="tools-column">
          <ToolsPage />
        </aside>

        <button
          className="tools-toggle"
          type="button"
          aria-label={
            isToolsHidden
              ? 'Show tools panel'
              : 'Hide tools panel'
          }
          aria-expanded={!isToolsHidden}
          title={
            isToolsHidden
              ? 'Show Tools'
              : 'Hide Tools'
          }
          onClick={() =>
            setIsToolsHidden(
              (currentValue) => !currentValue,
            )
          }
        >
          {isToolsHidden ? 'Tools' : 'Hide'}
        </button>

        <section className="timer-column">
          <TimerPage />
        </section>

        <section className="qmark-column">
          <QMarkPage />
        </section>
      </div>

      <div className="mobile-layout">
        <div className="mobile-page">
          {selectedPage === 'tools' && <ToolsPage />}
          {selectedPage === 'timer' && <TimerPage />}
          {selectedPage === 'qmarks' && <QMarkPage />}
        </div>

        <nav className="tab-bar">
          <button
            className={selectedPage === 'tools' ? 'active' : ''}
            onClick={() => setSelectedPage('tools')}
            type="button"
          >
            Tools
          </button>

          <button
            className={selectedPage === 'timer' ? 'active' : ''}
            onClick={() => setSelectedPage('timer')}
            type="button"
          >
            Timer
          </button>

          <button
            className={selectedPage === 'qmarks' ? 'active' : ''}
            onClick={() => setSelectedPage('qmarks')}
            type="button"
          >
            Q Marks
          </button>
        </nav>
      </div>
    </main>
  )
}

export default App
