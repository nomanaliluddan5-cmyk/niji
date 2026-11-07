import { useState, type FormEvent } from 'react'
import { useStore, type FolderSession } from '../store'
import type { PrivacyFolder } from '../types'

const ACCENTS = ['#e7a15a', '#d26a45', '#c46b8a', '#7d9a6a', '#6f8fbf', '#c9a06a']

export function FoldersScreen() {
  const store = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [session, setSession] = useState<FolderSession | null>(null)
  const open = store.data.folders.find((folder) => folder.id === openId) ?? null

  if (!open) {
    return (
      <div className="shelf-screen">
        <p className="kicker">Each lock is its own</p>
        <h1>Folders</h1>
        <CreateFolder onCreate={() => setOpenId(null)} />
        {store.migrating ? <p className="quiet">Encrypting folders from an earlier version…</p> : null}
        <div className="shelf">
          {store.data.folders.length === 0 ? <p className="quiet">Create a folder and give it a password.</p> : null}
          {store.data.folders.map((folder) => (
            <button key={folder.id} type="button" className="folder-tab" style={{ ['--accent' as string]: folder.accent }} onClick={() => { setOpenId(folder.id); setSession(null) }}>
              <i />
              <strong>{folder.hideTitles ? 'Private folder' : folder.name}</strong>
              <span>{folder.itemCount} saved</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (session?.id !== open.id) {
    return <LockGate folder={open} onBack={() => setOpenId(null)} onUnlock={setSession} />
  }

  return (
    <FolderInside
      folder={open}
      session={session}
      onSession={setSession}
      onBack={() => { setOpenId(null); setSession(null) }}
      onLock={() => setSession(null)}
    />
  )
}

function CreateFolder({ onCreate }: { onCreate: () => void }) {
  const { addFolder } = useStore()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [accent, setAccent] = useState(ACCENTS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!name.trim()) { setError('Name the folder.'); return }
    if (password.length < 4) { setError('Use a password of at least 4 characters.'); return }
    setBusy(true)
    await addFolder({ name: name.trim(), password, accent, note: '' })
    setBusy(false)
    setName('')
    setPassword('')
    setError('')
    onCreate()
  }
  return (
    <form className="folder-create" onSubmit={submit}>
      {error ? <p className="error-text">{error}</p> : null}
      <label>New folder<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Travel, letters, taxes" /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <div className="swatches">
        {ACCENTS.map((color) => (
          <button key={color} type="button" className={accent === color ? 'swatch on' : 'swatch'} style={{ background: color }} aria-label={color} onClick={() => setAccent(color)} />
        ))}
      </div>
      <button type="submit" className="solid" disabled={busy}>Create folder</button>
    </form>
  )
}

function LockGate({ folder, onBack, onUnlock }: { folder: PrivacyFolder; onBack: () => void; onUnlock: (session: FolderSession) => void }) {
  const { unlockFolder } = useStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form className="lock-gate" style={{ ['--accent' as string]: folder.accent }} onSubmit={async (event) => {
      event.preventDefault()
      if (busy) return
      setBusy(true)
      const session = await unlockFolder(folder.id, password)
      setBusy(false)
      if (session) onUnlock(session)
      else setError('That password does not open this folder.')
    }}>
      <button type="button" className="text-btn" onClick={onBack}>All folders</button>
      <h1>{folder.hideTitles ? 'Private folder' : folder.name}</h1>
      <p>This folder keeps its own password on this device.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus /></label>
      <button type="submit" className="solid" disabled={busy}>{busy ? 'Opening…' : 'Open'}</button>
    </form>
  )
}

function FolderInside({
  folder,
  session,
  onSession,
  onBack,
  onLock,
}: {
  folder: PrivacyFolder
  session: FolderSession
  onSession: (session: FolderSession) => void
  onBack: () => void
  onLock: () => void
}) {
  const store = useStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [name, setName] = useState(folder.name)
  const [note, setNote] = useState(folder.note)
  const [accent, setAccent] = useState(folder.accent)
  const [hideTitles, setHideTitles] = useState(folder.hideTitles)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState('')

  return (
    <div className="folder-inside" style={{ ['--accent' as string]: folder.accent }}>
      <div className="row-actions">
        <button type="button" className="text-btn" onClick={onBack}>All folders</button>
        <button type="button" className="text-btn" onClick={onLock}>Lock</button>
      </div>
      <h1>{folder.name}</h1>
      {folder.note ? <p className="quiet">{folder.note}</p> : null}
      <form className="stack-form" onSubmit={async (event) => {
        event.preventDefault()
        if (!title.trim()) return
        const item = { id: crypto.randomUUID(), title: title.trim(), body, createdAt: new Date().toISOString() }
        onSession(await store.saveFolderItems(session, [item, ...session.items]))
        setTitle('')
        setBody('')
      }}>
        <label>Save in this folder<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Text<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>
        <button type="submit" className="solid">Add</button>
      </form>
      <div className="folder-items">
        {session.items.length === 0 ? <p className="quiet">This folder is empty.</p> : null}
        {session.items.map((item) => (
          <article key={item.id}>
            <strong>{item.title}</strong>
            {item.body ? <p>{item.body}</p> : null}
            <button type="button" onClick={async () => onSession(await store.saveFolderItems(session, session.items.filter((entry) => entry.id !== item.id)))}>Remove</button>
          </article>
        ))}
      </div>
      <form className="folder-settings" onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) { setMessage('Keep a name for this folder.'); return }
        store.updateFolder(folder.id, { name: name.trim(), accent, hideTitles, note })
        setMessage('Folder settings saved.')
      }}>
        <h2>Folder settings</h2>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Note<input value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label className="check-row"><input type="checkbox" checked={hideTitles} onChange={(event) => setHideTitles(event.target.checked)} /> Hide the name on the shelf</label>
        <div className="swatches">
          {ACCENTS.map((color) => (
            <button key={color} type="button" className={accent === color ? 'swatch on' : 'swatch'} style={{ background: color }} aria-label={color} onClick={() => setAccent(color)} />
          ))}
        </div>
        <button type="submit" className="solid">Save settings</button>
      </form>
      <form className="folder-settings" onSubmit={async (event) => {
        event.preventDefault()
        const changed = await store.changeFolderPassword(folder.id, current, next)
        setMessage(changed ? 'Password changed for this folder.' : 'Enter the current password and a new one of at least 4 characters.')
        if (changed) { onSession(changed); setCurrent(''); setNext('') }
      }}>
        <h2>Change password</h2>
        <label>Current<input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} /></label>
        <label>New<input type="password" value={next} onChange={(event) => setNext(event.target.value)} /></label>
        <button type="submit" className="solid">Change password</button>
        {message ? <p className="quiet">{message}</p> : null}
        <button type="button" className="text-btn danger" onClick={() => { store.deleteFolder(folder.id); onBack() }}>Delete folder</button>
      </form>
    </div>
  )
}
