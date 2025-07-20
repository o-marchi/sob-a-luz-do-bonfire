// auth.ts.ts
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const isAuthenticated = ref(false)
const user = ref<any>(null)
const loading = ref(true)
const error = ref<any>(null)

const idToken = ref<string | null>(null)
const accessToken = ref<string | null>(null)

export async function initAuth() {
  try {
    // Load from localStorage if available
    idToken.value = localStorage.getItem('id_token')
    accessToken.value = localStorage.getItem('access_token')

    isAuthenticated.value = !!accessToken.value

    if (isAuthenticated.value) {
      // Optional: fetch user from Strapi if you need more info
      const response = await fetch(import.meta.env.VITE_API_URL + '/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken.value}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }

      user.value = await response.json()
    }

  } catch (e) {
    error.value = e
    logout()
  } finally {
    loading.value = false
  }
}

export function login() {
  const redirectUri = encodeURIComponent(window.location.origin + '/auth.ts/callback')
  window.location.href = `${import.meta.env.VITE_API_URL}/connect/auth0?redirectUri=${redirectUri}`
}

export function logout() {
  localStorage.removeItem('id_token')
  localStorage.removeItem('access_token')
  idToken.value = null
  accessToken.value = null
  isAuthenticated.value = false
  user.value = null
}

export function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search)

  const rawIdToken = params.get('id_token')
  const rawAccessToken = params.get('access_token')

  console.log('---', rawIdToken);
  console.log('--- 2', rawAccessToken);

  if (rawIdToken && rawAccessToken) {
    console.log('---', rawIdToken, rawAccessToken);
    localStorage.setItem('id_token', rawIdToken)
    localStorage.setItem('access_token', rawAccessToken)

    idToken.value = rawIdToken
    accessToken.value = rawAccessToken
    isAuthenticated.value = true
  }

  // Clean up URL and redirect to home
  window.history.replaceState({}, '', '/')
}

export { isAuthenticated, user, loading, error, idToken, accessToken }
