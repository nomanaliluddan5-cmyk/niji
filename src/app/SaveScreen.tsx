import { useRef, useState, type FormEvent } from 'react'
import { parseChat } from '../lib/chat'
import { imageFileToDataUrl, safeAudioSrc, safeImageSrc } from '../lib/images'
import { useStore } from '../store'
import type { InboxKind, KeepKind } from '../types'

const KINDS: { id: KeepKind; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'note', label: 'Note' },
  { id: 'book', label: 'Book page' },
  { id: 'voice', label: 'Voice' },
  { id: 'document', label: 'Document' },
  { id: 'download', label: 'Download' },
]

export function SaveScreen() {
  const store = useStore()
  const [kind, setKind] = useState<KeepKind>('note')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [fileName, setFileName] = useState('')
  const [image, setImage] = useState('')
  const [audio, setAudio] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)

  async function onFile(file: File) {
    setError('')
    setFileName(file.name)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
    if (file.type.startsWith('image/')) {
      setImage(await imageFileToDataUrl(file))
      if (kind === 'file' || kind === 'note') setKind('book')
      return
    }
    if (file.type.startsWith('audio/') || file.type.startsWith('video/webm')) {
      setAudio(await blobToDataUrl(file))
      setKind('voice')
      return
    }
    if (file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name)) {
      const text = await file.text()
      setBody(text.slice(0, 20000))
      setKind(kind === 'note' ? 'note' : 'document')
    }
  }

  async function toggleRecord() {
    if (recording && recorder.current) {
      recorder.current.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        if (blob.size > 320_000) {
          setError('That clip is too long to keep on this device. Try a shorter one.')
          return
        }
        setAudio(await blobToDataUrl(blob))
      }
      recorder.current = rec
      rec.start()
      setRecording(true)
      window.setTimeout(() => {
        if (rec.state === 'recording') rec.stop()
      }, 20000)
    } catch {
      setError('The microphone is unavailable. You can still choose an audio file.')
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const name = title.trim()
    if (!name) {
      setError('Add a name for this save.')
      return
    }
    setBusy(true)
    setError('')
    try {
      store.addKeep({ kind, title: name, body, imageDataUrl: image, audioDataUrl: audio, fileName })
      if (kind === 'note') store.addNote({ title: name, body })
      if (kind === 'document' || (kind === 'file' && body)) store.addDocument({ title: name, body: body || `Saved file: ${fileName || name}` })
      if (kind === 'book' && image) store.addGallery({ name, note: body || 'Book page', imageDataUrl: image })
      setTitle('')
      setBody('')
      setFileName('')
      setImage('')
      setAudio('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="save-screen">
      <p className="kicker">Keep it here</p>
      <h1>Save</h1>
      <form className="capture" onSubmit={onSubmit}>
        <div className="pills">
          {KINDS.map((item) => (
            <button key={item.id} type="button" className={kind === item.id ? 'pill on' : 'pill'} onClick={() => setKind(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <label>Name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What is this?" /></label>
        {kind === 'book' || kind === 'file' ? (
          <label className="file-btn">
            {kind === 'book' ? 'Photo of a page' : 'Choose a file'}
            <input
              type="file"
              accept={kind === 'book' ? 'image/*' : undefined}
              capture={kind === 'book' ? 'environment' : undefined}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void onFile(file).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not read that file.'))
              }}
            />
          </label>
        ) : null}
        {kind === 'voice' ? (
          <div className="row-actions">
            <button type="button" className="solid" onClick={() => void toggleRecord()}>{recording ? 'Stop' : 'Record'}</button>
            <label className="file-btn">
              Audio file
              <input type="file" accept="audio/*" onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void onFile(file).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not read that audio.'))
              }} />
            </label>
          </div>
        ) : null}
        {image ? <img className="preview" alt="" src={image} /> : null}
        {audio ? <audio controls src={audio} /> : null}
        <label>{kind === 'download' ? 'Where it came from' : 'Notes'}
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={kind === 'download' ? 'Name the file you downloaded' : 'Write what you want to keep'} />
        </label>
        <button type="submit" className="solid" disabled={busy}>{busy ? 'Saving…' : 'Save on this device'}</button>
      </form>

      <div className="save-rest">
      <section className="kept">
        {store.data.keeps.length === 0 ? <p className="quiet">Saves show up here, in this browser.</p> : null}
        {store.data.keeps.slice(0, 6).map((item) => (
          <article key={item.id}>
            <header><span>{labelFor(item.kind)}</span><button type="button" onClick={() => store.deleteKeep(item.id)}>Remove</button></header>
            <strong>{item.title}</strong>
            {item.body ? <p>{item.body}</p> : null}
            {safeImageSrc(item.imageDataUrl) ? <img alt="" src={item.imageDataUrl} /> : null}
            {safeAudioSrc(item.audioDataUrl) ? <audio controls src={item.audioDataUrl} /> : null}
          </article>
        ))}
      </section>
      <Inbox />
      </div>
    </div>
  )
}

function labelFor(kind: KeepKind) {
  return KINDS.find((item) => item.id === kind)?.label ?? kind
}

function Inbox() {
  const store = useStore()
  const [paste, setPaste] = useState('')
  const [callWho, setCallWho] = useState('')
  const [callNote, setCallNote] = useState('')
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)

  function addMessages(author: string, text: string, kind: InboxKind, imageDataUrl = '', audioDataUrl = '') {
    store.addInbox({ kind, author, text, imageDataUrl, audioDataUrl })
  }

  function importChat() {
    const messages = parseChat(paste)
    if (!messages.length) {
      setError('Paste a chat first.')
      return
    }
    for (const message of messages) addMessages(message.author, message.text, 'chat')
    setPaste('')
    setError('')
  }

  async function onPhoto(file: File) {
    const imageDataUrl = await imageFileToDataUrl(file)
    addMessages('Photo', file.name, 'photo', imageDataUrl)
  }

  async function onAudio(file: File, kind: InboxKind) {
    if (file.size > 320_000) {
      setError('That audio is too large to keep on this device.')
      return
    }
    addMessages(kind === 'voice' ? 'Voice note' : 'Recording', file.name, kind, '', await blobToDataUrl(file))
  }

  async function recordClip(kind: InboxKind) {
    if (recording && recorder.current) {
      recorder.current.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        if (blob.size > 320_000) {
          setError('That clip is too long to keep on this device.')
          return
        }
        addMessages(kind === 'voice' ? 'Voice note' : 'Recording', 'Recorded on this device', kind, '', await blobToDataUrl(blob))
      }
      recorder.current = rec
      rec.start()
      setRecording(true)
      window.setTimeout(() => { if (rec.state === 'recording') rec.stop() }, 20000)
    } catch {
      setError('The microphone is unavailable. Choose an audio file instead.')
    }
  }

  return (
    <section className="inbox">
      <h2>From any app</h2>
      <p>Paste chat text, or add a photo, voice note, call note, or recording. This stays on the device. There is no WhatsApp connection.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <label>Paste a chat
        <textarea value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'[11/7/26, 8:23 AM] Alex: Saved this chat'} />
      </label>
      <button type="button" className="solid" onClick={importChat}>Save chat</button>
      <div className="row-actions">
        <label className="file-btn">Photo<input type="file" accept="image/*" onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onPhoto(file).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not save that photo.'))
        }} /></label>
        <button type="button" className="file-btn" onClick={() => void recordClip('voice')}>{recording ? 'Stop voice' : 'Voice note'}</button>
        <label className="file-btn">Recording<input type="file" accept="audio/*" onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onAudio(file, 'recording').catch(() => setError('Could not read that recording.'))
        }} /></label>
      </div>
      <form className="call-form" onSubmit={(event) => {
        event.preventDefault()
        if (!callWho.trim() && !callNote.trim()) return
        addMessages(callWho.trim() || 'Call', callNote.trim() || 'Call note', 'call')
        setCallWho('')
        setCallNote('')
      }}>
        <label>Call with<input value={callWho} onChange={(event) => setCallWho(event.target.value)} /></label>
        <label>Call note<textarea value={callNote} onChange={(event) => setCallNote(event.target.value)} /></label>
        <button type="submit" className="solid">Save call note</button>
      </form>
      <div className="thread">
        {store.data.inbox.length === 0 ? <p className="quiet">The inbox is empty.</p> : null}
        {store.data.inbox.map((item) => (
          <article key={item.id} className={item.kind === 'call' ? 'bubble call' : 'bubble'}>
            <header><span>{item.author}</span><small>{inboxLabel(item.kind)}</small></header>
            {item.text ? <p>{item.text}</p> : null}
            {safeImageSrc(item.imageDataUrl) ? <img alt="" src={item.imageDataUrl} /> : null}
            {safeAudioSrc(item.audioDataUrl) ? <audio controls src={item.audioDataUrl} /> : null}
            <button type="button" onClick={() => store.deleteInbox(item.id)}>Remove</button>
          </article>
        ))}
      </div>
    </section>
  )
}

function inboxLabel(kind: InboxKind) {
  if (kind === 'chat') return 'Chat'
  if (kind === 'photo') return 'Photo'
  if (kind === 'voice') return 'Voice note'
  if (kind === 'call') return 'Call'
  return 'Recording'
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that audio.'))
    reader.readAsDataURL(blob)
  })
}
