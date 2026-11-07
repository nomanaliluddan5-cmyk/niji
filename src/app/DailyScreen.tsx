import { useState, type FormEvent } from 'react'
import { dateKey, formatDay, formatRs, spentThisMonth } from '../lib/format'
import { imageFileToDataUrl } from '../lib/images'
import { useStore } from '../store'
import { EXPENSE_CATEGORIES } from '../types'

export function DailyScreen() {
  const store = useStore()
  const today = dateKey()
  const spent = spentThisMonth(store.data.expenses)
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - day.getDay() + index)
    return day
  })

  return (
    <div className="daybook">
      <p className="kicker">Today</p>
      <h1>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</h1>
      <section className="week-strip" aria-label="This week">
        {week.map((day) => {
          const key = dateKey(day)
          const count = store.data.events.filter((event) => event.date === key).length
          return (
            <div key={key} className={key === today ? 'week-day today' : 'week-day'}>
              <span>{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
              <strong>{day.getDate()}</strong>
              {count ? <i /> : null}
            </div>
          )
        })}
      </section>

      <Paper notes={store.data.notes} onAdd={store.addNote} onDelete={store.deleteNote} />
      <Ticks tasks={store.data.tasks} today={today} onAdd={store.addTask} onToggle={store.toggleTask} onDelete={store.deleteTask} />
      <Receipt expenses={store.data.expenses} spent={spent} onAdd={store.addExpense} onDelete={store.deleteExpense} />
      <Agenda events={store.data.events} onAdd={store.addEvent} onDelete={store.deleteEvent} />
      <Sheets documents={store.data.documents} onAdd={store.addDocument} onDelete={store.deleteDocument} />
      <Film gallery={store.data.gallery} onAdd={store.addGallery} onDelete={store.deleteGallery} />
    </div>
  )
}

function Paper({
  notes,
  onAdd,
  onDelete,
}: {
  notes: { id: string; title: string; body: string }[]
  onAdd: (input: { title: string; body: string }) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <section className="paper">
      <h2>Notes</h2>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        onAdd({ title: title.trim(), body })
        setTitle('')
        setBody('')
      }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A line to remember" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="The rest" />
        <button type="submit">Add note</button>
      </form>
      {notes.map((note) => (
        <article key={note.id}><strong>{note.title}</strong><p>{note.body}</p><button type="button" onClick={() => onDelete(note.id)}>Remove</button></article>
      ))}
    </section>
  )
}

function Ticks({
  tasks,
  today,
  onAdd,
  onToggle,
  onDelete,
}: {
  tasks: { id: string; title: string; done: boolean; dueDate: string }[]
  today: string
  onAdd: (input: { title: string; notes: string; dueDate: string }) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  return (
    <section className="ticks">
      <h2>Tasks</h2>
      <form onSubmit={(event: FormEvent) => {
        event.preventDefault()
        if (!title.trim()) return
        onAdd({ title: title.trim(), notes: '', dueDate: today })
        setTitle('')
      }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Due today" />
        <button type="submit">Add</button>
      </form>
      {tasks.map((task) => (
        <label key={task.id} className={task.done ? 'tick done' : 'tick'}>
          <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
          <span>{task.title}</span>
          <button type="button" onClick={() => onDelete(task.id)}>Remove</button>
        </label>
      ))}
    </section>
  )
}

function Receipt({
  expenses,
  spent,
  onAdd,
  onDelete,
}: {
  expenses: { id: string; title: string; amount: number; category: string; date: string }[]
  spent: number
  onAdd: (input: { title: string; amount: number; category: string; date: string }) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('Other')
  return (
    <section className="receipt">
      <h2>Expenses</h2>
      <p className="total">{formatRs(spent)} this month</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        const value = Number(amount)
        if (!title.trim() || !Number.isFinite(value) || value < 0) return
        onAdd({ title: title.trim(), amount: value, category, date: dateKey() })
        setTitle('')
        setAmount('')
      }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What" />
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Rs" />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="submit">Add</button>
      </form>
      {expenses.map((item) => (
        <p key={item.id} className="line"><span>{item.title}</span><span>{formatRs(item.amount)}</span><button type="button" onClick={() => onDelete(item.id)}>Remove</button></p>
      ))}
    </section>
  )
}

function Agenda({
  events,
  onAdd,
  onDelete,
}: {
  events: { id: string; title: string; date: string; time: string }[]
  onAdd: (input: { title: string; date: string; time: string; notes: string }) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(dateKey())
  const [time, setTime] = useState('')
  return (
    <section className="agenda">
      <h2>Calendar</h2>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim() || !date) return
        onAdd({ title: title.trim(), date, time, notes: '' })
        setTitle('')
      }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Event" />
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        <button type="submit">Add</button>
      </form>
      {[...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).map((event) => (
        <article key={event.id}><strong>{event.title}</strong><span>{formatDay(event.date)} {event.time}</span><button type="button" onClick={() => onDelete(event.id)}>Remove</button></article>
      ))}
    </section>
  )
}

function Sheets({
  documents,
  onAdd,
  onDelete,
}: {
  documents: { id: string; title: string; body: string }[]
  onAdd: (input: { title: string; body: string }) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <section className="sheets">
      <h2>Documents</h2>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        onAdd({ title: title.trim(), body })
        setTitle('')
        setBody('')
      }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Text" />
        <button type="submit">Add document</button>
      </form>
      {documents.map((doc) => (
        <article key={doc.id}><strong>{doc.title}</strong><p>{doc.body}</p><button type="button" onClick={() => onDelete(doc.id)}>Remove</button></article>
      ))}
    </section>
  )
}

function Film({
  gallery,
  onAdd,
  onDelete,
}: {
  gallery: { id: string; name: string; note: string; imageDataUrl: string }[]
  onAdd: (input: { name: string; note: string; imageDataUrl: string }) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  return (
    <section className="film">
      <h2>Gallery</h2>
      {error ? <p className="error-text">{error}</p> : null}
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        onAdd({ name: name.trim(), note, imageDataUrl: image })
        setName('')
        setNote('')
        setImage('')
      }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" />
        <input type="file" accept="image/*" onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void imageFileToDataUrl(file).then(setImage).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not use that photo.'))
        }} />
        <button type="submit">Add</button>
      </form>
      <div className="polaroids">
        {gallery.map((item) => (
          <figure key={item.id}>
            {item.imageDataUrl ? <img alt="" src={item.imageDataUrl} /> : <div className="blank" />}
            <figcaption>{item.name}</figcaption>
            <button type="button" onClick={() => onDelete(item.id)}>Remove</button>
          </figure>
        ))}
      </div>
    </section>
  )
}
