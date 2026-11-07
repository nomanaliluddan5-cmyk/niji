import { useMemo, useState } from 'react'

const ICONS = ['📒', '🔑', '🌙', '📖', '🪙', '📷', '🍃', '🔥']
const BEST_KEY = 'my-personal-app.game'

type Card = { uid: string; icon: string }

function shuffle(): Card[] {
  const cards = ICONS.flatMap((icon, index) => [
    { uid: `${index}-a`, icon },
    { uid: `${index}-b`, icon },
  ])
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = cards[i]
    cards[i] = cards[j]
    cards[j] = swap
  }
  return cards
}

function readBest() {
  try {
    const value = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function PlayScreen() {
  const [cards, setCards] = useState<Card[]>(() => shuffle())
  const [open, setOpen] = useState<string[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const [best, setBest] = useState<number | null>(() => readBest())
  const [lock, setLock] = useState(false)
  const won = matched.length === ICONS.length

  const status = useMemo(() => {
    if (won) return 'All eight pairs found.'
    return 'Flip two lanterns. Match the pair.'
  }, [won])

  function restart() {
    setCards(shuffle())
    setOpen([])
    setMatched([])
    setMoves(0)
    setLock(false)
  }

  function flip(card: Card) {
    if (lock || won || open.includes(card.uid) || matched.includes(card.icon)) return
    const next = [...open, card.uid]
    if (next.length > 2) return
    setOpen(next)
    if (next.length < 2) return
    setMoves((count) => count + 1)
    const [firstId, secondId] = next
    const first = cards.find((item) => item.uid === firstId)
    const second = cards.find((item) => item.uid === secondId)
    if (first && second && first.icon === second.icon) {
      const icons = [...matched, first.icon]
      setMatched(icons)
      setOpen([])
      if (icons.length === ICONS.length) {
        const total = moves + 1
        setBest((current) => {
          const better = current == null || total < current ? total : current
          if (better !== current) localStorage.setItem(BEST_KEY, String(better))
          return better
        })
      }
      return
    }
    setLock(true)
    window.setTimeout(() => {
      setOpen([])
      setLock(false)
    }, 700)
  }

  return (
    <div className="play">
      <p className="kicker">Offline</p>
      <h1>Lanterns</h1>
      <p className="quiet">{status}</p>
      <div className="play-meta">
        <span>Moves {moves}</span>
        <span>Best {best ?? '—'}</span>
        <button type="button" onClick={restart}>New game</button>
      </div>
      <div className="board">
        {cards.map((card) => {
          const shown = open.includes(card.uid) || matched.includes(card.icon)
          return (
            <button key={card.uid} type="button" className={shown ? 'lantern up' : 'lantern'} onClick={() => flip(card)} aria-label={shown ? card.icon : 'Hidden lantern'}>
              <span>{shown ? card.icon : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
