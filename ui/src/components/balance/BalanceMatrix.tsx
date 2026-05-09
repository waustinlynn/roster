import { useState } from 'react'
import type { BalanceMatrixDto } from '../../api/index'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'

const INFIELD_POSITIONS = new Set(['Pitcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base'])

interface Props {
  data: BalanceMatrixDto
}

export function BalanceMatrix({ data }: Props) {
  const [filterPos, setFilterPos] = useState<string>('all')

  const positions = data.positions ?? []
  const rows = data.rows ?? []

  const displayPositions = filterPos === 'all' ? positions : positions.filter(p => p === filterPos)

  const sortedRows = filterPos === 'all'
    ? rows
    : [...rows].sort((a, b) => ((a.counts?.[filterPos] ?? 0) - (b.counts?.[filterPos] ?? 0)))

  const playersBattingOrder = rows
    .map(row => ({
      ...row,
      batAvg: row.averageBattingPosition,
    }))
    .filter(p => p.batAvg !== null && p.batAvg !== undefined)
    .sort((a, b) => (a.batAvg ?? 0) - (b.batAvg ?? 0))

  return (
    <Stack spacing={3}>
      <Paper variant="outlined">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'center' }}
          sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <TextField
            label="Filter position"
            select
            size="small"
            value={filterPos}
            onChange={e => setFilterPos(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All positions</MenuItem>
            {positions.map(p => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Yellow cells = zero innings at that position.
          </Typography>
        </Stack>

        <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  minWidth: 140,
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: 'background.paper',
                }}
              >
                Player
              </TableCell>
              {displayPositions.map(pos => (
                <TableCell key={pos} align="center">{pos}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.map(row => (
              <TableRow key={row.playerId} sx={{ opacity: row.isActive ? 1 : 0.55 }} hover>
                <TableCell
                  sx={{
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <span>{row.playerName}</span>
                    {(() => {
                      const counts = row.counts ?? {}
                      const infield = Object.entries(counts)
                        .filter(([pos]) => INFIELD_POSITIONS.has(pos))
                        .reduce((sum, [, n]) => sum + n, 0)
                      const outfield = Object.entries(counts)
                        .filter(([pos]) => !INFIELD_POSITIONS.has(pos) && pos !== 'Bench')
                        .reduce((sum, [, n]) => sum + n, 0)
                      return (
                        <>
                          {infield > 0 && (
                            <Chip
                              label={infield}
                              size="small"
                              sx={{ height: 18, fontSize: 11, bgcolor: 'rgba(76,175,80,0.15)', color: 'success.dark', '& .MuiChip-label': { px: 0.75 } }}
                            />
                          )}
                          {outfield > 0 && (
                            <Chip
                              label={outfield}
                              size="small"
                              sx={{ height: 18, fontSize: 11, bgcolor: 'rgba(211,47,47,0.12)', color: 'error.dark', '& .MuiChip-label': { px: 0.75 } }}
                            />
                          )}
                        </>
                      )
                    })()}
                    {!row.isActive && <Chip label="Inactive" size="small" />}
                  </Stack>
                </TableCell>
                {displayPositions.map(pos => {
                  const count = row.counts?.[pos] ?? 0
                  const isZero = count === 0
                  return (
                    <TableCell
                      key={pos}
                      align="center"
                      sx={{
                        bgcolor: isZero ? 'warning.light' : undefined,
                        color: isZero ? 'warning.contrastText' : undefined,
                        fontWeight: isZero ? 700 : 400,
                      }}
                    >
                      {count}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
            {sortedRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={displayPositions.length + 1}
                  align="center"
                  sx={{ py: 4, color: 'text.secondary' }}
                >
                  No data yet. Record some games to see balance.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>

      {playersBattingOrder.length > 0 && (
        <Paper variant="outlined">
          <Stack sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Average Batting Order Position</Typography>
            <Typography variant="caption" color="text.secondary">
              Across all games with a batting order set.
            </Typography>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 140 }}>Player</TableCell>
                  <TableCell align="right">Average Position</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {playersBattingOrder.map(p => (
                  <TableRow key={p.playerId} sx={{ opacity: p.isActive ? 1 : 0.55 }} hover>
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <span>{p.playerName}</span>
                        {!p.isActive && <Chip label="Inactive" size="small" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {p.batAvg ? p.batAvg.toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  )
}
