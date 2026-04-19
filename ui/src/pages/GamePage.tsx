import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGetTeam } from '../hooks/useTeam'
import { useGetRoster } from '../hooks/useRoster'
import {
  useGetGameDetail,
  useMarkAbsent,
  useRevokeAbsence,
  useUpdateGameLineup,
  useRecordGameScores,
  useLockGame,
} from '../hooks/useGame'
import { GameHeader } from '../components/game/GameHeader'
import { BattingOrderGrid } from '../components/game/BattingOrderGrid'
import type { FieldingAssignmentDto, InningScoreDto } from '../api/index'

export function GamePage() {
  const { teamId, gameId } = useParams<{ teamId: string; gameId: string }>()

  const teamQuery = useGetTeam(teamId!)
  const rosterQuery = useGetRoster(teamId!)
  const gameQuery = useGetGameDetail(teamId!, gameId!)

  const markAbsent = useMarkAbsent(teamId!, gameId!)
  const revokeAbsence = useRevokeAbsence(teamId!, gameId!)
  const updateLineup = useUpdateGameLineup(teamId!, gameId!)
  const recordGameScores = useRecordGameScores(teamId!, gameId!)
  const lockGame = useLockGame(teamId!, gameId!)

  if (gameQuery.isLoading || rosterQuery.isLoading) {
    return <div style={{ margin: '40px auto', padding: 24 }}>Loading…</div>
  }

  if (!gameQuery.data) {
    return <div style={{ margin: '40px auto', padding: 24, color: 'red' }}>Game not found.</div>
  }

  const game = gameQuery.data
  const allPlayers = rosterQuery.data ?? []
  const activePlayers = allPlayers.filter(p => p.isActive)
  const absentIds = game.absentPlayerIds ?? []
  const positions = teamQuery.data?.sport?.positions ?? []
  const isLocked = game.isLocked ?? false

  const handleToggleAbsent = async (playerId: string) => {
    if (isLocked) return
    if (absentIds.includes(playerId)) {
      await revokeAbsence.mutateAsync({ teamId: teamId!, gameId: gameId!, playerId })
    } else {
      await markAbsent.mutateAsync({ teamId: teamId!, gameId: gameId!, data: { playerId } })
    }
  }

  const handleSaveLineup = async (order: string[], inningAssignments: Record<string, FieldingAssignmentDto[]>) => {
    await updateLineup.mutateAsync({
      teamId: teamId!,
      gameId: gameId!,
      data: { battingOrder: order, inningAssignments },
    })
  }

  const handleLock = () => {
    if (!confirm('Lock this game? No further edits will be allowed.')) return
    lockGame.mutate({ teamId: teamId!, gameId: gameId! })
  }

  return (
    <div style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/teams/${teamId}`} style={{ fontSize: 13, color: '#555' }}>← Dashboard</Link>
      </div>

      <GameHeader game={game} onLock={handleLock} locking={lockGame.isPending} />

      {isLocked && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', padding: '10px 14px', borderRadius: 6, marginBottom: 20, fontSize: 14 }}>
          This game is locked and cannot be edited.
        </div>
      )}

      {/* Absence section */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 8 }}>Player Availability</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {activePlayers.map(p => {
            const isAbsent = absentIds.includes(p.playerId!)
            return (
              <button
                key={p.playerId}
                onClick={() => handleToggleAbsent(p.playerId!)}
                disabled={isLocked}
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  border: '1px solid',
                  cursor: isLocked ? 'default' : 'pointer',
                  background: isAbsent ? '#fee' : '#efe',
                  borderColor: isAbsent ? '#c00' : '#090',
                  color: isAbsent ? '#c00' : '#060',
                  fontSize: 13,
                  fontWeight: isAbsent ? 600 : 400,
                }}
              >
                {p.name} {isAbsent ? '(absent)' : '✓'}
              </button>
            )
          })}
          {activePlayers.length === 0 && (
            <p style={{ color: '#888', fontSize: 14 }}>No active players. Add players on the Roster page.</p>
          )}
        </div>
        {!isLocked && <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Click a player to toggle their availability for this game.</p>}
      </section>

      <ScoreGrid
        inningCount={game.inningCount ?? 6}
        opponentName={game.opponent ?? 'Opponent'}
        savedScores={(game.inningScores as Record<string, InningScoreDto> | undefined) ?? {}}
        onSaveScores={(scores) =>
          recordGameScores.mutateAsync({
            teamId: teamId!,
            gameId: gameId!,
            data: { inningScores: scores },
          })
        }
        isSaving={recordGameScores.isPending}
      />

      <BattingOrderGrid
        inningCount={game.inningCount ?? 6}
        players={activePlayers}
        absentPlayerIds={absentIds}
        positions={positions}
        initialOrder={game.battingOrder ?? []}
        savedAssignments={game.inningAssignments ?? {}}
        isLocked={isLocked}
        onSaveLineup={handleSaveLineup}
      />
    </div>
  )
}

type InningScores = Record<number, { home: number; away: number }>

function buildInitialScores(inningCount: number, saved: Record<string, InningScoreDto>): InningScores {
  const scores: InningScores = {}
  for (let i = 1; i <= inningCount; i++) {
    const s = saved[String(i)]
    scores[i] = { home: s?.homeScore ?? 0, away: s?.awayScore ?? 0 }
  }
  return scores
}

function ScoreGrid({
  inningCount,
  opponentName,
  savedScores,
  onSaveScores,
  isSaving,
}: {
  inningCount: number
  opponentName: string
  savedScores: Record<string, InningScoreDto>
  onSaveScores: (scores: Record<string, { homeScore: number; awayScore: number }>) => Promise<void>
  isSaving: boolean
}) {
  const innings = Array.from({ length: inningCount }, (_, i) => i + 1)
  const [scores, setScores] = useState<InningScores>(() => buildInitialScores(inningCount, savedScores))
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setScores(buildInitialScores(inningCount, savedScores))
  }, [JSON.stringify(savedScores), inningCount])

  const setScore = (inning: number, side: 'home' | 'away', raw: string) => {
    const num = Math.max(0, parseInt(raw, 10) || 0)
    setScores(prev => ({ ...prev, [inning]: { ...prev[inning], [side]: num } }))
  }

  const handleSave = async () => {
    setSaveError(null)
    try {
      const payload: Record<string, { homeScore: number; awayScore: number }> = {}
      for (const i of innings) {
        payload[String(i)] = { homeScore: scores[i].home, awayScore: scores[i].away }
      }
      await onSaveScores(payload)
    } catch {
      setSaveError('Failed to save scores')
    }
  }

  const homeTotal = innings.reduce((sum, i) => sum + scores[i].home, 0)
  const awayTotal = innings.reduce((sum, i) => sum + scores[i].away, 0)

  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ marginBottom: 8 }}>Score by Inning</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={scoreTh}></th>
              {innings.map(i => <th key={i} style={scoreTh}>{i}</th>)}
              <th style={{ ...scoreTh, borderLeft: '2px solid #ccc' }}>R</th>
            </tr>
          </thead>
          <tbody>
            {(['home', 'away'] as const).map(side => (
              <tr key={side}>
                <td style={{ ...scoreTd, fontWeight: 600, paddingRight: 16, whiteSpace: 'nowrap' }}>
                  {side === 'home' ? 'Us' : opponentName}
                </td>
                {innings.map(i => (
                  <td key={i} style={scoreTd}>
                    <input
                      type="number"
                      min={0}
                      value={scores[i][side]}
                      onChange={e => setScore(i, side, e.target.value)}
                      style={{ width: 44, textAlign: 'center', fontSize: 14, padding: '3px 4px' }}
                    />
                  </td>
                ))}
                <td style={{ ...scoreTd, borderLeft: '2px solid #ccc', fontWeight: 700, textAlign: 'center', minWidth: 36 }}>
                  {side === 'home' ? homeTotal : awayTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
        <button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Scores'}
        </button>
        {saveError && <span style={{ color: 'red', fontSize: 13 }}>{saveError}</span>}
      </div>
    </section>
  )
}

const scoreTh: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '2px solid #ddd',
  textAlign: 'center',
  fontWeight: 600,
  fontSize: 13,
  minWidth: 48,
}

const scoreTd: React.CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #eee',
  textAlign: 'center',
}
