import { useQueryClient } from '@tanstack/react-query'
import {
  useGetTeamsTeamIdPlayers as useGetPlayers,
  usePostTeamsTeamIdPlayers as useAddPlayerMutation,
  usePutTeamsTeamIdPlayersPlayerIdSkillsSkillName as useRatePlayerSkillMutation,
  useDeleteTeamsTeamIdPlayersPlayerId as useDeactivatePlayerMutation,
  getGetTeamsTeamIdPlayersQueryKey as getGetPlayersQueryKey,
} from '../api/index'
import type { AddPlayerRequest, RateSkillRequest } from '../api/index'

export function useGetRoster(teamId: string) {
  return useGetPlayers(teamId, { query: { enabled: !!teamId } })
}

export function useAddPlayer(teamId: string) {
  const qc = useQueryClient()
  return useAddPlayerMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetPlayersQueryKey(teamId) }),
    },
  })
}

export function useRateSkill(teamId: string) {
  const qc = useQueryClient()
  return useRatePlayerSkillMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetPlayersQueryKey(teamId) }),
    },
  })
}

export function useDeactivatePlayer(teamId: string) {
  const qc = useQueryClient()
  return useDeactivatePlayerMutation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetPlayersQueryKey(teamId) }),
    },
  })
}

export type { AddPlayerRequest, RateSkillRequest }
