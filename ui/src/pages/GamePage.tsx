import { useParams, Link } from 'react-router-dom'

export function GamePage() {
  const { teamId } = useParams<{ teamId: string }>()
  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      <Link to={`/teams/${teamId}`}>← Dashboard</Link>
      <h1>Game</h1>
      <p>Game lineup will be implemented in US2.</p>
    </div>
  )
}
