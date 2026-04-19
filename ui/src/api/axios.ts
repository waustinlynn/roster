import axios, { type AxiosRequestConfig } from 'axios'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5242',
  headers: {
    'Content-Type': 'application/json',
  },
})

function getTeamSecret(): string | null {
  try {
    const raw = localStorage.getItem('roster_team')
    if (raw) {
      const { secret } = JSON.parse(raw)
      return secret ?? null
    }
  } catch { /* ignore */ }
  return null
}

export const customInstance = async <T>(
  config: AxiosRequestConfig
): Promise<T> => {
  const secret = getTeamSecret()
  const headers = secret
    ? { ...config.headers as object, 'X-Team-Secret': secret }
    : config.headers

  const { data } = await instance({ ...config, headers })
  return data
}

export default instance
