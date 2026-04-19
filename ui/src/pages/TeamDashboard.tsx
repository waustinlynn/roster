import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLocalTeam } from '../hooks/useLocalTeam'
import { useGetTeam } from '../hooks/useTeam'
import { useGetGamesList, useCreateGame } from '../hooks/useGame'
import type { CreateGameRequest } from '../api/index'
import { getTeamsTeamIdGamesGameId, putTeamsTeamIdGamesGameIdLineup } from '../api/index'

export function TeamDashboard() {
  const { teamId } = useParams<{ teamId: string }>()
  const { clear } = useLocalTeam()
  const navigate = useNavigate()

  const teamQuery = useGetTeam(teamId!)
  const gamesQuery = useGetGamesList(teamId!)
  const createGame = useCreateGame(teamId!)

  const [showCreate, setShowCreate] = useState(false)
  const [gameForm, setGameForm] = useState<CreateGameRequest>({ date: '', inningCount: 6 })
  const [copyFromGameId, setCopyFromGameId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const handleSignOut = () => {
    clear()
    navigate('/')
  }

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    try {
      const game = await createGame.mutateAsync({ teamId: teamId!, data: gameForm })

      if (copyFromGameId && game.gameId) {
        const source = await getTeamsTeamIdGamesGameId(teamId!, copyFromGameId)
        const targetInnings = gameForm.inningCount ?? 6
        const inningAssignments: Record<string, { playerId?: string; position?: string | null }[]> = {}
        if (source.inningAssignments) {
          for (let i = 1; i <= targetInnings; i++) {
            const key = String(i)
            if (source.inningAssignments[key]) {
              inningAssignments[key] = source.inningAssignments[key].map(s => ({
                playerId: s.playerId,
                position: s.position,
              }))
            }
          }
        }
        await putTeamsTeamIdGamesGameIdLineup(teamId!, game.gameId, {
          battingOrder: source.battingOrder ?? null,
          inningAssignments: Object.keys(inningAssignments).length > 0 ? inningAssignments : null,
        })
      }

      setShowCreate(false)
      setGameForm({ date: '', inningCount: 6 })
      setCopyFromGameId('')
      navigate(`/teams/${teamId}/games/${game.gameId}`)
    } catch {
      setCreateError('Failed to create game')
    }
  }

  const games = gamesQuery.data ?? []

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>
            {teamQuery.data?.name ?? 'Team Dashboard'}
          </h1>
          {teamQuery.data?.sportName && (
            <div style={{ color: '#666', marginTop: 4 }}>{teamQuery.data.sportName}</div>
          )}
        </div>
        <button onClick={handleSignOut} style={{ fontSize: 13, padding: '6px 12px' }}>
          Switch team
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        <Link to={`/teams/${teamId}/roster`} style={navLinkStyle}>
          👥 Roster
        </Link>
        <Link to={`/teams/${teamId}/balance`} style={navLinkStyle}>
          📊 Playing Time Balance
        </Link>
      </div>

      {/* Games section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Games</h2>
        <button onClick={() => setShowCreate(s => !s)} style={{ fontSize: 13, padding: '6px 12px' }}>
          {showCreate ? 'Cancel' : '+ New Game'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateGame} style={{ background: '#f8f8f8', padding: 16, marginBottom: 16, borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 13 }}>
              Date<br />
              <input
                type="date"
                value={gameForm.date ?? ''}
                onChange={e => setGameForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Opponent (optional)<br />
              <input
                value={gameForm.opponent ?? ''}
                onChange={e => setGameForm(f => ({ ...f, opponent: e.target.value || undefined }))}
                maxLength={100}
                placeholder="e.g. Tigers"
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Innings<br />
              <input
                type="number"
                value={gameForm.inningCount}
                onChange={e => setGameForm(f => ({ ...f, inningCount: Number(e.target.value) }))}
                min={1}
                max={12}
                required
                style={{ width: 60 }}
              />
            </label>
            {games.length > 0 && (
              <label style={{ fontSize: 13 }}>
                Copy lineup from (optional)<br />
                <select value={copyFromGameId} onChange={e => setCopyFromGameId(e.target.value)}>
                  <option value="">None</option>
                  {[...games].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(g => (
                    <option key={g.gameId} value={g.gameId}>
                      {g.date}{g.opponent ? ` vs ${g.opponent}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" disabled={createGame.isPending}>
              {createGame.isPending ? 'Creating…' : 'Create Game'}
            </button>
          </div>
          {createError && <p style={{ color: 'red', margin: '8px 0 0', fontSize: 13 }}>{createError}</p>}
        </form>
      )}

      {gamesQuery.isLoading ? (
        <p style={{ color: '#888' }}>Loading games…</p>
      ) : games.length === 0 ? (
        <p style={{ color: '#888' }}>No games yet. Create one above.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Opponent</th>
              <th style={thStyle}>Innings</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {[...games].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(g => (
              <tr key={g.gameId}>
                <td style={tdStyle}>{g.date}</td>
                <td style={tdStyle}>{g.opponent ?? '—'}</td>
                <td style={tdStyle}>{g.inningCount}</td>
                <td style={tdStyle}>{g.isLocked ? '🔒 Locked' : 'In progress'}</td>
                <td style={tdStyle}>
                  <Link to={`/teams/${teamId}/games/${g.gameId}`} style={{ fontSize: 13 }}>
                    {g.isLocked ? 'View' : 'Edit'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const navLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  background: '#f0f0f0',
  borderRadius: 6,
  textDecoration: 'none',
  color: '#333',
  fontWeight: 500,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid #ddd',
  fontWeight: 600,
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #eee',
}
