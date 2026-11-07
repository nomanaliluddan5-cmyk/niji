import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dateKey, roundMoney } from './lib/format'
import { safeAudioSrc, safeImageSrc } from './lib/images'
import { asKdfParams, asSealedBox, deriveKey, newKdfParams, open, seal, type KdfParams, type SealedBox } from './lib/crypto'
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
  return { displayName: 'N', monthlyBudget: null, vaultLock: null }
}

function emptyData(): AppData {
  return {
    notes: [],
    tasks: [],
    events: [],
    vault: null,
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

type LegacyFolder = Omit<PrivacyFolder, 'itemCount' | 'kdf' | 'sealed'> & { password: string; items: FolderItem[] }

type Legacy = { folders: LegacyFolder[]; vault: VaultItem[]; vaultPin: string | null }

type Migrated = { folders: PrivacyFolder[]; vault: SealedBox | null; vaultLock: KdfParams | null }

function folderMeta(row: Record<string, unknown>) {
  const id = asString(row.id)
  const name = clip(asString(row.name), 60)
  if (!id || !name) return null
  return {
    id,
    name,
    accent: /^#[0-9a-fA-F]{6}$/.test(asString(row.accent)) ? asString(row.accent) : '#e7a15a',
    hideTitles: row.hideTitles === true,
    note: asString(row.note).slice(0, 400),
    createdAt: asDateString(row.createdAt),
  }
}

function mapFolder(row: Record<string, unknown>): PrivacyFolder | null {
  const meta = folderMeta(row)
  const kdf = asKdfParams(row.kdf)
  const sealed = asSealedBox(row.sealed)
  if (!meta || !kdf || !sealed) return null
  const itemCount = typeof row.itemCount === 'number' && Number.isInteger(row.itemCount) && row.itemCount >= 0 ? row.itemCount : 0
  return { ...meta, itemCount, kdf, sealed }
}

function mapLegacyFolder(row: Record<string, unknown>): LegacyFolder | null {
  const meta = folderMeta(row)
  const password = asString(row.password)
  if (!meta || password.length < 4 || 'sealed' in row) return null
  return { ...meta, password: password.slice(0, 40), items: mapItems(row.items, mapFolderItem) }
}

async function sealFolder(meta: Omit<PrivacyFolder, 'itemCount' | 'kdf' | 'sealed'>, password: string, items: FolderItem[]) {
  const kdf = newKdfParams()
  const key = await deriveKey(password, kdf)
  const folder: PrivacyFolder = { ...meta, itemCount: items.length, kdf, sealed: await seal(key, items) }
  return { folder, key }
}

/** Encrypts plain-text folders and vault data written by earlier versions. */
async function migrateLegacy(legacy: Legacy): Promise<Migrated> {
  const folders = await Promise.all(
    legacy.folders.map(async ({ password, items, ...meta }) => (await sealFolder(meta, password, items)).folder),
  )
  if (!legacy.vaultPin) return { folders, vault: null, vaultLock: null }
  const vaultLock = newKdfParams()
  const vault = await seal(await deriveKey(legacy.vaultPin, vaultLock), legacy.vault)
  return { folders, vault, vaultLock }
}

function applyMigrated(data: AppData, migrated: Migrated): AppData {
  const ids = new Set(migrated.folders.map((folder) => folder.id))
  return {
    ...data,
    folders: [...migrated.folders, ...data.folders.filter((folder) => !ids.has(folder.id))],
    vault: migrated.vault ?? data.vault,
    settings: { ...data.settings, vaultLock: migrated.vaultLock ?? data.settings.vaultLock },
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

type Loaded = { data: AppData; legacy: Legacy | null }

function normalize(raw: unknown): Loaded | null {
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
  const vaultPin = /^\d{4,6}$/.test(pin) ? pin : null
  const settings: Settings = {
    displayName: clip(asString(settingsRaw.displayName, 'N'), 40) || 'N',
    monthlyBudget: typeof budget === 'number' && Number.isFinite(budget) && budget >= 0 ? roundMoney(budget) : null,
    vaultLock: asKdfParams(settingsRaw.vaultLock),
  }
  const vault = asSealedBox(source.vault)
  const legacyVault = mapItems(source.vault, mapVault)
  const legacyFolders = mapItems(source.folders, mapLegacyFolder)
  const legacy: Legacy | null =
    legacyFolders.length > 0 || vaultPin || legacyVault.length > 0
      ? { folders: legacyFolders, vault: legacyVault, vaultPin }
      : null
  const data: AppData = {
    notes: mapItems(source.notes, mapNote),
    tasks: mapItems(source.tasks, mapTask),
    events: mapItems(source.events, mapEvent),
    vault: vault && settings.vaultLock ? vault : null,
    documents: mapItems(source.documents, mapDocument),
    expenses: mapItems(source.expenses, mapExpense),
    gallery: mapItems(source.gallery, mapGallery),
    keeps: mapItems(source.keeps, mapKeep),
    inbox: mapItems(source.inbox, mapInbox),
    folders: mapItems(source.folders, mapFolder),
    activity: mapItems(source.activity, mapActivity).slice(0, 40),
    settings: vault ? settings : { ...settings, vaultLock: null },
    initialized: true,
  }
  return { data, legacy }
}

function load(): Loaded {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { data: seed(), legacy: null }
    return normalize(JSON.parse(raw)) ?? { data: seed(), legacy: null }
  } catch {
    return { data: seed(), legacy: null }
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

/** An unlocked folder: its key and decrypted items live only in memory. */
export type FolderSession = { id: string; key: CryptoKey; items: FolderItem[] }

type VaultSession = { key: CryptoKey; items: VaultItem[] }

export type StoreApi = {
  data: AppData
  migrating: boolean
  vaultLocked: boolean
  vaultItems: VaultItem[]
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
  addFolder: (input: FolderInput) => Promise<void>
  updateFolder: (id: string, input: { name: string; accent: string; hideTitles: boolean; note: string }) => void
  unlockFolder: (id: string, password: string) => Promise<FolderSession | null>
  saveFolderItems: (session: FolderSession, items: FolderItem[]) => Promise<FolderSession>
  changeFolderPassword: (id: string, current: string, next: string) => Promise<FolderSession | null>
  deleteFolder: (id: string) => void
  addVault: (input: VaultInput) => Promise<boolean>
  updateVault: (id: string, input: VaultInput) => Promise<boolean>
  deleteVault: (id: string) => Promise<boolean>
  clearVault: () => void
  unlockVault: (pin: string) => Promise<boolean>
  lockVault: () => void
  setDisplayName: (name: string) => void
  setMonthlyBudget: (amount: number | null) => void
  setVaultPin: (pin: string) => Promise<boolean>
  exportData: () => void
  importData: (raw: unknown) => Promise<string | null>
  clearData: () => void
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => load())
  const [data, setData] = useState<AppData>(initial.data)
  const [migrating, setMigrating] = useState(initial.legacy != null)
  const [vaultSession, setVaultSession] = useState<VaultSession | null>(null)
  const [persistError, setPersistError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const vaultRef = useRef(vaultSession)
  vaultRef.current = vaultSession

  useEffect(() => {
    if (!initial.legacy) return
    migrateLegacy(initial.legacy)
      .then((migrated) => {
        setData((current) => applyMigrated(current, migrated))
        setMigrating(false)
      })
      .catch(() => setPersistError('Niji could not encrypt older folders on this device. Reload to try again.'))
  }, [initial])

  useEffect(() => {
    // Until legacy data is encrypted, keep the old copy on disk rather than overwrite it without those folders.
    if (migrating) return
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
      setPersistError(null)
    } catch {
      setPersistError('This device is out of room for more saved data. Export a backup or remove a large gallery image.')
    }
  }, [data, migrating])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const api = useMemo(() => {
    async function storeVault(key: CryptoKey, items: VaultItem[]) {
      const vault = await seal(key, items)
      setData((current) => ({ ...current, vault }))
      setVaultSession({ key, items })
    }
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
      addFolder: async (input: FolderInput) => {
        const { folder } = await sealFolder(
          { id: uid(), name: input.name, accent: input.accent, hideTitles: false, note: input.note, createdAt: nowIso() },
          input.password,
          [],
        )
        setData((current) =>
          withActivity({ ...current, folders: [folder, ...current.folders] }, 'folder', 'Created folder', folder.name, folder.id),
        )
      },
      updateFolder: (id: string, input: { name: string; accent: string; hideTitles: boolean; note: string }) => {
        setData((current) => ({
          ...current,
          folders: current.folders.map((folder) => (folder.id === id ? { ...folder, ...input } : folder)),
        }))
      },
      unlockFolder: async (id: string, password: string) => {
        const folder = dataRef.current.folders.find((item) => item.id === id)
        if (!folder) return null
        const key = await deriveKey(password, folder.kdf)
        const items = await open(key, folder.sealed)
        if (!Array.isArray(items)) return null
        return { id, key, items: mapItems(items, mapFolderItem) }
      },
      saveFolderItems: async (session: FolderSession, items: FolderItem[]) => {
        const sealed = await seal(session.key, items)
        setData((current) => ({
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === session.id ? { ...folder, sealed, itemCount: items.length } : folder,
          ),
        }))
        return { ...session, items }
      },
      changeFolderPassword: async (id: string, currentPassword: string, next: string) => {
        const folder = dataRef.current.folders.find((item) => item.id === id)
        if (!folder || next.length < 4) return null
        const currentKey = await deriveKey(currentPassword, folder.kdf)
        const raw = await open(currentKey, folder.sealed)
        if (!Array.isArray(raw)) return null
        const items = mapItems(raw, mapFolderItem)
        const { folder: resealed, key } = await sealFolder(folder, next, items)
        setData((current) => ({
          ...current,
          folders: current.folders.map((item) =>
            item.id === id ? { ...item, kdf: resealed.kdf, sealed: resealed.sealed, itemCount: items.length } : item,
          ),
        }))
        return { id, key, items }
      },
      deleteFolder: (id: string) => {
        setData((current) => ({ ...current, folders: current.folders.filter((folder) => folder.id !== id) }))
      },
      addVault: async (input: VaultInput) => {
        const session = vaultRef.current
        if (!session) return false
        const at = nowIso()
        const item: VaultItem = { id: uid(), ...input, createdAt: at, updatedAt: at }
        await storeVault(session.key, [item, ...session.items])
        setData((current) => withActivity(current, 'vault', 'Added vault item'))
        return true
      },
      updateVault: async (id: string, input: VaultInput) => {
        const session = vaultRef.current
        if (!session) return false
        const items = session.items.map((item) => (item.id === id ? { ...item, ...input, updatedAt: nowIso() } : item))
        await storeVault(session.key, items)
        return true
      },
      deleteVault: async (id: string) => {
        const session = vaultRef.current
        if (!session || !session.items.some((item) => item.id === id)) return false
        await storeVault(session.key, session.items.filter((item) => item.id !== id))
        setData((current) => withActivity(current, 'vault', 'Deleted vault item'))
        return true
      },
      clearVault: () => {
        setData((current) => ({
          ...current,
          vault: null,
          settings: { ...current.settings, vaultLock: null },
        }))
        setVaultSession(null)
        setToast('Vault and PIN cleared on this device.')
      },
      unlockVault: async (pin: string) => {
        const { vault, settings } = dataRef.current
        if (!pin || !vault || !settings.vaultLock) return false
        const key = await deriveKey(pin, settings.vaultLock)
        const items = await open(key, vault)
        if (!Array.isArray(items)) return false
        setVaultSession({ key, items: mapItems(items, mapVault) })
        return true
      },
      lockVault: () => setVaultSession(null),
      setDisplayName: (name: string) => {
        const displayName = clip(name, 40) || 'N'
        setData((current) => ({ ...current, settings: { ...current.settings, displayName } }))
      },
      setMonthlyBudget: (amount: number | null) => {
        const monthlyBudget = amount != null && amount >= 0 ? roundMoney(amount) : null
        setData((current) => ({ ...current, settings: { ...current.settings, monthlyBudget } }))
      },
      setVaultPin: async (pin: string) => {
        if (!/^\d{4,6}$/.test(pin)) return false
        if (dataRef.current.settings.vaultLock && !vaultRef.current) return false
        const vaultLock = newKdfParams()
        const key = await deriveKey(pin, vaultLock)
        const items = vaultRef.current?.items ?? []
        const vault = await seal(key, items)
        setData((current) => ({ ...current, vault, settings: { ...current.settings, vaultLock } }))
        setVaultSession({ key, items })
        return true
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
      importData: async (raw: unknown) => {
        const next = normalize(raw)
        if (!next) return 'Choose a backup file exported from Niji.'
        setData(next.legacy ? applyMigrated(next.data, await migrateLegacy(next.legacy)) : next.data)
        setVaultSession(null)
        setToast('Backup imported.')
        return null
      },
      clearData: () => {
        setData(emptyData())
        setVaultSession(null)
        setToast('All saved data on this device was cleared.')
      },
    }
  }, [])

  const value = useMemo<StoreApi>(
    () => ({
      data,
      migrating,
      vaultLocked: Boolean(data.settings.vaultLock) && !vaultSession,
      vaultItems: vaultSession?.items ?? [],
      persistError,
      toast,
      ...api,
    }),
    [api, data, migrating, persistError, toast, vaultSession],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('Store missing')
  return ctx
}
