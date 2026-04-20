import { useState, useEffect, useRef, useMemo } from 'react'
import type { PlayerResponse, FieldingAssignmentDto } from '../../api/index'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import SaveIcon from '@mui/icons-material/Save'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">No available players.</Typography>
      </Paper>
    )
  }

  return (
    <Paper variant="outlined">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          Batting order &amp; fielding
        </Typography>
        {!isLocked && (
          <Stack direction="row" spacing={1} alignItems="center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImportCsv}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Import CSV
            </Button>
          </Stack>
        )}
      </Stack>

      {importError && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setImportError(null)}>
          {importError}
        </Alert>
      )}

      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ width: 48 }}>#</TableCell>
              <TableCell>Player</TableCell>
              {!isLocked && <TableCell align="center" sx={{ width: 88 }}>Order</TableCell>}
              {innings.map(i => (
                <TableCell key={i} align="center">Inning {i}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {order.map((playerId, idx) => {
              const player = available.find(p => p.playerId === playerId)
              if (!player) return null
              return (
                <TableRow key={playerId} hover>
                  <TableCell align="center" sx={{ color: 'text.secondary' }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {player.name}
                  </TableCell>
                  {!isLocked && (
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Move up">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => move(idx, -1)}
                            disabled={idx === 0}
                          >
                            <ArrowUpwardIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move down">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => move(idx, 1)}
                            disabled={idx === order.length - 1}
                          >
                            <ArrowDownwardIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  )}
                  {innings.map(inning => {
                    const isDupe = duplicateCells.has(`${String(inning)}-${playerId}`)
                    return (
                      <TableCell
                        key={inning}
                        align="center"
                        sx={{
                          p: 0.5,
                          bgcolor: isDupe ? 'error.light' : undefined,
                        }}
                      >
                        <Select
                          value={fielding[String(inning)]?.[playerId] ?? 'Bench'}
                          disabled={isLocked}
                          onChange={e => setPosition(playerId, inning, e.target.value)}
                          size="small"
                          variant="standard"
                          disableUnderline
                          sx={{
                            minWidth: 110,
                            fontSize: 13,
                            '& .MuiSelect-select': { py: 0.5 },
                          }}
                        >
                          {allPositions.map(pos => (
                            <MenuItem key={pos} value={pos} dense>
                              {pos}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
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
            onClick={handleSaveLineup}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save lineup'}
          </Button>
          {duplicateCells.size > 0 && (
            <Typography variant="caption" color="error">
              Duplicate position assignments detected — highlighted cells.
            </Typography>
          )}
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
