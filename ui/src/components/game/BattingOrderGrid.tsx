import { useState, useEffect, useRef, useMemo } from 'react'
import type { PlayerResponse, FieldingAssignmentDto } from '../../api/index'

interface Props {
  inningCount: number
  players: PlayerResponse[]
  absentPlayerIds: string[]
  positions: string[]
  initialOrder: string[]
  savedAssignments: Record<string, FieldingAssignmentDto[]>
  isLocked: boolean
  onSaveLineup: (order: string[], inningAssignments: Record<string, FieldingAssignmentDto[]>) => Promise<void>
}

const withBench = (positions: string[]) => [...positions, 'Bench']

const CSV_POSITION_MAP: Record<string, string> = {
  P: 'Pitcher',
  C: 'Catcher',
  '1B': '1st Base',
  '2B': '2nd Base',
  '3B': '3rd Base',
  SS: 'Shortstop',
  LF: 'Left Field',
  LC: 'Left-Centre Field',
  RC: 'Right-Centre Field',
  RF: 'Right Field',
  BENCH: 'Bench',
}

const resolvePosition = (csv: string, allPositions: string[]): string => {
  const trimmed = csv.trim()
  const mapped = CSV_POSITION_MAP[trimmed.toUpperCase()]
  if (mapped && allPositions.includes(mapped)) return mapped
  const exact = allPositions.find(p => p.toLowerCase() === trimmed.toLowerCase())
  if (exact) return exact
  return 'Bench'
}

export function BattingOrderGrid({
  inningCount,
  players,
  absentPlayerIds,
  positions,
  initialOrder,
  savedAssignments,
  isLocked,
  onSaveLineup,
}: Props) {
  const available = players.filter(p => p.isActive && !absentPlayerIds.includes(p.playerId!))
  const allPositions = withBench(positions)
  const innings = Array.from({ length: inningCount }, (_, i) => i + 1)

  const buildOrder = () => {
    const saved = initialOrder.filter(id => available.some(p => p.playerId === id))
    const remaining = available.filter(p => !saved.includes(p.playerId!)).map(p => p.playerId!)
    return [...saved, ...remaining]
  }

  const buildFielding = () => {
    const map: Record<string, Record<string, string>> = {}
    for (const inning of innings) {
      const inningMap: Record<string, string> = {}
      const saved = savedAssignments[String(inning)] ?? []
      for (const p of available) {
        inningMap[p.playerId!] = saved.find(a => a.playerId === p.playerId)?.position ?? 'Bench'
      }
      map[String(inning)] = inningMap
    }
    return map
  }

  const [order, setOrder] = useState<string[]>(buildOrder)
  const [fielding, setFielding] = useState<Record<string, Record<string, string>>>(buildFielding)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setOrder(buildOrder())
    setFielding(buildFielding())
  }, [initialOrder.join(','), available.map(p => p.playerId).join(','), JSON.stringify(savedAssignments)])

  const move = (idx: number, dir: -1 | 1) => {
    setOrder(prev => {
      const next = [...prev]
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })
  }

  const setPosition = (playerId: string, inning: number, position: string) => {
    setFielding(prev => ({
      ...prev,
      [String(inning)]: { ...prev[String(inning)], [playerId]: position },
    }))
  }

  const duplicateCells = useMemo(() => {
    const dupes = new Set<string>()
    for (const inning of innings) {
      const key = String(inning)
      const positionMap: Record<string, string[]> = {}
      for (const playerId of order) {
        const pos = fielding[key]?.[playerId] ?? 'Bench'
        if (pos === 'Bench') continue
        if (!positionMap[pos]) positionMap[pos] = []
        positionMap[pos].push(playerId)
      }
      for (const playerIds of Object.values(positionMap)) {
        if (playerIds.length > 1) {
          for (const pid of playerIds) dupes.add(`${key}-${pid}`)
        }
      }
    }
    return dupes
  }, [fielding, order, innings])

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = (ev.target?.result as string).trim()
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) throw new Error('CSV must have a header row and at least one player row.')

        const headers = lines[0].split(',').map(h => h.trim())
        // headers[0] = "Player", headers[1..] = inning numbers (e.g. "1","2",...)
        const inningHeaders = headers.slice(1)

        const newOrder: string[] = []
        const newFielding: Record<string, Record<string, string>> = {}
        for (const inning of innings) newFielding[String(inning)] = {}

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim())
          const csvName = cols[0]
          const player = available.find(p => p.name?.toLowerCase() === csvName.toLowerCase())
          if (!player) continue

          newOrder.push(player.playerId!)
          for (let j = 0; j < inningHeaders.length; j++) {
            const inningKey = inningHeaders[j]
            if (newFielding[inningKey] !== undefined) {
              newFielding[inningKey][player.playerId!] = resolvePosition(cols[j + 1] ?? 'Bench', allPositions)
            }
          }
        }

        // Append any available players not matched in the CSV
        for (const p of available) {
          if (!newOrder.includes(p.playerId!)) newOrder.push(p.playerId!)
        }

        setOrder(newOrder)
        setFielding(newFielding)
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'Import failed')
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleSaveLineup = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const inningAssignments: Record<string, FieldingAssignmentDto[]> = {}
      for (const inning of innings) {
        inningAssignments[String(inning)] = available.map(p => ({
          playerId: p.playerId!,
          position: fielding[String(inning)]?.[p.playerId!] ?? 'Bench',
        }))
      }
      await onSaveLineup(order, inningAssignments)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (available.length === 0) {
    return <p style={{ color: '#888', fontSize: 14 }}>No available players.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Batting Order &amp; Fielding</h3>
        {!isLocked && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImportCsv}
            />
            <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 13 }}>
              Import CSV
            </button>
            {importError && <span style={{ color: 'red', fontSize: 13 }}>{importError}</span>}
          </>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Player</th>
              {!isLocked && <th style={{ ...thStyle, width: 56 }} />}
              {innings.map(i => (
                <th key={i} style={thStyle}>Inning {i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((playerId, idx) => {
              const player = available.find(p => p.playerId === playerId)
              if (!player) return null
              return (
                <tr key={playerId}>
                  <td style={{ ...tdStyle, color: '#888', textAlign: 'center', width: 32 }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, whiteSpace: 'nowrap' }}>{player.name}</td>
                  {!isLocked && (
                    <td style={{ ...tdStyle, width: 56 }}>
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} style={arrowBtn}>▲</button>
                      {' '}
                      <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1} style={arrowBtn}>▼</button>
                    </td>
                  )}
                  {innings.map(inning => {
                    const isDupe = duplicateCells.has(`${String(inning)}-${playerId}`)
                    return (
                    <td key={inning} style={{ ...tdStyle, boxShadow: isDupe ? 'inset 0 0 0 2px #c00' : undefined }}>
                      <select
                        value={fielding[String(inning)]?.[playerId] ?? 'Bench'}
                        disabled={isLocked}
                        onChange={e => setPosition(playerId, inning, e.target.value)}
                        style={{ fontSize: 13 }}
                      >
                        {allPositions.map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!isLocked && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleSaveLineup} disabled={saving}>
            {saving ? 'Saving…' : 'Save Lineup'}
          </button>
          {saveError && <span style={{ color: 'red', fontSize: 13 }}>{saveError}</span>}
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
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderBottom: '1px solid #eee',
  fontSize: 13,
}

const arrowBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 5px',
}
