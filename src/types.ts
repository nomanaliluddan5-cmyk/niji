import type { KdfParams, SealedBox } from './lib/crypto'

export const MAX_TITLE = 180
export const MAX_BODY = 20000
export const MAX_NAME = 80

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Personal',
  'Other',
] as const

export type PageId =
  | 'save'
  | 'dashboard'
  | 'notes'
  | 'tasks'
  | 'calendar'
  | 'vault'
  | 'documents'
  | 'expenses'
  | 'gallery'
  | 'settings'
  | 'download'

export type ActivityKind = 'note' | 'task' | 'document' | 'expense' | 'event' | 'vault' | 'gallery' | 'keep' | 'inbox' | 'folder'

export type KeepKind = 'file' | 'note' | 'book' | 'voice' | 'document' | 'download'

export type Keep = {
  id: string
  kind: KeepKind
  title: string
  body: string
  imageDataUrl: string
  audioDataUrl: string
  fileName: string
  createdAt: string
}

export type InboxKind = 'chat' | 'photo' | 'voice' | 'call' | 'recording'

export type InboxItem = {
  id: string
  kind: InboxKind
  author: string
  text: string
  imageDataUrl: string
  audioDataUrl: string
  createdAt: string
}

export type FolderItem = {
  id: string
  title: string
  body: string
  createdAt: string
}

export type PrivacyFolder = {
  id: string
  name: string
  accent: string
  hideTitles: boolean
  note: string
  itemCount: number
  /** Key-derivation salt for the folder password; items are only stored sealed with AES-GCM. */
  kdf: KdfParams
  sealed: SealedBox
  createdAt: string
}

export type Note = {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export type Task = {
  id: string
  title: string
  notes: string
  done: boolean
  dueDate: string
  createdAt: string
  updatedAt: string
}

export type CalendarEvent = {
  id: string
  title: string
  date: string
  time: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type VaultItem = {
  id: string
  title: string
  username: string
  secret: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type DocumentItem = {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export type Expense = {
  id: string
  title: string
  amount: number
  category: string
  date: string
  createdAt: string
  updatedAt: string
}

export type GalleryItem = {
  id: string
  name: string
  note: string
  imageDataUrl: string
  createdAt: string
  updatedAt: string
}

export type Activity = {
  id: string
  kind: ActivityKind
  label: string
  detail?: string
  refId?: string
  at: string
}

export type Settings = {
  displayName: string
  monthlyBudget: number | null
  vaultLock: KdfParams | null
}

export type AppData = {
  notes: Note[]
  tasks: Task[]
  events: CalendarEvent[]
  vault: SealedBox | null
  documents: DocumentItem[]
  expenses: Expense[]
  gallery: GalleryItem[]
  keeps: Keep[]
  inbox: InboxItem[]
  folders: PrivacyFolder[]
  activity: Activity[]
  settings: Settings
  initialized: boolean
}

export type EditorRequest =
  | { kind: 'note'; id?: string }
  | { kind: 'task'; id?: string }
  | { kind: 'expense'; id?: string }
  | { kind: 'document'; id?: string }
  | { kind: 'event'; id?: string; date?: string }
  | { kind: 'vault'; id?: string }
  | { kind: 'gallery'; id?: string }
