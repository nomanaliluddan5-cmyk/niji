import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppFrame } from './app/AppFrame'
import { currentAccount } from './lib/accounts'
import { LandingPage } from './landing/LandingPage'

export type AppTab = 'save' | 'folders' | 'daily' | 'play'

const NavContext = createContext<(href: string) => void>(() => {})

export function useGo() {
  return useContext(NavContext)
}

export function tabFromPath(pathname: string): AppTab | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/app' || path === '/app/save') return 'save'
  if (path === '/app/folders') return 'folders'
  if (path === '/app/daily') return 'daily'
  if (path === '/app/play') return 'play'
  return null
}

export function pathForTab(tab: AppTab) {
  return `/app/${tab}`
}

export function Router() {
  const [path, setPath] = useState(() => window.location.pathname)
  const [authed, setAuthed] = useState(() => Boolean(currentAccount()))

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname)
      setAuthed(Boolean(currentAccount()))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = (href: string) => {
    window.history.pushState({}, '', href)
    setPath(window.location.pathname)
    setAuthed(Boolean(currentAccount()))
  }

  const tab = tabFromPath(path)
  let screen: ReactNode
  if (tab && authed) screen = <AppFrame tab={tab} />
  else screen = <LandingPage lockedNotice={Boolean(tab && !authed)} />

  return <NavContext.Provider value={go}>{screen}</NavContext.Provider>
}
