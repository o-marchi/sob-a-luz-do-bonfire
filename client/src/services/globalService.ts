import api from './api'
import type { GlobalData, GlobalDataResponse } from '@/types/GlobalData.ts'
import { convertGameDataToGame } from '@/services/gameService.ts'

export const getGlobalInfo = async (): Promise<GlobalData> => {
  const {
    data: { data: globalDataResponse },
  } = await api.get<{ data: GlobalDataResponse }>('/global?populate[game][populate]=cover')

  return {
    ...globalDataResponse,
    game: globalDataResponse?.game ? convertGameDataToGame(globalDataResponse.game) : undefined,
  }
}
