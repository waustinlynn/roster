const STORAGE_KEY = 'roster_team'

interface LocalTeamData {
  teamId: string
  secret: string
}

export function useLocalTeam() {
  const data = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as LocalTeamData) : null
    } catch {
      return null
    }
  })()

  const save = (teamId: string, secret: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teamId, secret }))
  }

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    teamId: data?.teamId ?? null,
    secret: data?.secret ?? null,
    save,
    clear,
  }
}
