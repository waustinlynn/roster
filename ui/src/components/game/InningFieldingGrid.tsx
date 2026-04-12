import { useState, useEffect } from 'react'
import type { PlayerResponse, FieldingAssignment } from '../../api/index'

interface Props {
  inningCount: number
  players: PlayerResponse[]          // active, non-absent
  absentPlayerIds: string[]
  positions: string[]                // sport positions (no Bench — we add it)
  savedAssignments: Record<string, FieldingAssignment[]>  // "1" → assignments
  isLocked: boolean
  onSaveInning: (inningNumber: number, assignments: FieldingAssignment[]) => Promise<void>
}

const ALL_POSITIONS = (positions: string[]) => [...positions, 'Bench']

export function InningFieldingGrid({
  inningCount,
  players,
  absentPlayerIds,
  positions,
  savedAssignments,
  isLocked,
  onSaveInning,
}: Props) {
  const [activeInning, setActiveInning] = useState(1)

  const innings = Array.from({ length: inningCount }, (_, i) => i + 1)
  const allPositions = ALL_POSITIONS(positions)
  const available = players.filter(p => p.isActive && !absentPlayerIds.includes(p.playerId!))

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Fielding Assignments</h3>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {innings.map(i => (
          <button
            key={i}
            onClick={() => setActiveInning(i)}
            style={{
              padding: '4px 12px',
              background: activeInning === i ? '#333' : '#eee',
              color: activeInning === i ? '#fff' : '#333',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            Inning {i}
          </button>
        ))}
      </div>
      <InningPanel
        key={activeInning}
        inningNumber={activeInning}
        players={available}
        allPositions={allPositions}
        saved={savedAssignments[String(activeInning)] ?? []}
        prevSaved={activeInning > 1 ? (savedAssignments[String(activeInning - 1)] ?? []) : []}
        isLocked={isLocked}
        onSave={onSaveInning}
      />
    </div>
  )
}

interface PanelProps {
  inningNumber: number
  players: PlayerResponse[]
  allPositions: string[]
  saved: FieldingAssignment[]
  prevSaved: FieldingAssignment[]
  isLocked: boolean
  onSave: (inningNumber: number, assignments: FieldingAssignment[]) => Promise<void>
}

function InningPanel({ inningNumber, players, allPositions, saved, prevSaved, isLocked, onSave }: PanelProps) {
  const buildInitial = (source: FieldingAssignment[]) => {
    const map: Record<string, string> = {}
    for (const p of players) {
      const saved = source.find(a => a.playerId === p.playerId)
      map[p.playerId!] = saved?.position ?? 'Bench'
    }
    return map
  }

  const [assignments, setAssignments] = useState<Record<string, string>>(() => buildInitial(saved))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect duplicate non-Bench assignments
  const duplicates = (() => {
    const counts: Record<string, number> = {}
    for (const pos of Object.values(assignments)) {
      if (pos !== 'Bench') counts[pos] = (counts[pos] ?? 0) + 1
    }
    return Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 1))
  })()

  const hasDuplicates = Object.keys(duplicates).length > 0

  const copyFromPrev = () => {
    if (prevSaved.length > 0) setAssignments(buildInitial(prevSaved))
  }

  const handleSave = async () => {
    if (hasDuplicates) return
    setSaving(true)
    setError(null)
    try {
      const list: FieldingAssignment[] = players.map(p => ({
        playerId: p.playerId!,
        position: assignments[p.playerId!] ?? 'Bench',
      }))
      await onSave(inningNumber, list)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (players.length === 0) {
    return <p style={{ color: '#888', fontSize: 14 }}>No available players for this inning.</p>
  }

  return (
    <div>
      {!isLocked && inningNumber > 1 && (
        <button onClick={copyFromPrev} style={{ marginBottom: 12, fontSize: 13 }}>
          Copy from inning {inningNumber - 1}
        </button>
      )}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>Player</th>
            <th style={thStyle}>Position</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => {
            const pos = assignments[p.playerId!] ?? 'Bench'
            const isDup = pos !== 'Bench' && duplicates[pos] > 1
            return (
              <tr key={p.playerId}>
                <td style={tdStyle}>{p.name}</td>
                <td style={{ ...tdStyle, background: isDup ? '#fff0f0' : undefined }}>
                  <select
                    value={pos}
                    disabled={isLocked}
                    onChange={e => setAssignments(prev => ({ ...prev, [p.playerId!]: e.target.value }))}
                    style={{ width: '100%', border: isDup ? '1px solid red' : undefined }}
                  >
                    {allPositions.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {hasDuplicates && (
        <p style={{ color: 'red', fontSize: 13, margin: '0 0 8px' }}>
          Duplicate positions: {Object.keys(duplicates).join(', ')}. Fix before saving.
        </p>
      )}
      {!isLocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleSave} disabled={saving || hasDuplicates}>
            {saving ? 'Saving…' : `Save Inning ${inningNumber}`}
          </button>
          {error && <span style={{ color: 'red', fontSize: 13 }}>{error}</span>}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '2px solid #ddd',
  fontSize: 13,
  fontWeight: 600,
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #eee',
  fontSize: 14,
}
