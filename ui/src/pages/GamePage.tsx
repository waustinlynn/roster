import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
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
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'

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
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!gameQuery.data) {
    return <Alert severity="error">Game not found.</Alert>
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
    <Stack spacing={3}>
      <GameHeader game={game} onLock={handleLock} locking={lockGame.isPending} />

      {isLocked && (
        <Alert severity="warning">
          This game is locked and cannot be edited.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Player availability</Typography>
        {activePlayers.length === 0 ? (
          <Typography color="text.secondary">
            No active players. Add players on the Roster page.
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {activePlayers.map(p => {
                const isAbsent = absentIds.includes(p.playerId!)
                return (
                  <Chip
                    key={p.playerId}
                    label={p.name}
                    icon={isAbsent ? <CancelIcon /> : <CheckCircleIcon />}
                    color={isAbsent ? 'error' : 'success'}
                    variant={isAbsent ? 'outlined' : 'filled'}
                    onClick={isLocked ? undefined : () => handleToggleAbsent(p.playerId!)}
                    disabled={isLocked}
                    sx={{
                      fontWeight: isAbsent ? 600 : 400,
                    }}
                  />
                )
              })}
            </Box>
            {!isLocked && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Click a player to toggle availability for this game.
              </Typography>
            )}
          </>
        )}
      </Paper>

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
        isLocked={isLocked}
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
    </Stack>
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
  isLocked,
}: {
  inningCount: number
  opponentName: string
  savedScores: Record<string, InningScoreDto>
  onSaveScores: (scores: Record<string, { homeScore: number; awayScore: number }>) => Promise<void>
  isSaving: boolean
  isLocked: boolean
}) {
  const innings = Array.from({ length: inningCount }, (_, i) => i + 1)
  const [scores, setScores] = useState<InningScores>(() => buildInitialScores(inningCount, savedScores))
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setScores(buildInitialScores(inningCount, savedScores))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <Paper variant="outlined">
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Score by inning</Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              {innings.map(i => (
                <TableCell key={i} align="center">{i}</TableCell>
              ))}
              <TableCell align="center" sx={{ borderLeft: 2, borderColor: 'divider', fontWeight: 700 }}>
                R
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(['home', 'away'] as const).map(side => (
              <TableRow key={side}>
                <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', pr: 2 }}>
                  {side === 'home' ? 'Us' : opponentName}
                </TableCell>
                {innings.map(i => (
                  <TableCell key={i} align="center" sx={{ p: 0.5 }}>
                    <TextField
                      type="number"
                      value={scores[i][side]}
                      onChange={e => setScore(i, side, e.target.value)}
                      size="small"
                      disabled={isLocked}
                      inputProps={{
                        min: 0,
                        style: { textAlign: 'center', padding: '4px 4px', width: 34 },
                      }}
                      sx={{ width: 54 }}
                    />
                  </TableCell>
                ))}
                <TableCell
                  align="center"
                  sx={{
                    borderLeft: 2,
                    borderColor: 'divider',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {side === 'home' ? homeTotal : awayTotal}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!isLocked && (
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
        >
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save scores'}
          </Button>
          {saveError && (
            <Alert severity="error" sx={{ flex: 1 }} onClose={() => setSaveError(null)}>
              {saveError}
            </Alert>
          )}
        </Stack>
      )}
    </Paper>
  )
}
