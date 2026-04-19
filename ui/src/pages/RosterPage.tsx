import { useParams, Link } from 'react-router-dom'
import { useGetTeam } from '../hooks/useTeam'
import { useGetRoster, useAddPlayer, useRateSkill, useDeactivatePlayer, useRenamePlayer } from '../hooks/useRoster'
import { PlayerList } from '../components/roster/PlayerList'
import { AddPlayerForm } from '../components/roster/AddPlayerForm'

export function RosterPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const teamQuery = useGetTeam(teamId!)
  const rosterQuery = useGetRoster(teamId!)
  const addPlayer = useAddPlayer(teamId!)
  const rateSkill = useRateSkill(teamId!)
  const deactivatePlayer = useDeactivatePlayer(teamId!)
  const renamePlayer = useRenamePlayer(teamId!)

  const skills = teamQuery.data?.sport?.skills ?? []
  const players = rosterQuery.data ?? []

  const handleAdd = async (name: string) => {
    await addPlayer.mutateAsync({ teamId: teamId!, data: { name } })
  }

  const handleRate = async (playerId: string, skillName: string, rating: number) => {
    await rateSkill.mutateAsync({ teamId: teamId!, playerId, skillName, data: { rating } })
  }

  const handleRename = async (playerId: string, name: string) => {
    await renamePlayer.mutateAsync({ teamId: teamId!, playerId, data: { name } })
  }

  const handleDeactivate = async (playerId: string) => {
    if (!confirm('Mark this player as inactive? Their historical data will be preserved.')) return
    await deactivatePlayer.mutateAsync({ teamId: teamId!, playerId })
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/teams/${teamId}`} style={{ fontSize: 13, color: '#555' }}>← Dashboard</Link>
      </div>
      <h1 style={{ marginBottom: 4 }}>Roster</h1>
      {teamQuery.data?.name && (
        <p style={{ color: '#666', marginTop: 0, marginBottom: 20 }}>{teamQuery.data.name}</p>
      )}

      {rosterQuery.isLoading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : (
        <>
          <AddPlayerForm onAdd={handleAdd} />
          <PlayerList
            players={players}
            skills={skills}
            onRate={handleRate}
            onRename={handleRename}
            onDeactivate={handleDeactivate}
          />
        </>
      )}
    </div>
  )
}
