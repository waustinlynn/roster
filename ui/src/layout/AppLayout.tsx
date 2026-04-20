import { Outlet, useLocation, useNavigate, useParams, Link as RouterLink } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import LogoutIcon from '@mui/icons-material/Logout'
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball'
import { useGetTeam } from '../hooks/useTeam'
import { useLocalTeam } from '../hooks/useLocalTeam'

export function AppLayout() {
  const { teamId } = useParams<{ teamId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { clear } = useLocalTeam()
  const teamQuery = useGetTeam(teamId ?? '')

  const base = `/teams/${teamId}`
  const path = location.pathname

  const activeTab =
    path === base ? base
    : path.startsWith(`${base}/roster`) ? `${base}/roster`
    : path.startsWith(`${base}/balance`) ? `${base}/balance`
    : false

  const handleSignOut = () => {
    clear()
    navigate('/')
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" sx={{ bgcolor: 'background.paper' }}>
        <Toolbar sx={{ gap: 2 }}>
          <SportsBaseballIcon color="primary" />
          <Box sx={{ display: 'flex', flexDirection: 'column', mr: 'auto' }}>
            <Typography variant="h6" component="div" sx={{ lineHeight: 1.2 }}>
              {teamQuery.data?.name ?? 'Roster'}
            </Typography>
            {teamQuery.data?.sportName && (
              <Typography variant="caption" color="text.secondary">
                {teamQuery.data.sportName}
              </Typography>
            )}
          </Box>
          <Tooltip title="Switch team">
            <IconButton color="inherit" onClick={handleSignOut} size="small">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
        <Tabs
          value={activeTab}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2, minHeight: 48 }}
        >
          <Tab label="Dashboard" value={base} component={RouterLink} to={base} />
          <Tab label="Roster" value={`${base}/roster`} component={RouterLink} to={`${base}/roster`} />
          <Tab label="Balance" value={`${base}/balance`} component={RouterLink} to={`${base}/balance`} />
        </Tabs>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Outlet />
      </Container>
    </Box>
  )
}
