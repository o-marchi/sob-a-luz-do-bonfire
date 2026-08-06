import api from './api'
import type { Campaign } from '@/types/Campaign'
import type {
  AppliedCycleTransition,
  CycleDraw,
  CycleOverview,
  CycleTransitionInput,
  CycleTransitionPreview,
} from '@/types/Cycle'

export const getCycleOverview = async (): Promise<CycleOverview> => {
  const { data } = await api.get<CycleOverview>('/cycle/overview')
  return data
}

export const drawCyclePool = async (): Promise<CycleDraw> => {
  const { data } = await api.post<CycleDraw>('/cycle/draw')
  return data
}

export const startCycleElection = async (
  selectionToken: string,
  electionEndsAt?: string,
): Promise<Campaign> => {
  const { data } = await api.post<Campaign>('/cycle/start-election', {
    selectionToken,
    electionEndsAt,
  })
  return data
}

export const cancelCycleElection = async (): Promise<Campaign> => {
  const { data } = await api.post<Campaign>('/cycle/cancel-election', { confirm: true })
  return data
}

export const previewCycleTransition = async (
  input: CycleTransitionInput,
): Promise<CycleTransitionPreview> => {
  const { data } = await api.post<CycleTransitionPreview>('/cycle/transition/preview', input)
  return data
}

export const applyCycleTransition = async (
  input: CycleTransitionInput,
  confirmationToken: string,
): Promise<AppliedCycleTransition> => {
  const { data } = await api.post<AppliedCycleTransition>('/cycle/transition/apply', {
    ...input,
    confirm: true,
    confirmationToken,
  })
  return data
}
