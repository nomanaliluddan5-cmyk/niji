export type ParsedChat = { author: string; text: string }

const LINE = [
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+([^:]+):\s*([\s\S]*)$/i,
  /^(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s[-–]\s([^:]+):\s*([\s\S]*)$/i,
]

function matchLine(line: string) {
  for (const pattern of LINE) {
    const hit = line.match(pattern)
    if (hit) return { author: hit[2].trim(), text: hit[3].trim() }
  }
  return null
}

export function parseChat(raw: string): ParsedChat[] {
  const out: ParsedChat[] = []
  for (const line of raw.split(/\r?\n/)) {
    const hit = matchLine(line.trim())
    if (hit && (hit.author || hit.text)) out.push(hit)
    else if (out.length && line.trim()) out[out.length - 1].text += `\n${line.trim()}`
  }
  const messages = out.filter((item) => item.text || item.author)
  if (messages.length) return messages.slice(0, 80)
  const text = raw.trim()
  return text ? [{ author: 'Pasted chat', text: text.slice(0, 20000) }] : []
}
