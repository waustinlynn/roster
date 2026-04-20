import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalTeam } from '../hooks/useLocalTeam'
import { useCreateTeam } from '../hooks/useTeam'
import { getTeamsMe } from '../api/index'
import type { CreateTeamRequest } from '../api/index'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

export function Landing() {
  const navigate = useNavigate()
  const { save } = useLocalTeam()

  const [tab, setTab] = useState<'create' | 'enter'>('create')
  const [createForm, setCreateForm] = useState<CreateTeamRequest>({ name: '', sportName: 'Softball' })
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null)
  const [enterError, setEnterError] = useState<string | null>(null)
  const [enterLoading, setEnterLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const createTeam = useCreateTeam()

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createTeam.mutate({ data: createForm }, {
      onSuccess: (result) => {
        setNewSecret(result.accessSecret!)
        setCreatedTeamId(result.teamId!)
      },
    })
  }

  const handleSaveAndContinue = () => {
    if (!createdTeamId || !newSecret) return
    save(createdTeamId, newSecret)
    navigate(`/teams/${createdTeamId}`)
  }

  const handleEnterSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnterError(null)
    setEnterLoading(true)
    try {
      localStorage.setItem('roster_team', JSON.stringify({ teamId: '', secret }))
      const team = await getTeamsMe()
      save(team.teamId!, secret)
      navigate(`/teams/${team.teamId}`)
    } catch {
      localStorage.removeItem('roster_team')
      setEnterError('Invalid secret. Please check and try again.')
    } finally {
      setEnterLoading(false)
    }
  }

  const handleCopySecret = async () => {
    if (!newSecret) return
    await navigator.clipboard.writeText(newSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (newSecret) {
    return (
      <PageFrame>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, width: '100%' }}>
          <Stack spacing={2}>
            <Typography variant="h4">Team created</Typography>
            <Alert severity="warning">
              Save this access secret — it will never be shown again.
            </Alert>
            <TextField
              value={newSecret}
              fullWidth
              InputProps={{
                readOnly: true,
                sx: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 14 },
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                      <IconButton onClick={handleCopySecret} edge="end" size="small">
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              size="large"
              onClick={handleSaveAndContinue}
            >
              I've saved it — go to my team
            </Button>
          </Stack>
        </Paper>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="create" label="Create team" />
          <Tab value="enter" label="Access team" />
        </Tabs>

        <Box sx={{ p: { xs: 3, md: 4 } }}>
          {tab === 'create' ? (
            <Box component="form" onSubmit={handleCreate}>
              <Stack spacing={2.5}>
                <TextField
                  label="Team name"
                  value={createForm.name ?? ''}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  required
                  inputProps={{ maxLength: 100 }}
                  fullWidth
                  autoFocus
                />
                <TextField
                  label="Sport"
                  select
                  value={createForm.sportName ?? ''}
                  onChange={e => setCreateForm(f => ({ ...f, sportName: e.target.value }))}
                  fullWidth
                >
                  <MenuItem value="Softball">Softball</MenuItem>
                </TextField>
                {createTeam.isError && (
                  <Alert severity="error">
                    {(createTeam.error as { detail?: string })?.detail ?? 'Failed to create team'}
                  </Alert>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={createTeam.isPending}
                >
                  {createTeam.isPending ? 'Creating…' : 'Create team'}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleEnterSecret}>
              <Stack spacing={2.5}>
                <TextField
                  label="Access secret"
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  required
                  fullWidth
                  autoFocus
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowSecret(s => !s)}
                          edge="end"
                          size="small"
                        >
                          {showSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                {enterError && <Alert severity="error">{enterError}</Alert>}
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={enterLoading}
                >
                  {enterLoading ? 'Checking…' : 'Access team'}
                </Button>
              </Stack>
            </Box>
          )}
        </Box>
      </Paper>
    </PageFrame>
  )
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box sx={{ maxWidth: 440, width: '100%' }}>
        <Stack spacing={3} alignItems="center" sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SportsBaseballIcon fontSize="large" />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={500}>Roster Manager</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Build lineups, balance playing time, track your season.
            </Typography>
          </Box>
        </Stack>
        {children}
      </Box>
    </Box>
  )
}
