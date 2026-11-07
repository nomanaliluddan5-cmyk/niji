type ZipFile = { name: string; text: string }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let crc = n
    for (let k = 0; k < 8; k += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
    table[n] = crc >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDate(date: Date) {
  const year = Math.max(0, date.getFullYear() - 1980)
  return ((year & 0x7f) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
}

export function zipBlob(files: ZipFile[], date = new Date()) {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const time = 0
  const day = dosDate(date)

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.text)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(6, 0, true)
    view.setUint16(8, 0, true)
    view.setUint16(10, time, true)
    view.setUint16(12, day, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, name.length, true)
    view.setUint16(28, 0, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    locals.push(local)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, day, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  endView.setUint16(20, 0, true)

  const parts = [...locals, ...centrals, end].map((bytes) => {
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return copy
  })
  return new Blob(parts, { type: 'application/zip' })
}

export function downloadWindowsPacket() {
  const info = {
    name: 'Niji',
    tagline: 'Everything in one place',
    platform: 'Windows setup packet',
    storage: 'This device, in the browser',
    features: [
      'Save files, notes, book pages, voice, documents, and downloads',
      'Inbox for pasted chats, photos, voice notes, call notes, and recordings',
      'Private folders with their own passwords',
      'Daily notes, tasks, expenses in Rs, calendar, documents, and gallery',
      'A small offline game',
      'Local signup and login',
    ],
  }
  const readme = [
    'Niji',
    'Everything in one place',
    '',
    'This Windows packet is the setup guide for Niji.',
    'The app runs in the browser. Files, notes, folders, daily records,',
    'and the game stay on this device.',
    '',
    'What you can keep',
    '- Save: a file, a note, a photo of a book page, a voice clip, a document, or a download.',
    '- Inbox: paste chat text, or add a photo, voice note, call note, or recording.',
    '- Folders: each folder has its own password and settings.',
    '- Daily: notes, tasks, expenses in Rs, a calendar, documents, and a gallery.',
    '- Play: a small matching game that works offline.',
    '- Accounts: sign up and log in on this device. There is no account server.',
    '',
    'How to open it',
    '1. Run Install-Niji.bat if you want the setup message.',
    '2. Open Niji in the browser.',
    '3. Sign up or log in, in either order. The Windows download does not require an account.',
    '4. Use Save, Folders, Daily, and Play along the bottom.',
    '',
    'Any account you create is stored only in this browser, as plain text.',
    'Keep this device private.',
    '',
  ].join('\r\n')
  const bat = [
    '@echo off',
    'title Niji',
    'echo.',
    'echo Niji',
    'echo Everything in one place',
    'echo.',
    'echo Setup for this device:',
    'echo - Save files, notes, book pages, voice, documents, and downloads',
    'echo - Private folders, daily tools, and a small offline game',
    'echo - Your data stays on this device',
    'echo.',
    'echo Open Niji in your browser, then sign up or log in.',
    'echo.',
    'pause',
    '',
  ].join('\r\n')
  const blob = zipBlob([
    { name: 'README.txt', text: readme },
    { name: 'Niji.json', text: `${JSON.stringify(info, null, 2)}\r\n` },
    { name: 'Install-Niji.bat', text: bat },
  ])
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Niji-Windows.zip'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
