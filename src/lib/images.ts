const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

export function safeAudioSrc(url: unknown) {
  if (typeof url !== 'string' || url.length > 500_000) return ''
  if (url.startsWith('data:audio/')) return url
  if (url.startsWith('data:video/webm') || url.startsWith('data:video/mp4')) return url
  return ''
}

export function safeImageSrc(url: unknown) {
  if (typeof url !== 'string' || url.length > 500_000 || !url.startsWith('data:image/')) return ''
  const semi = url.indexOf(';')
  if (semi < 0) return ''
  const mime = url.slice('data:'.length, semi)
  if (!ALLOWED.has(mime)) return ''
  if (!url.startsWith(`${url.slice(0, semi)};base64,`)) return ''
  return url
}

export async function imageFileToDataUrl(file: File) {
  if (file.type && !ALLOWED.has(file.type)) {
    throw new Error('Use a PNG, JPEG, WEBP, or GIF image.')
  }
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    const raw = await readFile(file)
    const safe = safeImageSrc(raw)
    if (!safe) throw new Error('Use a PNG, JPEG, WEBP, or GIF image.')
    if (safe.length > 400_000) {
      throw new Error('That image is too large to keep on this device. Try a smaller photo.')
    }
    return safe
  }
  const max = 960
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not read that image.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', 0.72)
  if (url.length > 400_000) {
    throw new Error('That image is too large to keep on this device. Try a smaller photo.')
  }
  return url
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}
