import { useParams, Link } from 'react-router-dom'
import { useGetTeam } from '../hooks/useTeam'
import { useGetRoster } from '../hooks/useRoster'
import {
  useGetGameDetail,
  useMarkAbsent,
  useRevokeAbsence,
  useSetBattingOrder,
  useAssignInningFielding,
  useLockGame,
} from '../hooks/useGame'
import { GameHeader } from '../components/game/GameHeader'
import { BattingOrderList } from '../components/game/BattingOrderList'
import { InningFieldingGrid } from '../components/game/InningFieldingGrid'
import type { FieldingAssignmentDto } from '../api/index'

export function GamePage() {
  const { teamId, gameId } = useParams<{ teamId: string; gameId: string }>()

  const teamQuery = useGetTeam(teamId!)
  const rosterQuery = useGetRoster(teamId!)
  const gameQuery = useGetGameDetail(teamId!, gameId!)

  const markAbsent = useMarkAbsent(teamId!, gameId!)
  const revokeAbsence = useRevokeAbsence(teamId!, gameId!)
  const setBattingOrder = useSetBattingOrder(teamId!, gameId!)
  const assignFielding = useAssignInningFielding(teamId!, gameId!)
  const lockGame = useLockGame(teamId!, gameId!)

  if (gameQuery.isLoading || rosterQuery.isLoading) {
    return <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>Loading…</div>
  }

  if (!gameQuery.data) {
    return <div style={{ maxWidth: 900, margin: '40px auto', padding: 24, color: 'red' }}>Game not found.</div>
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

  const handleSetBattingOrder = async (orderedPlayerIds: string[]) => {
    await setBattingOrder.mutateAsync({ teamId: teamId!, gameId: gameId!, data: { orderedPlayerIds } })
  }

  const handleAssignInning = async (inningNumber: number, assignments: FieldingAssignmentDto[]) => {
    await assignFielding.mutateAsync({ teamId: teamId!, gameId: gameId!, inningNumber, data: { assignments } })
  }

  const handleLock = () => {
    if (!confirm('Lock this game? No further edits will be allowed.')) return
    lockGame.mutate({ teamId: teamId!, gameId: gameId! })
  }

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <section>
          <BattingOrderList
            players={activePlayers}
            absentPlayerIds={absentIds}
            initialOrder={game.battingOrder ?? []}
            isLocked={isLocked}
            onSave={handleSetBattingOrder}
          />
        </section>

        <section>
          <InningFieldingGrid
            inningCount={game.inningCount ?? 6}
            players={activePlayers}
            absentPlayerIds={absentIds}
            positions={positions}
            savedAssignments={game.inningAssignments ?? {}}
            isLocked={isLocked}
            onSaveInning={handleAssignInning}
          />
        </section>
      </div>
    </div>
  )
}
