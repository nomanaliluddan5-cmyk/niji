import { useState, type FormEvent } from 'react'
import { Download, KeyRound, UserRound } from 'lucide-react'
import { useAccount } from '../lib/accounts'
import { downloadWindowsPacket } from '../lib/zip'
import { pathForTab, useGo } from '../router'

type Door = 'signup' | 'login' | null

export function LandingPage({ lockedNotice }: { lockedNotice: boolean }) {
  const go = useGo()
  const { account, signup, login } = useAccount()
  const [door, setDoor] = useState<Door>(null)
  const [notice, setNotice] = useState(lockedNotice ? 'Log in to open Niji. The Windows download stays on this page.' : '')

  function enter() {
    go(pathForTab('save'))
  }

  return (
    <div className="landing">
      <header className="land-top">
        <span className="mark">Niji</span>
        <span>Kept on this device</span>
      </header>
      <main className="land-main">
        <p className="kicker">On this device</p>
        <h1>Niji</h1>
        <p className="lede">
          A warm, private place for files, notes, book pages, voice, chats you paste in, and the ordinary day.
          Sign up, log in, or take the Windows download. Any of the three. Nothing here is sent to a server.
        </p>
        <div className="doors" role="group" aria-label="Sign up, log in, or download">
          <button type="button" className="door" onClick={() => { setDoor('signup'); setNotice('') }}>
            <UserRound size={18} />
            <strong>Sign up</strong>
            <span>Create a Niji account in this browser.</span>
          </button>
          <button
            type="button"
            className="door"
            onClick={() => {
              if (account) enter()
              else { setDoor('login'); setNotice('') }
            }}
          >
            <KeyRound size={18} />
            <strong>Log in</strong>
            <span>{account ? `Continue as ${account.name}.` : 'Open Niji with an account on this device.'}</span>
          </button>
          <button
            type="button"
            className="door"
            onClick={() => {
              downloadWindowsPacket()
              setNotice('Niji-Windows.zip is downloading.')
              setDoor(null)
            }}
          >
            <Download size={18} />
            <strong>Download for Windows</strong>
            <span>A zip with setup notes and Install-Niji.bat.</span>
          </button>
        </div>
        {notice ? <p className="land-notice">{notice}</p> : null}
        {door === 'signup' ? <Signup onDone={enter} onClose={() => setDoor(null)} signup={signup} /> : null}
        {door === 'login' ? <Login onDone={enter} onClose={() => setDoor(null)} login={login} /> : null}

        <section className="story" aria-label="What the app holds">
          <article>
            <h2>Save anything</h2>
            <p>A file, a note, a photo of a book page, a voice clip, a document, or a download. Paste a chat from any app into an inbox on this device.</p>
          </article>
          <article>
            <h2>Private folders</h2>
            <p>Each folder has its own password, color, and settings. Change the password when you want. The lock stays in this browser.</p>
          </article>
          <article>
            <h2>A day, and a game</h2>
            <p>Notes, tasks, expenses in Rs, a calendar, documents, and a gallery. When the day is quiet, a small matching game is there too.</p>
          </article>
        </section>
      </main>
    </div>
  )
}

function Signup({
  onDone,
  onClose,
  signup,
}: {
  onDone: () => void
  onClose: () => void
  signup: (input: { name: string; email: string; password: string }) => { error?: string }
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = signup({ name, email, password })
    if (result.error) setError(result.error)
    else onDone()
  }
  return (
    <form className="sheet" onSubmit={submit}>
      <div className="sheet-head">
        <h2>Sign up</h2>
        <button type="button" className="text-btn" onClick={onClose}>Close</button>
      </div>
      <p>Your Niji account stays in this browser only.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
      <button type="submit" className="solid">Create account</button>
    </form>
  )
}

function Login({
  onDone,
  onClose,
  login,
}: {
  onDone: () => void
  onClose: () => void
  login: (input: { email: string; password: string }) => { error?: string }
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = login({ email, password })
    if (result.error) setError(result.error)
    else onDone()
  }
  return (
    <form className="sheet" onSubmit={submit}>
      <div className="sheet-head">
        <h2>Log in</h2>
        <button type="button" className="text-btn" onClick={onClose}>Close</button>
      </div>
      <p>Use the email and password saved for Niji on this device.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      <button type="submit" className="solid">Log in</button>
    </form>
  )
}
