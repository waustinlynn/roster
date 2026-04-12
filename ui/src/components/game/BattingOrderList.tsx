import { useState, useEffect } from 'react'
import type { PlayerResponse } from '../../api/index'

interface Props {
  players: PlayerResponse[]          // active, non-absent players
  absentPlayerIds: string[]
  initialOrder: string[]             // saved battingOrder player IDs
  isLocked: boolean
  onSave: (orderedPlayerIds: string[]) => Promise<void>
}

export function BattingOrderList({ players, absentPlayerIds, initialOrder, isLocked, onSave }: Props) {
  const available = players.filter(p => p.isActive && !absentPlayerIds.includes(p.playerId!))

  const buildInitial = () => {
    const saved = initialOrder.filter(id => available.some(p => p.playerId === id))
    const remaining = available.filter(p => !saved.includes(p.playerId!)).map(p => p.playerId!)
    return [...saved, ...remaining]
  }

  const [order, setOrder] = useState<string[]>(buildInitial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setOrder(buildInitial()) }, [initialOrder.join(','), available.map(p => p.playerId).join(',')])

  const move = (idx: number, dir: -1 | 1) => {
    setOrder(prev => {
      const next = [...prev]
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })
  }

  const nameFor = (id: string) => available.find(p => p.playerId === id)?.name ?? id

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(order)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Batting Order</h3>
      {available.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14 }}>No available players.</p>
      ) : (
        <>
          <ol style={{ padding: '0 0 0 20px', margin: '0 0 12px' }}>
            {order.map((id, idx) => (
              <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ flexGrow: 1 }}>{nameFor(id)}</span>
                {!isLocked && (
                  <>
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ fontSize: 11, padding: '2px 6px' }}>▲</button>
                    <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1} style={{ fontSize: 11, padding: '2px 6px' }}>▼</button>
                  </>
                )}
              </li>
            ))}
          </ol>
          {!isLocked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Batting Order'}
              </button>
              {error && <span style={{ color: 'red', fontSize: 13 }}>{error}</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
