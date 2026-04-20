import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Rating from '@mui/material/Rating'

interface Props {
  skills: string[]
  currentRatings: Record<string, number>
  onRate: (skillName: string, rating: number) => Promise<void>
}

export function SkillRatingRow({ skills, currentRatings, onRate }: Props) {
  if (skills.length === 0) return null
  return (
    <Stack
      direction="row"
      spacing={3}
      useFlexGap
      flexWrap="wrap"
    >
      {skills.map(skill => (
        <Box key={skill} sx={{ display: 'flex', flexDirection: 'column', minWidth: 120 }}>
          <Typography variant="caption" color="text.secondary">
            {skill}
          </Typography>
          <Rating
            value={currentRatings[skill] ?? 0}
            max={5}
            onChange={(_, value) => {
              if (value && value >= 1 && value <= 5) onRate(skill, value)
            }}
          />
        </Box>
      ))}
    </Stack>
  )
}
