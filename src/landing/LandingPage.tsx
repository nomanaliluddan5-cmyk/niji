import { useState, type FormEvent } from 'react'
import { useAccount } from '../lib/accounts'
import { downloadWindowsPacket } from '../lib/zip'
import { pathForTab, useGo } from '../router'

type Door = 'signup' | 'login' | null

export function LandingPage({ lockedNotice }: { lockedNotice: boolean }) {
  const go = useGo()
  const { account, signup, login } = useAccount()
  const [door, setDoor] = useState<Door>(lockedNotice ? 'login' : null)
  const [notice, setNotice] = useState(lockedNotice ? 'Log in to open Niji. The Windows download stays on this page.' : '')

  function enter() {
    go(pathForTab('save'))
  }

  function download() {
    downloadWindowsPacket()
    setNotice('Niji-Windows.zip is downloading.')
    setDoor(null)
  }

  return (
    <div className="promo" id="home">
      <header className="promo-bar">
        <a className="promo-brand" href="#home">
          <Logo />
          <strong>Niji</strong>
        </a>
        <nav className="promo-nav" aria-label="Niji">
          <a href="#home">Home</a>
          <a href="#save-app">Save app</a>
          <a href="#price">Price</a>
          <a href="#download">Download</a>
          <a href="#contact">Contact</a>
          <button type="button" onClick={() => { setDoor('login'); setNotice('') }}>Login</button>
        </nav>
      </header>
      <section className="promo-hero" aria-label="Niji">
        <Decor />
        <div className="promo-stage">
          <PhoneMock />
        </div>
        <div className="promo-copy">
          <blockquote className="promo-quote">
            <p>“At the end of the day we are accountable to ourselves. Our success is a result of what we do”</p>
          </blockquote>
          <button id="download" type="button" className="promo-download" onClick={download}>
            Download Now
          </button>
          {notice ? <p className="promo-notice">{notice}</p> : null}
        </div>
      </section>
      <div className="promo-sections">
        <section id="save-app">
          <h2>Save app</h2>
          <p>Keep a file, note, book page, voice clip, document, or download on this device. Paste a chat into the inbox. Nothing is sent to a server.</p>
        </section>
        <section id="price">
          <h2>Price</h2>
          <p>Niji is free on this device. The Windows download is a setup guide in Niji-Windows.zip.</p>
        </section>
        <section id="contact">
          <h2>Contact</h2>
          <p>Niji has no message inbox and no account server. What you save stays in this browser.</p>
        </section>
      </div>
      {door === 'signup' ? (
        <div className="promo-modal" role="dialog" aria-label="Sign up">
          <Signup onDone={enter} onClose={() => setDoor(null)} onLogin={() => setDoor('login')} signup={signup} />
        </div>
      ) : null}
      {door === 'login' ? (
        <div className="promo-modal" role="dialog" aria-label="Log in">
          <Login
            onDone={enter}
            onClose={() => setDoor(null)}
            onSignup={() => setDoor('signup')}
            login={login}
            accountName={account?.name}
            onContinue={account ? enter : undefined}
          />
        </div>
      ) : null}
    </div>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="42" height="42" aria-hidden="true">
      <path
        d="M46 16c-14 0-18 7-18 12 0 6 6 8 16 10 10 2 16 5 16 12 0 8-7 14-18 14S22 58 22 50"
        fill="none"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M18 22c6-8 22-8 28 0" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function Decor() {
  return (
    <svg className="promo-deco" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="18">
        <ellipse cx="280" cy="430" rx="210" ry="250" />
        <ellipse cx="280" cy="430" rx="300" ry="340" />
      </g>
      <g fill="rgba(255,255,255,0.28)">
        <circle cx="980" cy="160" r="5" />
        <circle cx="1080" cy="230" r="4" />
        <circle cx="1040" cy="340" r="5" />
        <circle cx="1140" cy="300" r="4" />
      </g>
      <g fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2">
        <path d="M980 160 L1080 230 L1120 190 L1200 220" />
        <path d="M1040 340 L1080 230" />
      </g>
    </svg>
  )
}

function PhoneMock() {
  return (
    <div className="promo-device" aria-hidden="true">
      <div className="promo-screen">
        <div className="promo-status">
          <span>9:41</span>
          <span>Niji</span>
        </div>
        <div className="promo-appbar">
          <Logo />
          <span>Niji</span>
        </div>
        <p className="promo-screen-label">On this device</p>
        <div className="promo-grid">
          {['Save', 'Folders', 'Daily', 'Play', 'Notes', 'Inbox', 'Tasks', 'Expenses', 'Calendar'].map((label) => (
            <div key={label}>
              <i />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="promo-feed">
          <strong>Today</strong>
          <p>Morning page</p>
          <p>Water plants</p>
          <p>Tea · Rs 80</p>
        </div>
        <div className="promo-dock">
          <span>Save</span>
          <span>Folders</span>
          <span>Daily</span>
          <span>Play</span>
        </div>
      </div>
    </div>
  )
}

function Signup({
  onDone,
  onClose,
  onLogin,
  signup,
}: {
  onDone: () => void
  onClose: () => void
  onLogin: () => void
  signup: (input: { name: string; email: string; password: string }) => Promise<{ error?: string }>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await signup({ name, email, password })
    setBusy(false)
    if (result.error) setError(result.error)
    else onDone()
  }
  return (
    <form className="sheet promo-sheet" onSubmit={submit}>
      <div className="sheet-head">
        <h2>Sign up</h2>
        <button type="button" className="text-btn" onClick={onClose}>Close</button>
      </div>
      <p>Your Niji account stays in this browser only.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
      <button type="submit" className="solid" disabled={busy}>Create account</button>
      <p className="promo-switch">Already have a Niji account? <button type="button" onClick={onLogin}>Log in</button></p>
    </form>
  )
}

function Login({
  onDone,
  onClose,
  onSignup,
  login,
  accountName,
  onContinue,
}: {
  onDone: () => void
  onClose: () => void
  onSignup: () => void
  login: (input: { email: string; password: string }) => Promise<{ error?: string }>
  accountName?: string
  onContinue?: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await login({ email, password })
    setBusy(false)
    if (result.error) setError(result.error)
    else onDone()
  }
  return (
    <form className="sheet promo-sheet" onSubmit={submit}>
      <div className="sheet-head">
        <h2>Log in</h2>
        <button type="button" className="text-btn" onClick={onClose}>Close</button>
      </div>
      <p>Use the email and password saved for Niji on this device.</p>
      {accountName && onContinue ? (
        <button type="button" className="solid" onClick={onContinue}>Continue as {accountName}</button>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      <button type="submit" className="solid" disabled={busy}>Log in</button>
      <p className="promo-switch">New to Niji? <button type="button" onClick={onSignup}>Sign up</button></p>
    </form>
  )
}
