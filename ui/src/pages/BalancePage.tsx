import { useParams, Link } from 'react-router-dom'

export function BalancePage() {
  const { teamId } = useParams<{ teamId: string }>()
  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      <Link to={`/teams/${teamId}`}>← Dashboard</Link>
      <h1>Playing Time Balance</h1>
      <p>Balance matrix will be implemented in US3.</p>
    </div>
  )
}
