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
      path: '/games-list',
      name: 'games-list',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/GamesList.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackPage,
    }
  ],
})

export default router
