import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dateKey, roundMoney } from './lib/format'
import { safeAudioSrc, safeImageSrc } from './lib/images'
import {
  MAX_BODY,
  MAX_NAME,
  MAX_TITLE,
  type Activity,
  type ActivityKind,
  type AppData,
  type CalendarEvent,
  type DocumentItem,
  type Expense,
  type FolderItem,
  type GalleryItem,
  type InboxItem,
  type InboxKind,
  type Keep,
  type KeepKind,
  type Note,
  type PrivacyFolder,
  type Settings,
  type Task,
  type VaultItem,
} from './types'

const KEY = 'my-personal-app.v1'
const KINDS = new Set<ActivityKind>(['note', 'task', 'document', 'expense', 'event', 'vault', 'gallery', 'keep', 'inbox', 'folder'])
const KEEP_KINDS = new Set<KeepKind>(['file', 'note', 'book', 'voice', 'document', 'download'])
const INBOX_KINDS = new Set<InboxKind>(['chat', 'photo', 'voice', 'call', 'recording'])

function uid() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

function baseSettings(): Settings {
  return { displayName: 'N', monthlyBudget: null, vaultPin: null }
}

function emptyData(): AppData {
  return {
    notes: [],
    tasks: [],
    events: [],
    vault: [],
    documents: [],
    expenses: [],
    gallery: [],
    keeps: [],
    inbox: [],
    folders: [],
    activity: [],
    settings: baseSettings(),
    initialized: true,
  }
}

function seed(): AppData {
  const createdAt = new Date(2026, 10, 6, 23, 4, 15).toISOString()
  const id = 'seed-document'
  return {
    ...emptyData(),
    documents: [
      {
        id,
        title: 'Welcome',
        body: 'This sample document lives in your library on this device. Add your own writing, tasks, and records whenever you like.',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    activity: [
      {
        id: 'seed-activity',
        kind: 'document',
        label: 'Added document',
        refId: id,
        at: createdAt,
      },
    ],
  }
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asDateString(value: unknown) {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value
  return '2026-01-01T00:00:00.000Z'
}

function asDay(value: unknown, fallback = '') {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return fallback
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max)
}

function mapItems<T>(value: unknown, map: (row: Record<string, unknown>) => T | null) {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const item = map(row as Record<string, unknown>)
    if (item) out.push(item)
  }
  return out
}

function mapNote(row: Record<string, unknown>): Note | null {
  const id = asString(row.id)
  const title = clip(asString(row.title), MAX_TITLE)
  if (!id || !title) return null
  const createdAt = asDateString(row.createdAt)
  return {
    id,
    title,
    body: asString(row.body).slice(0, MAX_BODY),
    createdAt,
    updatedAt: asDateString(row.updatedAt ?? createdAt),
  }
}

function mapTask(row: Record<string, unknown>): Task | null {
  const id = asString(row.id)
  const title = clip(asString(row.title), MAX_TITLE)
  if (!id || !title) return null
  const createdAt = asDateString(row.createdAt)
  return {
    id,
    title,
    notes: asString(row.notes).slice(0, MAX_BODY),
    done: row.done === true,
    dueDate: asDay(row.dueDate),
    createdAt,
    updatedAt: asDateString(row.updatedAt ?? createdAt),
  }
}

function mapEvent(row: Record<string, unknown>): CalendarEvent | null {
  const id = asString(row.id)
  const title = clip(asString(row.title), MAX_TITLE)
  const date = asDay(row.date)
  if (!id || !title || !date) return null
  const createdAt = asDateString(row.createdAt)
  const time = /^\d{2}:\d{2}$/.test(asString(row.time)) ? asString(row.time) : ''
  return {
    id,
    title,
    date,
    time,
    notes: asString(row.notes).slice(0, MAX_BODY),
    createdAt,
    updatedAt: asDateString(row.updatedAt ?? createdAt),
  }
}

function mapVault(row: Record<string, unknown>): VaultItem | null {
  const id = asString(row.id)
  const title = clip(asString(row.title), MAX_TITLE)
  if (!id || !title) return null
  const createdAt = asDateString(row.createdAt)
  return {
    id,
    title,
    username: clip(asString(row.username), MAX_TITLE),
    secret: asString(row.secret).slice(0, MAX_BODY),
    notes: asString(row.notes).slice(0, MAX_BODY),
    createdAt,
    updatedAt: asDateString(row.updatedAt ?? createdAt),
  }
}

function mapDocument(row: Record<string, unknown>): DocumentItem | null {
  return mapNote(row)
}

function mapExpense(row: Record<string, unknown>): Expense | null {
  const id = asString(row.id)
  const title = clip(asString(row.title), MAX_TITLE)
  const amountValue = typeof row.amount === 'number' ? row.amount : Number(row.amount)
  if (!id || !title || !Number.isFinite(amountValue) || amountValue < 0) return null
  const createdAt = asDateString(row.createdAt)
  return {
    id,
    title,
    amount: roundMoney(amountValue),
    category: clip(asString(row.category, 'Other'), 40) || 'Other',
    date: asDay(row.date, '2026-01-01'),
    createdAt,
    updatedAt: asDateString(row.updatedAt ?? createdAt),
  }
}

function mapGallery(row: Record<string, unknown>): GalleryItem | null {
  const id = asString(row.id)
  const name = clip(asString(row.name), MAX_NAME)
  if (!id || !name) return null
  const createdAt = asDateString(row.createdAt)
  return {
    id,
    name,
    note: asString(row.note).slice(0, MAX_BODY),
    imageDataUrl: safeImageSrc(row.imageDataUrl),
    createdAt,
    updatedAt: asDateString(row.updatedAt ?? createdAt),
  }
}

function mapKeep(row: Record<string, unknown>): Keep | null {
  const id = asString(row.id)
  const kind = asString(row.kind) as KeepKind
  const title = clip(asString(row.title), MAX_TITLE)
  if (!id || !title || !KEEP_KINDS.has(kind)) return null
  return {
    id,
    kind,
    title,
    body: asString(row.body).slice(0, MAX_BODY),
    imageDataUrl: safeImageSrc(row.imageDataUrl),
    audioDataUrl: safeAudioSrc(row.audioDataUrl),
    fileName: clip(asString(row.fileName), 180),
    createdAt: asDateString(row.createdAt),
  }
}

function mapInbox(row: Record<string, unknown>): InboxItem | null {
  const id = asString(row.id)
  const kind = asString(row.kind) as InboxKind
  if (!id || !INBOX_KINDS.has(kind)) return null
  const text = asString(row.text).slice(0, MAX_BODY)
  const imageDataUrl = safeImageSrc(row.imageDataUrl)
  const audioDataUrl = safeAudioSrc(row.audioDataUrl)
  if (!text && !imageDataUrl && !audioDataUrl) return null
  return {
    id,
    kind,
    author: clip(asString(row.author, 'Chat'), 80) || 'Chat',
    text,
    imageDataUrl,
    audioDataUrl,
    createdAt: asDateString(row.createdAt),
  }
}

function mapFolderItem(row: Record<string, unknown>): FolderItem | null {
  const id = asString(row.id)
  const title = clip(asString(row.title), MAX_TITLE)
  if (!id || !title) return null
  return { id, title, body: asString(row.body).slice(0, MAX_BODY), createdAt: asDateString(row.createdAt) }
}

function mapFolder(row: Record<string, unknown>): PrivacyFolder | null {
  const id = asString(row.id)
  const name = clip(asString(row.name), 60)
  const password = asString(row.password)
  if (!id || !name || password.length < 4) return null
  return {
    id,
    name,
    password: password.slice(0, 40),
    accent: /^#[0-9a-fA-F]{6}$/.test(asString(row.accent)) ? asString(row.accent) : '#e7a15a',
    hideTitles: row.hideTitles === true,
    note: asString(row.note).slice(0, 400),
    items: mapItems(row.items, mapFolderItem),
    createdAt: asDateString(row.createdAt),
  }
}

function mapActivity(row: Record<string, unknown>): Activity | null {
  const id = asString(row.id)
  const kind = asString(row.kind) as ActivityKind
  const label = clip(asString(row.label), 80)
  if (!id || !label || !KINDS.has(kind)) return null
  const detail = clip(asString(row.detail), MAX_TITLE)
  const refId = asString(row.refId)
  return {
    id,
    kind,
    label,
    at: asDateString(row.at),
    ...(detail ? { detail } : {}),
    ...(refId ? { refId } : {}),
  }
}

function normalize(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null
  const outer = raw as Record<string, unknown>
  const source =
    outer.data && typeof outer.data === 'object' ? (outer.data as Record<string, unknown>) : outer
  const markers = ['notes', 'tasks', 'events', 'vault', 'documents', 'expenses', 'gallery', 'settings']
  if (!markers.some((key) => key in source)) return null
  const settingsRaw =
    source.settings && typeof source.settings === 'object'
      ? (source.settings as Record<string, unknown>)
      : {}
  const budget = settingsRaw.monthlyBudget
  const pin = asString(settingsRaw.vaultPin)
  const settings: Settings = {
    displayName: clip(asString(settingsRaw.displayName, 'N'), 40) || 'N',
    monthlyBudget: typeof budget === 'number' && Number.isFinite(budget) && budget >= 0 ? roundMoney(budget) : null,
    vaultPin: /^\d{4,6}$/.test(pin) ? pin : null,
  }
  return {
    notes: mapItems(source.notes, mapNote),
    tasks: mapItems(source.tasks, mapTask),
    events: mapItems(source.events, mapEvent),
    vault: mapItems(source.vault, mapVault),
    documents: mapItems(source.documents, mapDocument),
    expenses: mapItems(source.expenses, mapExpense),
    gallery: mapItems(source.gallery, mapGallery),
    keeps: mapItems(source.keeps, mapKeep),
    inbox: mapItems(source.inbox, mapInbox),
    folders: mapItems(source.folders, mapFolder),
    activity: mapItems(source.activity, mapActivity).slice(0, 40),
    settings,
    initialized: true,
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    return normalize(JSON.parse(raw)) ?? seed()
  } catch {
    return seed()
  }
}

function withActivity(data: AppData, kind: ActivityKind, label: string, detail?: string, refId?: string): AppData {
  const entry: Activity = {
    id: uid(),
    kind,
    label,
    at: nowIso(),
    ...(detail ? { detail } : {}),
    ...(refId ? { refId } : {}),
  }
  return { ...data, activity: [entry, ...data.activity].slice(0, 40) }
}

type NoteInput = { title: string; body: string }
type TaskInput = { title: string; notes: string; dueDate: string }
type EventInput = { title: string; date: string; time: string; notes: string }
type ExpenseInput = { title: string; amount: number; category: string; date: string }
type GalleryInput = { name: string; note: string; imageDataUrl: string }
type VaultInput = { title: string; username: string; secret: string; notes: string }
type KeepInput = { kind: KeepKind; title: string; body: string; imageDataUrl?: string; audioDataUrl?: string; fileName?: string }
type InboxInput = { kind: InboxKind; author: string; text: string; imageDataUrl?: string; audioDataUrl?: string }
type FolderInput = { name: string; password: string; accent: string; note: string }

export type StoreApi = {
  data: AppData
  vaultLocked: boolean
  persistError: string | null
  toast: string | null
  dismissToast: () => void
  showToast: (message: string) => void
  addNote: (input: NoteInput) => void
  updateNote: (id: string, input: NoteInput) => void
  deleteNote: (id: string) => void
  addTask: (input: TaskInput) => void
  updateTask: (id: string, input: TaskInput) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  addEvent: (input: EventInput) => void
  updateEvent: (id: string, input: EventInput) => void
  deleteEvent: (id: string) => void
  addDocument: (input: NoteInput) => void
  updateDocument: (id: string, input: NoteInput) => void
  deleteDocument: (id: string) => void
  addExpense: (input: ExpenseInput) => void
  updateExpense: (id: string, input: ExpenseInput) => void
  deleteExpense: (id: string) => void
  addGallery: (input: GalleryInput) => void
  updateGallery: (id: string, input: GalleryInput) => void
  deleteGallery: (id: string) => void
  addKeep: (input: KeepInput) => void
  deleteKeep: (id: string) => void
  addInbox: (input: InboxInput) => void
  deleteInbox: (id: string) => void
  addFolder: (input: FolderInput) => void
  updateFolder: (id: string, input: { name: string; accent: string; hideTitles: boolean; note: string }) => void
  changeFolderPassword: (id: string, current: string, next: string) => boolean
  deleteFolder: (id: string) => void
  addFolderItem: (folderId: string, input: { title: string; body: string }) => void
  deleteFolderItem: (folderId: string, itemId: string) => void
  addVault: (input: VaultInput) => void
  updateVault: (id: string, input: VaultInput) => void
  deleteVault: (id: string) => void
  clearVault: () => void
  unlockVault: (pin: string) => boolean
  lockVault: () => void
  setDisplayName: (name: string) => void
  setMonthlyBudget: (amount: number | null) => void
  setVaultPin: (pin: string | null) => void
  exportData: () => void
  importData: (raw: unknown) => string | null
  clearData: () => void
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => load())
  const [unlocked, setUnlocked] = useState(false)
  const [persistError, setPersistError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
      setPersistError(null)
    } catch {
      setPersistError('This device is out of room for more saved data. Export a backup or remove a large gallery image.')
    }
  }, [data])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const api = useMemo(() => {
    return {
      dismissToast: () => setToast(null),
      showToast: (message: string) => setToast(message),
      addNote: (input: NoteInput) => {
        setData((current) => {
          const at = nowIso()
          const item: Note = { id: uid(), title: input.title, body: input.body, createdAt: at, updatedAt: at }
          return withActivity({ ...current, notes: [item, ...current.notes] }, 'note', 'Added note', item.title, item.id)
        })
      },
      updateNote: (id: string, input: NoteInput) => {
        setData((current) => ({
          ...current,
          notes: current.notes.map((note) =>
            note.id === id ? { ...note, title: input.title, body: input.body, updatedAt: nowIso() } : note,
          ),
        }))
      },
      deleteNote: (id: string) => {
        setData((current) => {
          const item = current.notes.find((note) => note.id === id)
          if (!item) return current
          return withActivity(
            { ...current, notes: current.notes.filter((note) => note.id !== id) },
            'note',
            'Deleted note',
            item.title,
            id,
          )
        })
      },
      addTask: (input: TaskInput) => {
        setData((current) => {
          const at = nowIso()
          const item: Task = {
            id: uid(),
            title: input.title,
            notes: input.notes,
            done: false,
            dueDate: input.dueDate,
            createdAt: at,
            updatedAt: at,
          }
          return withActivity({ ...current, tasks: [item, ...current.tasks] }, 'task', 'Added task', item.title, item.id)
        })
      },
      updateTask: (id: string, input: TaskInput) => {
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === id ? { ...task, ...input, updatedAt: nowIso() } : task,
          ),
        }))
      },
      toggleTask: (id: string) => {
        setData((current) => {
          const task = current.tasks.find((item) => item.id === id)
          if (!task) return current
          const done = !task.done
          return withActivity(
            {
              ...current,
              tasks: current.tasks.map((item) => (item.id === id ? { ...item, done, updatedAt: nowIso() } : item)),
            },
            'task',
            done ? 'Completed task' : 'Reopened task',
            task.title,
            id,
          )
        })
      },
      deleteTask: (id: string) => {
        setData((current) => {
          const item = current.tasks.find((task) => task.id === id)
          if (!item) return current
          return withActivity(
            { ...current, tasks: current.tasks.filter((task) => task.id !== id) },
            'task',
            'Deleted task',
            item.title,
            id,
          )
        })
      },
      addEvent: (input: EventInput) => {
        setData((current) => {
          const at = nowIso()
          const item: CalendarEvent = { id: uid(), ...input, createdAt: at, updatedAt: at }
          return withActivity({ ...current, events: [item, ...current.events] }, 'event', 'Added event', item.title, item.id)
        })
      },
      updateEvent: (id: string, input: EventInput) => {
        setData((current) => ({
          ...current,
          events: current.events.map((event) => (event.id === id ? { ...event, ...input, updatedAt: nowIso() } : event)),
        }))
      },
      deleteEvent: (id: string) => {
        setData((current) => {
          const item = current.events.find((event) => event.id === id)
          if (!item) return current
          return withActivity(
            { ...current, events: current.events.filter((event) => event.id !== id) },
            'event',
            'Deleted event',
            item.title,
            id,
          )
        })
      },
      addDocument: (input: NoteInput) => {
        setData((current) => {
          const at = nowIso()
          const item: DocumentItem = { id: uid(), title: input.title, body: input.body, createdAt: at, updatedAt: at }
          return withActivity(
            { ...current, documents: [item, ...current.documents] },
            'document',
            'Added document',
            item.title,
            item.id,
          )
        })
      },
      updateDocument: (id: string, input: NoteInput) => {
        setData((current) => ({
          ...current,
          documents: current.documents.map((doc) =>
            doc.id === id ? { ...doc, title: input.title, body: input.body, updatedAt: nowIso() } : doc,
          ),
        }))
      },
      deleteDocument: (id: string) => {
        setData((current) => {
          const item = current.documents.find((doc) => doc.id === id)
          if (!item) return current
          return withActivity(
            { ...current, documents: current.documents.filter((doc) => doc.id !== id) },
            'document',
            'Deleted document',
            item.title,
            id,
          )
        })
      },
      addExpense: (input: ExpenseInput) => {
        setData((current) => {
          const at = nowIso()
          const item: Expense = { id: uid(), ...input, amount: roundMoney(input.amount), createdAt: at, updatedAt: at }
          return withActivity(
            { ...current, expenses: [item, ...current.expenses] },
            'expense',
            'Added expense',
            item.title,
            item.id,
          )
        })
      },
      updateExpense: (id: string, input: ExpenseInput) => {
        setData((current) => ({
          ...current,
          expenses: current.expenses.map((expense) =>
            expense.id === id ? { ...expense, ...input, amount: roundMoney(input.amount), updatedAt: nowIso() } : expense,
          ),
        }))
      },
      deleteExpense: (id: string) => {
        setData((current) => {
          const item = current.expenses.find((expense) => expense.id === id)
          if (!item) return current
          return withActivity(
            { ...current, expenses: current.expenses.filter((expense) => expense.id !== id) },
            'expense',
            'Deleted expense',
            item.title,
            id,
          )
        })
      },
      addGallery: (input: GalleryInput) => {
        setData((current) => {
          const at = nowIso()
          const item: GalleryItem = { id: uid(), ...input, createdAt: at, updatedAt: at }
          return withActivity(
            { ...current, gallery: [item, ...current.gallery] },
            'gallery',
            'Added gallery item',
            item.name,
            item.id,
          )
        })
      },
      updateGallery: (id: string, input: GalleryInput) => {
        setData((current) => ({
          ...current,
          gallery: current.gallery.map((item) => (item.id === id ? { ...item, ...input, updatedAt: nowIso() } : item)),
        }))
      },
      deleteGallery: (id: string) => {
        setData((current) => {
          const item = current.gallery.find((entry) => entry.id === id)
          if (!item) return current
          return withActivity(
            { ...current, gallery: current.gallery.filter((entry) => entry.id !== id) },
            'gallery',
            'Deleted gallery item',
            item.name,
            id,
          )
        })
      },
      addKeep: (input: KeepInput) => {
        setData((current) => {
          const item: Keep = {
            id: uid(),
            kind: input.kind,
            title: input.title,
            body: input.body,
            imageDataUrl: safeImageSrc(input.imageDataUrl || ''),
            audioDataUrl: safeAudioSrc(input.audioDataUrl || ''),
            fileName: input.fileName || '',
            createdAt: nowIso(),
          }
          return withActivity({ ...current, keeps: [item, ...current.keeps] }, 'keep', 'Saved', item.title, item.id)
        })
      },
      deleteKeep: (id: string) => {
        setData((current) => ({ ...current, keeps: current.keeps.filter((item) => item.id !== id) }))
      },
      addInbox: (input: InboxInput) => {
        setData((current) => {
          const item: InboxItem = {
            id: uid(),
            kind: input.kind,
            author: input.author.trim().slice(0, 80) || 'Chat',
            text: input.text.slice(0, MAX_BODY),
            imageDataUrl: safeImageSrc(input.imageDataUrl || ''),
            audioDataUrl: safeAudioSrc(input.audioDataUrl || ''),
            createdAt: nowIso(),
          }
          return withActivity({ ...current, inbox: [item, ...current.inbox] }, 'inbox', 'Saved from an app', item.author, item.id)
        })
      },
      deleteInbox: (id: string) => {
        setData((current) => ({ ...current, inbox: current.inbox.filter((item) => item.id !== id) }))
      },
      addFolder: (input: FolderInput) => {
        setData((current) => {
          const folder: PrivacyFolder = {
            id: uid(),
            name: input.name,
            password: input.password,
            accent: input.accent,
            hideTitles: false,
            note: input.note,
            items: [],
            createdAt: nowIso(),
          }
          return withActivity({ ...current, folders: [folder, ...current.folders] }, 'folder', 'Created folder', folder.name, folder.id)
        })
      },
      updateFolder: (id: string, input: { name: string; accent: string; hideTitles: boolean; note: string }) => {
        setData((current) => ({
          ...current,
          folders: current.folders.map((folder) => (folder.id === id ? { ...folder, ...input } : folder)),
        }))
      },
      changeFolderPassword: (id: string, currentPassword: string, next: string) => {
        const folder = dataRef.current.folders.find((item) => item.id === id)
        if (!folder || folder.password !== currentPassword || next.length < 4) return false
        setData((current) => ({
          ...current,
          folders: current.folders.map((item) => (item.id === id ? { ...item, password: next } : item)),
        }))
        return true
      },
      deleteFolder: (id: string) => {
        setData((current) => ({ ...current, folders: current.folders.filter((folder) => folder.id !== id) }))
      },
      addFolderItem: (folderId: string, input: { title: string; body: string }) => {
        setData((current) => ({
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === folderId
              ? { ...folder, items: [{ id: uid(), title: input.title, body: input.body, createdAt: nowIso() }, ...folder.items] }
              : folder,
          ),
        }))
      },
      deleteFolderItem: (folderId: string, itemId: string) => {
        setData((current) => ({
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === folderId ? { ...folder, items: folder.items.filter((item) => item.id !== itemId) } : folder,
          ),
        }))
      },
      addVault: (input: VaultInput) => {
        setData((current) => {
          const at = nowIso()
          const item: VaultItem = { id: uid(), ...input, createdAt: at, updatedAt: at }
          return withActivity({ ...current, vault: [item, ...current.vault] }, 'vault', 'Added vault item')
        })
      },
      updateVault: (id: string, input: VaultInput) => {
        setData((current) => ({
          ...current,
          vault: current.vault.map((item) => (item.id === id ? { ...item, ...input, updatedAt: nowIso() } : item)),
        }))
      },
      deleteVault: (id: string) => {
        setData((current) => {
          if (!current.vault.some((item) => item.id === id)) return current
          return withActivity(
            { ...current, vault: current.vault.filter((item) => item.id !== id) },
            'vault',
            'Deleted vault item',
          )
        })
      },
      clearVault: () => {
        setData((current) => ({
          ...current,
          vault: [],
          settings: { ...current.settings, vaultPin: null },
        }))
        setUnlocked(false)
        setToast('Vault and PIN cleared on this device.')
      },
      unlockVault: (pin: string) => {
        if (pin && pin === dataRef.current.settings.vaultPin) {
          setUnlocked(true)
          return true
        }
        return false
      },
      lockVault: () => setUnlocked(false),
      setDisplayName: (name: string) => {
        const displayName = clip(name, 40) || 'N'
        setData((current) => ({ ...current, settings: { ...current.settings, displayName } }))
      },
      setMonthlyBudget: (amount: number | null) => {
        const monthlyBudget = amount != null && amount >= 0 ? roundMoney(amount) : null
        setData((current) => ({ ...current, settings: { ...current.settings, monthlyBudget } }))
      },
      setVaultPin: (pin: string | null) => {
        if (pin != null && !/^\d{4,6}$/.test(pin)) return
        setData((current) => ({ ...current, settings: { ...current.settings, vaultPin: pin } }))
        setUnlocked(Boolean(pin))
      },
      exportData: () => {
        const payload = {
          version: 1,
          app: 'Niji',
          exportedAt: nowIso(),
          data: dataRef.current,
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `niji-backup-${dateKey()}.json`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        setToast('Backup downloaded.')
      },
      importData: (raw: unknown) => {
        const next = normalize(raw)
        if (!next) return 'Choose a backup file exported from Niji.'
        setData(next)
        setUnlocked(false)
        setToast('Backup imported.')
        return null
      },
      clearData: () => {
        setData(emptyData())
        setUnlocked(false)
        setToast('All saved data on this device was cleared.')
      },
    }
  }, [])

  const value = useMemo<StoreApi>(
    () => ({
      data,
      vaultLocked: Boolean(data.settings.vaultPin) && !unlocked,
      persistError,
      toast,
      ...api,
    }),
    [api, data, persistError, toast, unlocked],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('Store missing')
  return ctx
}
