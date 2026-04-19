import { useState } from 'react'
import type { PlayerResponse } from '../../api/index'
import { SkillRatingRow } from './SkillRatingRow'

interface Props {
  players: PlayerResponse[]
  skills: string[]
  onRate: (playerId: string, skillName: string, rating: number) => Promise<void>
  onRename: (playerId: string, name: string) => Promise<void>
  onDeactivate: (playerId: string) => Promise<void>
}

function PlayerNameEditor({ name, onSave }: { name: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <strong>{name}</strong>
        <button
          onClick={() => { setValue(name); setEditing(true) }}
          style={{ fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px' }}
        >
          ✏️
        </button>
      </span>
    )
  }

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(trimmed)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
        style={{ fontSize: 14, fontWeight: 600, padding: '2px 6px', width: 160 }}
      />
      <button onClick={handleSave} disabled={saving} style={{ fontSize: 12 }}>
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={() => setEditing(false)} style={{ fontSize: 12 }}>Cancel</button>
    </span>
  )
}

export function PlayerList({ players, skills, onRate, onRename, onDeactivate }: Props) {
  if (players.length === 0) {
    return <p style={{ color: '#888' }}>No players yet. Add one above.</p>
  }

  const active = players.filter(p => p.isActive)
  const inactive = players.filter(p => !p.isActive)

  const renderPlayer = (p: PlayerResponse, canEdit: boolean) => (
    <li key={p.playerId} style={{
      padding: '12px 0',
      borderBottom: '1px solid #eee',
      opacity: p.isActive ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {canEdit
          ? <PlayerNameEditor name={p.name!} onSave={name => onRename(p.playerId!, name)} />
          : <strong>{p.name}</strong>
        }
        {canEdit && (
          <button
            onClick={() => onDeactivate(p.playerId!)}
            style={{ fontSize: 12, color: '#c00', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Deactivate
          </button>
        )}
        {!p.isActive && <span style={{ fontSize: 12, color: '#888' }}>(inactive)</span>}
      </div>
      <SkillRatingRow
        skills={skills}
        currentRatings={p.skills ?? {}}
        onRate={(skill, rating) => onRate(p.playerId!, skill, rating)}
      />
    </li>
  )

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {active.map(p => renderPlayer(p, true))}
      {inactive.length > 0 && (
        <>
          <li style={{ marginTop: 16, marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>Inactive players</span>
          </li>
          {inactive.map(p => renderPlayer(p, false))}
        </>
      )}
    </ul>
  )
}
