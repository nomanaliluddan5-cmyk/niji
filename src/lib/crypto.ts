const ITERATIONS = 600_000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type KdfParams = { salt: string; iterations: number }
export type PasswordHash = KdfParams & { hash: string }
export type SealedBox = { iv: string; data: string }

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length))
}

async function baseKey(password: string) {
  return crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
}

export function newKdfParams(): KdfParams {
  return { salt: toBase64(randomBytes(16)), iterations: ITERATIONS }
}

export function asKdfParams(value: unknown): KdfParams | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.salt !== 'string' || !row.salt) return null
  if (typeof row.iterations !== 'number' || !Number.isInteger(row.iterations) || row.iterations < 100_000 || row.iterations > 5_000_000) return null
  return { salt: row.salt, iterations: row.iterations }
}

export function asPasswordHash(value: unknown): PasswordHash | null {
  const params = asKdfParams(value)
  const hash = value && typeof value === 'object' ? (value as Record<string, unknown>).hash : null
  return params && typeof hash === 'string' && hash ? { ...params, hash } : null
}

export function asSealedBox(value: unknown): SealedBox | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return typeof row.iv === 'string' && typeof row.data === 'string' && row.iv && row.data ? { iv: row.iv, data: row.data } : null
}

export async function hashPassword(password: string, params: KdfParams = newKdfParams()): Promise<PasswordHash> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(params.salt), iterations: params.iterations },
    await baseKey(password),
    256,
  )
  return { ...params, hash: toBase64(new Uint8Array(bits)) }
}

export async function verifyPassword(password: string, stored: PasswordHash) {
  const candidate = fromBase64((await hashPassword(password, stored)).hash)
  const expected = fromBase64(stored.hash)
  if (candidate.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i += 1) diff |= candidate[i] ^ expected[i]
  return diff === 0
}

export async function deriveKey(password: string, params: KdfParams) {
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(params.salt), iterations: params.iterations },
    await baseKey(password),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(key: CryptoKey, value: unknown): Promise<SealedBox> {
  const iv = randomBytes(12)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)))
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) }
}

/** Returns null when the key is wrong or the box was tampered with. */
export async function open(key: CryptoKey, box: SealedBox): Promise<unknown> {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) }, key, fromBase64(box.data))
    return JSON.parse(decoder.decode(plain))
  } catch {
    return null
  }
}
