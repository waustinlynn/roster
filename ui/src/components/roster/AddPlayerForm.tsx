import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import PersonAddIcon from '@mui/icons-material/PersonAdd'

interface Props {
  onAdd: (name: string) => Promise<void>
}

export function AddPlayerForm({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onAdd(name.trim())
      setName('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add player')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      variant="outlined"
      sx={{ p: 2 }}
    >
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Player name"
            inputProps={{ maxLength: 100 }}
            required
            size="small"
            sx={{ flex: 1 }}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Adding…' : 'Add player'}
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Paper>
  )
}
