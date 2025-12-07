import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializePersistence, setupUnloadHandler } from './shared/storage'

// Initialize persistence before rendering
// This sets up the debounced localStorage subscription
initializePersistence();

// Ensure data is persisted before page unload
setupUnloadHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
