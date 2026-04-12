import type { GameDetailResponse } from '../../api/index'

interface Props {
  game: GameDetailResponse
  onLock: () => void
  locking: boolean
}

export function GameHeader({ game, onLock, locking }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
      <div>
        <h2 style={{ margin: 0 }}>
          {game.date}
          {game.opponent && <span style={{ fontWeight: 400 }}> vs {game.opponent}</span>}
        </h2>
        <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
          {game.inningCount} innings
          {game.isLocked && <span style={{ marginLeft: 8, color: '#c00', fontWeight: 600 }}>🔒 LOCKED</span>}
        </div>
      </div>
      {!game.isLocked && (
        <button
          onClick={onLock}
          disabled={locking}
          style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4 }}
        >
          {locking ? 'Locking…' : 'Lock Game'}
        </button>
      )}
    </div>
  )
}
