import { useParams } from 'react-router-dom'
import { useGetTeam } from '../hooks/useTeam'
import { useGetRoster, useAddPlayer, useRateSkill, useDeactivatePlayer, useRenamePlayer } from '../hooks/useRoster'
import { PlayerList } from '../components/roster/PlayerList'
import { AddPlayerForm } from '../components/roster/AddPlayerForm'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

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
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Roster</Typography>
        <Typography variant="body2" color="text.secondary">
          Manage players and their skill ratings.
        </Typography>
      </Box>

      <AddPlayerForm onAdd={handleAdd} />

      {rosterQuery.isLoading ? (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <PlayerList
          players={players}
          skills={skills}
          onRate={handleRate}
          onRename={handleRename}
          onDeactivate={handleDeactivate}
        />
      )}
    </Stack>
  )
}
