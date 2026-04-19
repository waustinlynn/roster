import { useState } from 'react'

const STORAGE_KEY = 'roster_team'

interface LocalTeamData {
  teamId: string
  secret: string
}

function readStorage(): LocalTeamData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LocalTeamData) : null
  } catch {
    return null
  }
}

export function useLocalTeam() {
  const [data, setData] = useState<LocalTeamData | null>(readStorage)

  const save = (teamId: string, secret: string) => {
    const d = { teamId, secret }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
    setData(d)
  }

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setData(null)
  }

  return {
    teamId: data?.teamId ?? null,
    secret: data?.secret ?? null,
    save,
    clear,
  }
}
