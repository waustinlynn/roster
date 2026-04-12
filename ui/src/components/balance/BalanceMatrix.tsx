import { useState } from 'react'
import type { BalanceMatrixResponse } from '../../api/index'

interface Props {
  data: BalanceMatrixResponse
}

export function BalanceMatrix({ data }: Props) {
  const [filterPos, setFilterPos] = useState<string>('all')

  const positions = data.positions ?? []
  const rows = data.rows ?? []

  const displayPositions = filterPos === 'all' ? positions : positions.filter(p => p === filterPos)

  // When filtering by position, sort rows by that position count ascending (fewest first)
  const sortedRows = filterPos === 'all'
    ? rows
    : [...rows].sort((a, b) => ((a.counts?.[filterPos] ?? 0) - (b.counts?.[filterPos] ?? 0)))

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 14 }}>
          Filter position:{' '}
          <select value={filterPos} onChange={e => setFilterPos(e.target.value)}>
            <option value="all">All positions</option>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, minWidth: 120, position: 'sticky', left: 0, background: '#fff' }}>
                Player
              </th>
              {displayPositions.map(pos => (
                <th key={pos} style={thStyle}>{pos}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => (
              <tr key={row.playerId} style={{ opacity: row.isActive ? 1 : 0.55 }}>
                <td style={{
                  ...tdStyle,
                  fontWeight: 500,
                  position: 'sticky',
                  left: 0,
                  background: '#fff',
                  whiteSpace: 'nowrap',
                }}>
                  {row.playerName}
                  {!row.isActive && <span style={{ marginLeft: 6, fontSize: 11, color: '#888' }}>(inactive)</span>}
                </td>
                {displayPositions.map(pos => {
                  const count = row.counts?.[pos] ?? 0
                  const isZero = count === 0
                  return (
                    <td key={pos} style={{
                      ...tdStyle,
                      textAlign: 'center',
                      background: isZero ? '#fff8dc' : undefined,
                      fontWeight: isZero ? 600 : undefined,
                      color: isZero ? '#b8860b' : undefined,
                    }}>
                      {count}
                    </td>
                  )
                })}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={displayPositions.length + 1} style={{ padding: 16, color: '#888', textAlign: 'center' }}>
                  No data yet. Record some games to see balance.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
        Highlighted cells (yellow) indicate zero innings at that position.
      </p>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '2px solid #ddd',
  textAlign: 'center',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #eee',
}
