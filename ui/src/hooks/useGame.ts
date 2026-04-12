import { useQueryClient } from '@tanstack/react-query'
import {
  useGetGames,
  useGetGame,
  useCreateGame as useCreateGameMutation,
  useMarkPlayerAbsent as useMarkPlayerAbsentMutation,
  useRevokePlayerAbsence as useRevokePlayerAbsenceMutation,
  useSetBattingOrder as useSetBattingOrderMutation,
  useAssignInningFielding as useAssignInningFieldingMutation,
  useLockGame as useLockGameMutation,
  getGetGamesQueryKey,
  getGetGameQueryKey,
  getGetBalanceQueryKey,
} from '../api/index'

export function useGetGamesList(teamId: string) {
  return useGetGames(teamId, { query: { enabled: !!teamId } })
}

export function useGetGameDetail(teamId: string, gameId: string) {
  return useGetGame(teamId, gameId, { query: { enabled: !!teamId && !!gameId } })
}

export function useCreateGame(teamId: string) {
  const qc = useQueryClient()
  return useCreateGameMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGamesQueryKey(teamId) }),
    },
  })
}

export function useMarkAbsent(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useMarkPlayerAbsentMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) }),
    },
  })
}

export function useRevokeAbsence(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useRevokePlayerAbsenceMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) }),
    },
  })
}

export function useSetBattingOrder(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useSetBattingOrderMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) }),
    },
  })
}

export function useAssignInningFielding(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useAssignInningFieldingMutation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) })
        qc.invalidateQueries({ queryKey: getGetBalanceQueryKey(teamId) })
      },
    },
  })
}

export function useLockGame(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useLockGameMutation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) })
        qc.invalidateQueries({ queryKey: getGetGamesQueryKey(teamId) })
      },
    },
  })
}
