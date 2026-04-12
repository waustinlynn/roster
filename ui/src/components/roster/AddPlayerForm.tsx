import { useState } from 'react'

interface Props {
  onAdd: (name: string) => Promise<void>
}

export function AddPlayerForm({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await onAdd(name.trim())
      setName('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add player'
      setError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Player name"
        maxLength={100}
        required
        style={{ padding: '6px 10px', flexGrow: 1 }}
      />
      <button type="submit" disabled={!name.trim()}>Add Player</button>
      {error && <span style={{ color: 'red', fontSize: 13 }}>{error}</span>}
    </form>
  )
}
