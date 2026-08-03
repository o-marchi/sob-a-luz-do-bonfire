import api from './api'

export interface SiteContent {
  key: string
  content: string
  updatedAt: string
}

export const getRules = async (): Promise<SiteContent> => {
  const { data } = await api.get<SiteContent>('/content/rules')
  return data
}
