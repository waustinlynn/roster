import { useGetBalance } from '../api/index'

export function useGetBalanceMatrix(teamId: string) {
  return useGetBalance(teamId, { query: { enabled: !!teamId } })
}
