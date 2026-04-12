import type { PlayerResponse } from '../../api/index'
import { SkillRatingRow } from './SkillRatingRow'

interface Props {
  players: PlayerResponse[]
  skills: string[]
  onRate: (playerId: string, skillName: string, rating: number) => Promise<void>
  onDeactivate: (playerId: string) => Promise<void>
}

export function PlayerList({ players, skills, onRate, onDeactivate }: Props) {
  if (players.length === 0) {
    return <p style={{ color: '#888' }}>No players yet. Add one above.</p>
  }

  const active = players.filter(p => p.isActive)
  const inactive = players.filter(p => !p.isActive)

  const renderPlayer = (p: PlayerResponse, canDeactivate: boolean) => (
    <li key={p.playerId} style={{
      padding: '12px 0',
      borderBottom: '1px solid #eee',
      opacity: p.isActive ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>{p.name}</strong>
        {canDeactivate && (
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
