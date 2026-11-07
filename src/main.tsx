import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/index.css'
import '@fontsource-variable/inter/index.css'
import './index.css'
import { App } from './App'
import { migrateLegacyAccounts } from './lib/accounts'

void migrateLegacyAccounts()

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
