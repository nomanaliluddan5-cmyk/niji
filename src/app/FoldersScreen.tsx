import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import type { PrivacyFolder } from '../types'

const ACCENTS = ['#e7a15a', '#d26a45', '#c46b8a', '#7d9a6a', '#6f8fbf', '#c9a06a']

export function FoldersScreen() {
  const store = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState<string | null>(null)
  const open = store.data.folders.find((folder) => folder.id === openId) ?? null

  if (!open) {
    return (
      <div className="shelf-screen">
        <p className="kicker">Each lock is its own</p>
        <h1>Folders</h1>
        <CreateFolder onCreate={() => setOpenId(null)} />
        <div className="shelf">
          {store.data.folders.length === 0 ? <p className="quiet">Create a folder and give it a password.</p> : null}
          {store.data.folders.map((folder) => (
            <button key={folder.id} type="button" className="folder-tab" style={{ ['--accent' as string]: folder.accent }} onClick={() => { setOpenId(folder.id); setUnlocked(null) }}>
              <i />
              <strong>{folder.hideTitles ? 'Private folder' : folder.name}</strong>
              <span>{folder.items.length} saved</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (unlocked !== open.id) {
    return <LockGate folder={open} onBack={() => setOpenId(null)} onUnlock={() => setUnlocked(open.id)} />
  }

  return <FolderInside folder={open} onBack={() => setOpenId(null)} onLock={() => setUnlocked(null)} />
}

function CreateFolder({ onCreate }: { onCreate: () => void }) {
  const { addFolder } = useStore()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [accent, setAccent] = useState(ACCENTS[0])
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) { setError('Name the folder.'); return }
    if (password.length < 4) { setError('Use a password of at least 4 characters.'); return }
    addFolder({ name: name.trim(), password, accent, note: '' })
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
      <button type="submit" className="solid">Create folder</button>
    </form>
  )
}

function LockGate({ folder, onBack, onUnlock }: { folder: PrivacyFolder; onBack: () => void; onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  return (
    <form className="lock-gate" style={{ ['--accent' as string]: folder.accent }} onSubmit={(event) => {
      event.preventDefault()
      if (password === folder.password) onUnlock()
      else setError('That password does not open this folder.')
    }}>
      <button type="button" className="text-btn" onClick={onBack}>All folders</button>
      <h1>{folder.hideTitles ? 'Private folder' : folder.name}</h1>
      <p>This folder keeps its own password on this device.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus /></label>
      <button type="submit" className="solid">Open</button>
    </form>
  )
}

function FolderInside({ folder, onBack, onLock }: { folder: PrivacyFolder; onBack: () => void; onLock: () => void }) {
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
      <form className="stack-form" onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        store.addFolderItem(folder.id, { title: title.trim(), body })
        setTitle('')
        setBody('')
      }}>
        <label>Save in this folder<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Text<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>
        <button type="submit" className="solid">Add</button>
      </form>
      <div className="folder-items">
        {folder.items.length === 0 ? <p className="quiet">This folder is empty.</p> : null}
        {folder.items.map((item) => (
          <article key={item.id}>
            <strong>{item.title}</strong>
            {item.body ? <p>{item.body}</p> : null}
            <button type="button" onClick={() => store.deleteFolderItem(folder.id, item.id)}>Remove</button>
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
      <form className="folder-settings" onSubmit={(event) => {
        event.preventDefault()
        const ok = store.changeFolderPassword(folder.id, current, next)
        setMessage(ok ? 'Password changed for this folder.' : 'Enter the current password and a new one of at least 4 characters.')
        if (ok) { setCurrent(''); setNext('') }
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
