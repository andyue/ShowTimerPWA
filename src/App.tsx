import { useState } from 'react'
import TimerPage from './pages/TimerPage'
import QMarkPage from './pages/QMarkPage'
import ToolsPage from './pages/ToolsPage'
import './App.css'

type PageName = 'tools' | 'timer' | 'qmarks'

function App() {
  const [selectedPage, setSelectedPage] =
    useState<PageName>('timer')

  return (
    <main className="app">
      <div className="desktop-layout">
        <aside className="tools-column">
          <ToolsPage />
        </aside>

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