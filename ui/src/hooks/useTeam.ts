import { useQueryClient } from '@tanstack/react-query'
import {
  useCreateTeam as useCreateTeamMutation,
  useGetTeam as useGetTeamQuery,
  getGetTeamQueryKey,
} from '../api/index'
import type { CreateTeamRequest } from '../api/index'

export function useGetTeam(teamId: string) {
  return useGetTeamQuery(teamId, { query: { enabled: !!teamId } })
}

export function useCreateTeam() {
  return useCreateTeamMutation()
}

export function useInvalidateTeam() {
  const qc = useQueryClient()
  return (teamId: string) => qc.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) })
}

export type { CreateTeamRequest }
