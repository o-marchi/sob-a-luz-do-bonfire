<!-- src/pages/AuthCallbackPage.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.ts'

const auth = useAuthStore()
const router = useRouter()

onMounted(async () => {
  try {
    await auth.handleAuthCallback()
    await router.replace('/')
  } catch {
    await auth.logout()
    await router.replace('/?authentication_error=true')
  }
})
</script>

<template>
  <div class="auth-callback">Logging you in...</div>
</template>

<style scoped>
.auth-callback {
  padding: 2rem;
  font-size: 1.2rem;
  text-align: center;
}
</style>
