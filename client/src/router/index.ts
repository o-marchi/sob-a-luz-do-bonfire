import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import AuthCallbackPage from '@/views/AuthCallbackPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/campanhas',
      name: 'campanhas',
      component: () => import('../views/Campaigns.vue'),
    },
    {
      path: '/regras',
      name: 'regras',
      component: () => import('../views/Rules.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackPage,
    },
  ],
})

export default router
