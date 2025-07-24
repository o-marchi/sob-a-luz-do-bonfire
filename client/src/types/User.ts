export interface User {
  id: number
  name: string
  email: string
  discord: {
    username: string
    global_name: string
    discordId: string
    avatar: string
  }
}