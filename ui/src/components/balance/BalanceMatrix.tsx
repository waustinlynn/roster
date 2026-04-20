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

  return (
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
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{row.playerName}</span>
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
  )
}
