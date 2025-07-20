import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api.ts'
import type { User } from '@/types/User.ts'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = defineStore('auth', () => {
  // State
  const jwt = ref<string | null>(null)
  const accessToken = ref<string | null>(null)
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const loading = ref(true)
  const error = ref<unknown>(null)

  // Actions
  async function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search)
    const accessTokenParam = params.get('access_token')

    if (!accessTokenParam) {
      throw new Error('Failed to fetch user')
    }

    let {
      data: { jwt, user },
    } = (await api.get('/auth/discord/callback', {
      params: {
        access_token: accessTokenParam,
      },
      headers: {
        Authorization: '',
      },
    })) || { data: { jwt: null, user: null } }

    if (!jwt || !user) {
      throw new Error('Failed to fetch user')
    }

    user.name = user.global_name || user.username;

    localStorage.setItem('jwt', jwt)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('access_token', accessTokenParam)

    await init()
  }

  async function init() {
    try {
      jwt.value = localStorage.getItem('jwt')
      accessToken.value = localStorage.getItem('access_token')
      user.value = JSON.parse(localStorage.getItem('user') || 'null') as User | null

      if (jwt.value) {
        isAuthenticated.value = true
      }
    } catch (err) {
      error.value = err
      await logout()
    } finally {
      loading.value = false
    }
  }

  function login() {
    const redirectUri = encodeURIComponent(window.location.origin)
    window.location.href = `${import.meta.env.VITE_API_URL}/connect/discord?redirectUri=${redirectUri}`
  }

  async function logout() {
    localStorage.removeItem('jwt')
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    jwt.value = null
    accessToken.value = null
    user.value = null
    isAuthenticated.value = false
  }

  return {
    jwt,
    accessToken,
    user,
    isAuthenticated,
    loading,
    error,

    // Actions
    handleAuthCallback,
    init,
    login,
    logout,
  }
})