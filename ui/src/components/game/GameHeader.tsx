import type { GameDto } from '../../api/index'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import LockIcon from '@mui/icons-material/Lock'

interface Props {
  game: GameDto
  onLock: () => void
  locking: boolean
}

export function GameHeader({ game, onLock, locking }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
      }}
    >
      <Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h4" component="h1">
            {game.date}
          </Typography>
          {game.opponent && (
            <Typography variant="h5" component="span" color="text.secondary" fontWeight={400}>
              vs {game.opponent}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {game.inningCount} innings
          </Typography>
          {game.isLocked && (
            <Chip
              icon={<LockIcon />}
              label="Locked"
              size="small"
              color="default"
              variant="outlined"
            />
          )}
        </Stack>
      </Box>

      {!game.isLocked && (
        <Button
          onClick={onLock}
          disabled={locking}
          variant="contained"
          color="primary"
          startIcon={<LockIcon />}
        >
          {locking ? 'Locking…' : 'Lock game'}
        </Button>
      )}
    </Box>
  )
}
