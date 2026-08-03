import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import AuthCallbackPage from '@/views/AuthCallbackPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
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
      meta: {
        pageTitle: 'Campanhas',
        pageKicker: 'Histórias ao redor da fogueira',
      },
    },
    {
      path: '/regras',
      name: 'regras',
      component: () => import('../views/Rules.vue'),
      meta: {
        pageTitle: 'Regras',
        pageKicker: 'Como jogamos juntos',
      },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackPage,
    },
  ],
})

export default router
