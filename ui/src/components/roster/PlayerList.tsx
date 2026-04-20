import { useState } from 'react'
import type { PlayerResponse } from '../../api/index'
import { SkillRatingRow } from './SkillRatingRow'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'

interface Props {
  players: PlayerResponse[]
  skills: string[]
  onRate: (playerId: string, skillName: string, rating: number) => Promise<void>
  onRename: (playerId: string, name: string) => Promise<void>
  onDeactivate: (playerId: string) => Promise<void>
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('')
}

function PlayerNameEditor({ name, onSave }: { name: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="subtitle1" fontWeight={500}>{name}</Typography>
        <Tooltip title="Rename">
          <IconButton
            size="small"
            onClick={() => { setValue(name); setEditing(true) }}
          >
            <EditIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Stack>
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
    <Stack direction="row" alignItems="center" spacing={1}>
      <TextField
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
        size="small"
        sx={{ width: 200 }}
      />
      <IconButton size="small" onClick={handleSave} disabled={saving} color="primary">
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={() => setEditing(false)}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}

export function PlayerList({ players, skills, onRate, onRename, onDeactivate }: Props) {
  if (players.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No players yet. Add one above.</Typography>
      </Paper>
    )
  }

  const active = players.filter(p => p.isActive)
  const inactive = players.filter(p => !p.isActive)

  const renderPlayer = (p: PlayerResponse, canEdit: boolean) => (
    <Box
      key={p.playerId}
      sx={{
        p: 2,
        opacity: p.isActive ? 1 : 0.55,
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: { md: 220 } }}>
          <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.contrastText', width: 36, height: 36 }}>
            {initials(p.name ?? '?')}
          </Avatar>
          <Stack direction="row" alignItems="center" spacing={1}>
            {canEdit
              ? <PlayerNameEditor name={p.name!} onSave={name => onRename(p.playerId!, name)} />
              : <Typography variant="subtitle1" fontWeight={500}>{p.name}</Typography>
            }
            {!p.isActive && <Chip label="Inactive" size="small" />}
          </Stack>
        </Stack>

        <Box sx={{ flex: 1 }}>
          <SkillRatingRow
            skills={skills}
            currentRatings={p.skills ?? {}}
            onRate={(skill, rating) => onRate(p.playerId!, skill, rating)}
          />
        </Box>

        {canEdit && (
          <Tooltip title="Deactivate">
            <IconButton color="error" onClick={() => onDeactivate(p.playerId!)}>
              <DeleteOutlineIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  )

  return (
    <Paper variant="outlined">
      {active.map((p, idx) => (
        <Box key={p.playerId}>
          {idx > 0 && <Divider />}
          {renderPlayer(p, true)}
        </Box>
      ))}
      {inactive.length > 0 && (
        <>
          <Divider />
          <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover' }}>
            <Typography variant="overline" color="text.secondary">
              Inactive players
            </Typography>
          </Box>
          <Divider />
          {inactive.map((p, idx) => (
            <Box key={p.playerId}>
              {idx > 0 && <Divider />}
              {renderPlayer(p, false)}
            </Box>
          ))}
        </>
      )}
    </Paper>
  )
}
