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
      path: '/brasas',
      name: 'brasas',
      component: () => import('../views/Backlog.vue'),
      meta: {
        pageTitle: 'Brasas',
        pageKicker: 'Jogos que ainda podem acender a fogueira',
      },
    },
    {
      path: '/lenha',
      redirect: '/brasas',
    },
    {
      path: '/conduzir',
      name: 'conduzir',
      component: () => import('../views/CycleConductor.vue'),
      meta: {
        pageTitle: 'Conduzir o ciclo',
        pageKicker: 'Da última brasa à próxima chama',
      },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackPage,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFound.vue'),
      meta: {
        pageTitle: 'Página não encontrada',
        pageKicker: 'Nem toda brasa continua acesa',
      },
    },
  ],
})

export default router
