import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalTeam } from '../hooks/useLocalTeam'

export function Landing() {
  const navigate = useNavigate()
  const { save } = useLocalTeam()

  const [createForm, setCreateForm] = useState({ name: '', sportName: 'Softball' })
  const [secretForm, setSecretForm] = useState({ teamId: '', secret: '' })
  const [error, setError] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001'}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.detail ?? 'Failed to create team')
        return
      }
      const data = await res.json()
      setNewSecret(data.accessSecret)
      setCreatedTeamId(data.teamId)
    } catch {
      setError('Network error. Is the API running?')
    }
  }

  const handleSaveAndContinue = () => {
    if (!createdTeamId || !newSecret) return
    save(createdTeamId, newSecret)
    navigate(`/teams/${createdTeamId}`)
  }

  const handleEnterSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    save(secretForm.teamId, secretForm.secret)
    navigate(`/teams/${secretForm.teamId}`)
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
        <div>
          <label>Team Name<br />
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required maxLength={100} />
          </label>
        </div>
        <div>
          <label>Sport<br />
            <select value={createForm.sportName} onChange={e => setCreateForm(f => ({ ...f, sportName: e.target.value }))}>
              <option value="Softball">Softball</option>
            </select>
          </label>
        </div>
        <button type="submit">Create Team</button>
      </form>

      <hr />

      <h2>Return to Your Team</h2>
      <form onSubmit={handleEnterSecret}>
        <div>
          <label>Team ID<br />
            <input value={secretForm.teamId} onChange={e => setSecretForm(f => ({ ...f, teamId: e.target.value }))} placeholder="xxxxxxxx-xxxx-..." required />
          </label>
        </div>
        <div>
          <label>Access Secret<br />
            <input type="password" value={secretForm.secret} onChange={e => setSecretForm(f => ({ ...f, secret: e.target.value }))} required />
          </label>
        </div>
        <button type="submit">Access Team</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
