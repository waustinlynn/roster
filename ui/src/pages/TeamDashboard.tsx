import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGetGamesList, useCreateGame } from '../hooks/useGame'
import type { CreateGameRequest } from '../api/index'
import { getTeamsTeamIdGamesGameId, putTeamsTeamIdGamesGameIdLineup } from '../api/index'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import LockIcon from '@mui/icons-material/Lock'

export function TeamDashboard() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()

  const gamesQuery = useGetGamesList(teamId!)
  const createGame = useCreateGame(teamId!)

  const [showCreate, setShowCreate] = useState(false)
  const [gameForm, setGameForm] = useState<CreateGameRequest>({ date: '', inningCount: 6 })
  const [copyFromGameId, setCopyFromGameId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const games = gamesQuery.data ?? []
  const sortedGames = [...games].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const openCreate = () => {
    setGameForm({ date: new Date().toISOString().slice(0, 10), inningCount: 6 })
    setCopyFromGameId('')
    setCreateError(null)
    setShowCreate(true)
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
      navigate(`/teams/${teamId}/games/${game.gameId}`)
    } catch {
      setCreateError('Failed to create game')
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">Games</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          New game
        </Button>
      </Stack>

      <Paper variant="outlined">
        {gamesQuery.isLoading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : sortedGames.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary" gutterBottom>
              No games yet.
            </Typography>
            <Button variant="text" startIcon={<AddIcon />} onClick={openCreate}>
              Create your first game
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel active direction="desc">Date</TableSortLabel>
                  </TableCell>
                  <TableCell>Opponent</TableCell>
                  <TableCell align="center">Innings</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedGames.map(g => (
                  <TableRow
                    key={g.gameId}
                    hover
                    onClick={() => navigate(`/teams/${teamId}/games/${g.gameId}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{g.date}</TableCell>
                    <TableCell>{g.opponent ?? '—'}</TableCell>
                    <TableCell align="center">{g.inningCount}</TableCell>
                    <TableCell>
                      {g.isLocked ? (
                        <Chip icon={<LockIcon />} label="Locked" size="small" color="default" />
                      ) : (
                        <Chip label="In progress" size="small" color="primary" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={g.isLocked ? 'View' : 'Edit'}>
                        <IconButton
                          size="small"
                          onClick={e => {
                            e.stopPropagation()
                            navigate(`/teams/${teamId}/games/${g.gameId}`)
                          }}
                        >
                          {g.isLocked ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={handleCreateGame}>
          <DialogTitle>New game</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Date"
                type="date"
                value={gameForm.date ?? ''}
                onChange={e => setGameForm(f => ({ ...f, date: e.target.value }))}
                required
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Opponent"
                value={gameForm.opponent ?? ''}
                onChange={e => setGameForm(f => ({ ...f, opponent: e.target.value || undefined }))}
                inputProps={{ maxLength: 100 }}
                placeholder="e.g. Tigers"
                fullWidth
              />
              <TextField
                label="Innings"
                type="number"
                value={gameForm.inningCount ?? 6}
                onChange={e => setGameForm(f => ({ ...f, inningCount: Number(e.target.value) }))}
                inputProps={{ min: 1, max: 12 }}
                required
                fullWidth
              />
              {games.length > 0 && (
                <TextField
                  label="Copy lineup from"
                  select
                  value={copyFromGameId}
                  onChange={e => setCopyFromGameId(e.target.value)}
                  helperText="Optional — start with the batting order and fielding from a previous game"
                  fullWidth
                >
                  <MenuItem value="">None</MenuItem>
                  {sortedGames.map(g => (
                    <MenuItem key={g.gameId} value={g.gameId}>
                      {g.date}{g.opponent ? ` vs ${g.opponent}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {createError && <Alert severity="error">{createError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createGame.isPending}
            >
              {createGame.isPending ? 'Creating…' : 'Create game'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}
