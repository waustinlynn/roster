interface Props {
  skills: string[]
  currentRatings: Record<string, number>
  onRate: (skillName: string, rating: number) => Promise<void>
}

export function SkillRatingRow({ skills, currentRatings, onRate }: Props) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {skills.map(skill => (
        <label key={skill} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <span>{skill}</span>
          <select
            value={currentRatings[skill] ?? ''}
            onChange={e => {
              const val = Number(e.target.value)
              if (val >= 1 && val <= 5) onRate(skill, val)
            }}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}
