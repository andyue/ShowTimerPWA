import ConnectionsProvider from './stores/ConnectionsProvider'
import ViewerPage from './pages/ViewerPage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import LanLanding from './pages/LanLanding'
import { ShowTimerProvider } from './stores/ShowTimerStore'

import './index.css'
import './App.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.hash.slice(1)).has('watch') ? <ViewerPage /> : !window.isSecureContext ? <LanLanding /> : <ShowTimerProvider>
      <ConnectionsProvider><App /></ConnectionsProvider>
    </ShowTimerProvider>}
  </StrictMode>,
)