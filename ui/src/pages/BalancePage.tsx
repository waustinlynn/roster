import { useParams } from 'react-router-dom'
import { useGetBalanceMatrix } from '../hooks/useBalance'
import { BalanceMatrix } from '../components/balance/BalanceMatrix'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

export function BalancePage() {
  const { teamId } = useParams<{ teamId: string }>()
  const balanceQuery = useGetBalanceMatrix(teamId!)

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Playing time balance</Typography>
        <Typography variant="body2" color="text.secondary">
          Inning counts per player per position across all recorded games.
        </Typography>
      </Box>

      {balanceQuery.isLoading ? (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : balanceQuery.isError ? (
        <Alert severity="error">Failed to load balance data.</Alert>
      ) : balanceQuery.data ? (
        <BalanceMatrix data={balanceQuery.data} />
      ) : null}
    </Stack>
  )
}
