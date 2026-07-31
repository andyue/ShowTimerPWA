import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ShowTimerProvider } from './stores/ShowTimerStore'

import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShowTimerProvider>
      <App />
    </ShowTimerProvider>
  </StrictMode>,
)