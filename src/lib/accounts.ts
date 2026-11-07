import { useCallback, useState } from 'react'

const ACCOUNTS_KEY = 'my-personal-app.accounts'
const SESSION_KEY = 'my-personal-app.session'

type StoredAccount = {
  id: string
  name: string
  email: string
  password: string
  createdAt: string
}

export type PublicAccount = {
  id: string
  name: string
  email: string
  createdAt: string
}

function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is StoredAccount => {
      if (!item || typeof item !== 'object') return false
      const row = item as Record<string, unknown>
      return typeof row.id === 'string' && typeof row.email === 'string' && typeof row.password === 'string' && typeof row.name === 'string'
    })
  } catch {
    return []
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function toPublic(account: StoredAccount): PublicAccount {
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

export function signupAccount(input: { name: string; email: string; password: string }): { account?: PublicAccount; error?: string } {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const password = input.password
  if (!name) return { error: 'Add your name.' }
  if (!validEmail(email)) return { error: 'Enter an email address.' }
  if (password.length < 4) return { error: 'Use a password of at least 4 characters.' }
  const accounts = readAccounts()
  if (accounts.some((item) => item.email === email)) {
    return { error: 'That email already has a Niji account on this device.' }
  }
  const account: StoredAccount = {
    id: crypto.randomUUID(),
    name: name.slice(0, 40),
    email,
    password,
    createdAt: new Date().toISOString(),
  }
  writeAccounts([account, ...accounts])
  localStorage.setItem(SESSION_KEY, account.id)
  return { account: toPublic(account) }
}

export function loginAccount(input: { email: string; password: string }): { account?: PublicAccount; error?: string } {
  const email = normalizeEmail(input.email)
  const account = readAccounts().find((item) => item.email === email && item.password === input.password)
  if (!account) return { error: 'Enter the email and password saved for Niji on this device.' }
  localStorage.setItem(SESSION_KEY, account.id)
  return { account: toPublic(account) }
}

export function logoutAccount() {
  localStorage.removeItem(SESSION_KEY)
}

export function useAccount() {
  const [account, setAccount] = useState<PublicAccount | null>(() => currentAccount())
  const refresh = useCallback(() => setAccount(currentAccount()), [])
  const signup = useCallback((input: { name: string; email: string; password: string }) => {
    const result = signupAccount(input)
    if (result.account) setAccount(result.account)
    return result
  }, [])
  const login = useCallback((input: { email: string; password: string }) => {
    const result = loginAccount(input)
    if (result.account) setAccount(result.account)
    return result
  }, [])
  const logout = useCallback(() => {
    logoutAccount()
    setAccount(null)
  }, [])
  return { account, signup, login, logout, refresh }
}
