import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLocalTeam } from '../hooks/useLocalTeam'

export function TeamDashboard() {
  const { teamId } = useParams<{ teamId: string }>()
  const { clear } = useLocalTeam()
  const navigate = useNavigate()

  const handleSignOut = () => {
    clear()
    navigate('/')
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h1>Team Dashboard</h1>
      <nav>
        <ul>
          <li><Link to={`/teams/${teamId}/roster`}>Roster</Link></li>
          <li><Link to={`/teams/${teamId}/balance`}>Playing Time Balance</Link></li>
        </ul>
      </nav>
      <button onClick={handleSignOut}>Sign out (clear secret)</button>
    </div>
  )
}
