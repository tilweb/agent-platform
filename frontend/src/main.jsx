import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { installiereEingabeModus } from './utils/eingabeModus'

// Fokus-Rahmen nur bei Tastatur-Navigation (siehe utils/eingabeModus.js)
installiereEingabeModus()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
