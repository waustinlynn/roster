import { useParams, Link } from 'react-router-dom'
import { useGetBalanceMatrix } from '../hooks/useBalance'
import { BalanceMatrix } from '../components/balance/BalanceMatrix'

export function BalancePage() {
  const { teamId } = useParams<{ teamId: string }>()
  const balanceQuery = useGetBalanceMatrix(teamId!)

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/teams/${teamId}`} style={{ fontSize: 13, color: '#555' }}>← Dashboard</Link>
      </div>
      <h1 style={{ marginBottom: 4 }}>Playing Time Balance</h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
        Inning counts per player per position across all recorded games.
      </p>

      {balanceQuery.isLoading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : balanceQuery.isError ? (
        <p style={{ color: 'red' }}>Failed to load balance data.</p>
      ) : balanceQuery.data ? (
        <BalanceMatrix data={balanceQuery.data} />
      ) : null}
    </div>
  )
}
