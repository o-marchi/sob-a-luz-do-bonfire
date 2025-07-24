import api from './api'
import type { Game } from '@/types/Game'

// export const getGames = async () => {
//   const response = await api.get<{ data: GameData[] }>('/games?populate=cover')
//
//   // const games: GameData[] = response.data;
//   //
//   // games.map((game: any) => {
//   //   game.img = `${import.meta.env.VITE_STRAPI_URL}${game.cover.url}`;
//   // });
//
//   return []
// }

export const getGameCover = (game: Game): string => {
  if (game?.cover?.url) {
    return `${import.meta.env.VITE_STRAPI_URL}${game.cover.url}`;
  }

  return '';
}
