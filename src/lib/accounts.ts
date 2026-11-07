import { useCallback, useState } from 'react'
import { asPasswordHash, hashPassword, verifyPassword, type PasswordHash } from './crypto'

const ACCOUNTS_KEY = 'my-personal-app.accounts'
const SESSION_KEY = 'my-personal-app.session'

type StoredAccount = {
  id: string
  name: string
  email: string
  passwordHash: PasswordHash
  createdAt: string
}

type LegacyAccount = Omit<StoredAccount, 'passwordHash'> & { password: string }

export type PublicAccount = {
  id: string
  name: string
  email: string
  createdAt: string
}

function readRows(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== 'object') return false
      const row = item as Record<string, unknown>
      return typeof row.id === 'string' && typeof row.email === 'string' && typeof row.name === 'string'
    })
  } catch {
    return []
  }
}

function base(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
  }
}

function readAccounts(): (StoredAccount | LegacyAccount)[] {
  const out: (StoredAccount | LegacyAccount)[] = []
  for (const row of readRows()) {
    const passwordHash = asPasswordHash(row.passwordHash)
    if (passwordHash) out.push({ ...base(row), passwordHash })
    else if (typeof row.password === 'string') out.push({ ...base(row), password: row.password })
  }
  return out
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

async function hashed(account: StoredAccount | LegacyAccount): Promise<StoredAccount> {
  if ('passwordHash' in account) return account
  const { password, ...rest } = account
  return { ...rest, passwordHash: await hashPassword(password) }
}

let migration: Promise<void> | null = null

/** Replaces any plain-text passwords left by earlier versions with salted PBKDF2 hashes. */
export function migrateLegacyAccounts() {
  migration ??= (async () => {
    const accounts = readAccounts()
    if (!accounts.some((item) => 'password' in item)) return
    writeAccounts(await Promise.all(accounts.map(hashed)))
  })().catch(() => undefined)
  return migration
}

function toPublic(account: StoredAccount | LegacyAccount): PublicAccount {
  return { id: account.id, name: account.name, email: account.email, createdAt: account.createdAt }
}

export function currentAccount(): PublicAccount | null {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const account = readAccounts().find((item) => item.id === id)
    return account ? toPublic(account) : null
  } catch {
    return null
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

type AuthResult = { account?: PublicAccount; error?: string }

export async function signupAccount(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const password = input.password
  if (!name) return { error: 'Add your name.' }
  if (!validEmail(email)) return { error: 'Enter an email address.' }
  if (password.length < 4) return { error: 'Use a password of at least 4 characters.' }
  await migrateLegacyAccounts()
  if (readAccounts().some((item) => item.email === email)) {
    return { error: 'That email already has a Niji account on this device.' }
  }
  const account: StoredAccount = {
    id: crypto.randomUUID(),
    name: name.slice(0, 40),
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  const accounts = await Promise.all(readAccounts().map(hashed))
  writeAccounts([account, ...accounts])
  localStorage.setItem(SESSION_KEY, account.id)
  return { account: toPublic(account) }
}

export async function loginAccount(input: { email: string; password: string }): Promise<AuthResult> {
  const email = normalizeEmail(input.email)
  await migrateLegacyAccounts()
  const account = readAccounts().find((item) => item.email === email)
  const ok = account ? await verifyPassword(input.password, (await hashed(account)).passwordHash) : false
  if (!account || !ok) return { error: 'Enter the email and password saved for Niji on this device.' }
  localStorage.setItem(SESSION_KEY, account.id)
  return { account: toPublic(account) }
}

export function logoutAccount() {
  localStorage.removeItem(SESSION_KEY)
}

export function useAccount() {
  const [account, setAccount] = useState<PublicAccount | null>(() => currentAccount())
  const refresh = useCallback(() => setAccount(currentAccount()), [])
  const signup = useCallback(async (input: { name: string; email: string; password: string }) => {
    const result = await signupAccount(input)
    if (result.account) setAccount(result.account)
    return result
  }, [])
  const login = useCallback(async (input: { email: string; password: string }) => {
    const result = await loginAccount(input)
    if (result.account) setAccount(result.account)
    return result
  }, [])
  const logout = useCallback(() => {
    logoutAccount()
    setAccount(null)
  }, [])
  return { account, signup, login, logout, refresh }
}
