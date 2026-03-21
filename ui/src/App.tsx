import { Routes, Route, Navigate } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { TeamDashboard } from './pages/TeamDashboard'
import { RosterPage } from './pages/RosterPage'
import { GamePage } from './pages/GamePage'
import { BalancePage } from './pages/BalancePage'
import { useLocalTeam } from './hooks/useLocalTeam'

function App() {
  const { teamId, secret } = useLocalTeam()

  return (
    <Routes>
      <Route path="/" element={
        teamId && secret ? <Navigate to={`/teams/${teamId}`} replace /> : <Landing />
      } />
      <Route path="/teams/:teamId" element={<TeamDashboard />} />
      <Route path="/teams/:teamId/roster" element={<RosterPage />} />
      <Route path="/teams/:teamId/games/:gameId" element={<GamePage />} />
      <Route path="/teams/:teamId/balance" element={<BalancePage />} />
    </Routes>
  )
}

export default App
