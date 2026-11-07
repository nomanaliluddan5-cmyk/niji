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
  const name = account?.name || 'On this device'
  const leave = () => {
    logoutAccount()
    go('/')
  }
  return (
    <div className="desk">
      <aside className="side">
        <div className="side-brand">
          <span className="mark">Niji</span>
          <strong>{name}</strong>
        </div>
        <nav className="side-nav" aria-label="Niji">
          {TABS.map((item) => (
            <TabButton key={item.id} item={item} tab={tab} onPick={(id) => go(pathForTab(id))} />
          ))}
        </nav>
        <button type="button" className="text-btn side-foot" onClick={leave}>
          Log out
        </button>
      </aside>
      <div className="phone">
        <header className="phone-top">
          <div>
            <p>Niji</p>
            <strong>{name}</strong>
          </div>
          <button type="button" className="text-btn" onClick={leave}>
            Log out
          </button>
        </header>
        <main className="phone-main">
          {tab === 'save' ? <SaveScreen /> : null}
          {tab === 'folders' ? <FoldersScreen /> : null}
          {tab === 'daily' ? <DailyScreen /> : null}
          {tab === 'play' ? <PlayScreen /> : null}
        </main>
        <nav className="tabbar" aria-label="Niji">
          {TABS.map((item) => (
            <TabButton key={item.id} item={item} tab={tab} onPick={(id) => go(pathForTab(id))} />
          ))}
        </nav>
      </div>
    </div>
  )
}

function TabButton({
  item,
  tab,
  onPick,
}: {
  item: (typeof TABS)[number]
  tab: AppTab
  onPick: (id: AppTab) => void
}) {
  const Icon = item.icon
  const on = tab === item.id
  return (
    <button type="button" className={on ? 'tab on' : 'tab'} aria-current={on ? 'page' : undefined} onClick={() => onPick(item.id)}>
      <Icon size={18} />
      {item.label}
    </button>
  )
}
