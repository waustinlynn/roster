import axios from 'axios'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Inject X-Team-Secret header from localStorage on every request
instance.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('roster_team')
    if (raw) {
      const { secret } = JSON.parse(raw)
      if (secret) config.headers['X-Team-Secret'] = secret
    }
  } catch {
    // ignore
  }
  return config
})

export const customInstance = async <T>(
  config: Parameters<typeof instance>[0]
): Promise<T> => {
  const { data } = await instance(config)
  return data
}

export default instance
