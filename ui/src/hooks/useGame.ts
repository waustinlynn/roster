import { useQueryClient } from '@tanstack/react-query'
import {
  useGetTeamsTeamIdGames as useGetGames,
  useGetTeamsTeamIdGamesGameId as useGetGame,
  usePostTeamsTeamIdGames as useCreateGameMutation,
  usePostTeamsTeamIdGamesGameIdAbsent as useMarkPlayerAbsentMutation,
  useDeleteTeamsTeamIdGamesGameIdAbsentPlayerId as useRevokePlayerAbsenceMutation,
  usePutTeamsTeamIdGamesGameIdBattingOrder as useSetBattingOrderMutation,
  usePutTeamsTeamIdGamesGameIdInningsInningNumberFielding as useAssignInningFieldingMutation,
  usePutTeamsTeamIdGamesGameIdLineup as useUpdateGameLineupMutation,
  usePutTeamsTeamIdGamesGameIdInningsInningNumberScore as useRecordInningScoreMutation,
  usePutTeamsTeamIdGamesGameIdScores as useRecordGameScoresMutation,
  usePostTeamsTeamIdGamesGameIdLock as useLockGameMutation,
  usePutTeamsTeamIdGamesGameIdRemark as useRecordGameRemarkMutation,
  getGetTeamsTeamIdGamesQueryKey as getGetGamesQueryKey,
  getGetTeamsTeamIdGamesGameIdQueryKey as getGetGameQueryKey,
  getGetTeamsTeamIdBalanceQueryKey as getGetBalanceQueryKey,
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

export function useUpdateGameLineup(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useUpdateGameLineupMutation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) })
        qc.invalidateQueries({ queryKey: getGetBalanceQueryKey(teamId) })
      },
    },
  })
}

export function useRecordGameScores(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useRecordGameScoresMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) }),
    },
  })
}

export function useRecordInningScore(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useRecordInningScoreMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) }),
    },
  })
}

export function useRecordGameRemark(teamId: string, gameId: string) {
  const qc = useQueryClient()
  return useRecordGameRemarkMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGameQueryKey(teamId, gameId) }),
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
