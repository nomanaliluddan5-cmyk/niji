import { Bookmark, FolderLock, LayoutList, Sparkles } from 'lucide-react'
import { currentAccount, logoutAccount } from '../lib/accounts'
import { pathForTab, useGo, type AppTab } from '../router'
import { DailyScreen } from './DailyScreen'
import { FoldersScreen } from './FoldersScreen'
import { PlayScreen } from './PlayScreen'
import { SaveScreen } from './SaveScreen'

const TABS: { id: AppTab; label: string; icon: typeof Bookmark }[] = [
  { id: 'save', label: 'Save', icon: Bookmark },
  { id: 'folders', label: 'Folders', icon: FolderLock },
  { id: 'daily', label: 'Daily', icon: LayoutList },
  { id: 'play', label: 'Play', icon: Sparkles },
]

export function AppFrame({ tab }: { tab: AppTab }) {
  const go = useGo()
  const account = currentAccount()
  return (
    <div className="desk">
      <div className="phone">
        <header className="phone-top">
          <div>
            <p>Niji</p>
            <strong>{account?.name || 'On this device'}</strong>
          </div>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              logoutAccount()
              go('/')
            }}
          >
            Log out
          </button>
        </header>
        <main className="phone-main">
          {tab === 'save' ? <SaveScreen /> : null}
          {tab === 'folders' ? <FoldersScreen /> : null}
          {tab === 'daily' ? <DailyScreen /> : null}
          {tab === 'play' ? <PlayScreen /> : null}
        </main>
        <nav className="tabbar" aria-label="App">
          {TABS.map((item) => {
            const Icon = item.icon
            const on = tab === item.id
            return (
              <button key={item.id} type="button" className={on ? 'tab on' : 'tab'} aria-current={on ? 'page' : undefined} onClick={() => go(pathForTab(item.id))}>
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
