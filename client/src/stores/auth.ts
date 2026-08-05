import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types/User'
import { jwtDecode } from 'jwt-decode'

type AuthenticatedUser = User & { exp?: number }

export const useAuthStore = defineStore('auth', () => {
  // State
  const jwt = ref<string | null>(null)
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const loading = ref(true)
  const error = ref<unknown>(null)

  // Actions
  async function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search)
    const jwtParam = params.get('jwt')

    if (!jwtParam) {
      throw new Error('Failed to fetch user')
    }

    const user = jwtDecode<AuthenticatedUser>(jwtParam)

    if (!user) {
      throw new Error('Failed to fetch user')
    }

    localStorage.setItem('jwt', jwtParam)
    localStorage.setItem('user', JSON.stringify(user))

    await init(true)
  }

  async function init(force = false) {
    if (!loading.value && !force) {
      return
    }

    // Older versions kept Discord's OAuth token in the browser. It is no longer needed.
    localStorage.removeItem('access_token')

    try {
      jwt.value = localStorage.getItem('jwt')
      user.value = JSON.parse(localStorage.getItem('user') || 'null') as User | null

      if (jwt.value) {
        const payload = jwtDecode<AuthenticatedUser>(jwt.value)

        if (payload.exp && payload.exp * 1000 <= Date.now()) {
          await logout()
          return
        }

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
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/discord`
  }

  async function logout() {
    localStorage.removeItem('jwt')
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    jwt.value = null
    user.value = null
    isAuthenticated.value = false
  }

  return {
    jwt,
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
