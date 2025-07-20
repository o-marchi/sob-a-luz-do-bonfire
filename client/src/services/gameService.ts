import api from './api'
import type { Game, GameData } from '@/types/Game'

export const getGames = async () => {
  const response = await api.get<{ data: GameData[] }>('/games?populate=cover')

  // const games: GameData[] = response.data;
  //
  // games.map((game: any) => {
  //   game.img = `${import.meta.env.VITE_STRAPI_URL}${game.cover.url}`;
  // });

  return []
}

export const convertGameDataToGame = (gameData: GameData): Game => {

  const image = gameData.cover?.url
    ? `${import.meta.env.VITE_STRAPI_URL}${gameData.cover.url}`
    : undefined

  return {
    ...gameData,
    image,
  }
}