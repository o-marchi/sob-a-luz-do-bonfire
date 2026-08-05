export interface User {
  id: number
  isAdmin?: boolean
  name?: string | null
  email?: string | null
  discord?: {
    id?: string
    username?: string
    globalName?: string
    avatar?: string
  }
}
