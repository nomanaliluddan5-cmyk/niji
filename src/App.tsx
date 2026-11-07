import { StoreProvider } from './store'
import { Router } from './router'

export function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}
