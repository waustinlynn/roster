import { useParams, Link } from 'react-router-dom'

export function RosterPage() {
  const { teamId } = useParams<{ teamId: string }>()
  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <Link to={`/teams/${teamId}`}>← Dashboard</Link>
      <h1>Roster</h1>
      <p>Player roster will be implemented in US1.</p>
    </div>
  )
}
