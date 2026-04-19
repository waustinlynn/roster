import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalTeam } from '../hooks/useLocalTeam'
import { useCreateTeam } from '../hooks/useTeam'
import { getTeamsMe } from '../api/index'
import type { CreateTeamRequest } from '../api/index'

export function Landing() {
  const navigate = useNavigate()
  const { save } = useLocalTeam()

  const [createForm, setCreateForm] = useState<CreateTeamRequest>({ name: '', sportName: 'Softball' })
  const [secret, setSecret] = useState('')
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null)
  const [enterError, setEnterError] = useState<string | null>(null)
  const [enterLoading, setEnterLoading] = useState(false)

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
      // Temporarily write to localStorage so customInstance injects the header
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

  if (newSecret) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}>
        <h2>Team Created!</h2>
        <p><strong>Save your access secret — it will never be shown again:</strong></p>
        <code style={{ display: 'block', padding: 12, background: '#f0f0f0', wordBreak: 'break-all', marginBottom: 16 }}>
          {newSecret}
        </code>
        <button onClick={handleSaveAndContinue}>I've saved it — go to my team</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}>
      <h1>Roster Manager</h1>

      <h2>Create a New Team</h2>
      <form onSubmit={handleCreate}>
        <div style={{ marginBottom: 10 }}>
          <label>Team Name<br />
            <input
              value={createForm.name ?? ''}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              required
              maxLength={100}
              style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Sport<br />
            <select
              value={createForm.sportName ?? ''}
              onChange={e => setCreateForm(f => ({ ...f, sportName: e.target.value }))}
            >
              <option value="Softball">Softball</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={createTeam.isPending}>
          {createTeam.isPending ? 'Creating…' : 'Create Team'}
        </button>
        {createTeam.isError && (
          <p style={{ color: 'red', marginTop: 8 }}>
            {(createTeam.error as { detail?: string })?.detail ?? 'Failed to create team'}
          </p>
        )}
      </form>

      <hr style={{ margin: '24px 0' }} />

      <h2>Return to Your Team</h2>
      <form onSubmit={handleEnterSecret}>
        <div style={{ marginBottom: 10 }}>
          <label>Access Secret<br />
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              required
              style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
            />
          </label>
        </div>
        <button type="submit" disabled={enterLoading}>
          {enterLoading ? 'Checking…' : 'Access Team'}
        </button>
        {enterError && <p style={{ color: 'red', marginTop: 8 }}>{enterError}</p>}
      </form>
    </div>
  )
}
