<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Title from './components/Title.vue'
import Login from '@/components/Login.vue'
import { ref, h } from 'vue'
import Canvas from '@/components/Canvas.vue'
import {
  type GlobalThemeOverrides,
  darkTheme,
  datePtBR,
  ptBR,
  NConfigProvider,
  NMenu,
  NMessageProvider,
} from 'naive-ui'

function getMenuKeyByPath(path: string) {
  if (path === '/') return 'home'
  if (path.startsWith('/campanhas')) return 'campanhas'
  if (path.startsWith('/regras')) return 'regras'
  return null
}

const activeMenu = ref<string | null>(getMenuKeyByPath(window.location.pathname))

const menuOptions: any[] = [
  {
    label: () => h(RouterLink, { to: '/' }, 'Home'),
    key: 'home',
  },
  // {
  //   label: () => h(RouterLink, { to: '/campanhas' }, 'Campanhas'),
  //   key: 'campanhas',
  // },
  {
    label: () => h(RouterLink, { to: '/regras' }, 'Regras'),
    key: 'regras',
  },
]

const themeOverrides: GlobalThemeOverrides = {
  Tooltip: {
    color: '#141215',
  },
  common: {
    primaryColor: '#8192FF',
    borderRadius: '4px',
    modalColor: '#18131C',
    closeColorHover: 'black',
  },
  Input: {
    border: '#5d4041',
    borderFocus: '#5e2e30',
    borderHover: '#5d4041',
  },
  Switch: {
    // railColorActive: '#5d4041',
  },
}
</script>

<template>
  <n-config-provider
    :theme="darkTheme"
    :locale="ptBR"
    :date-locale="datePtBR"
    :theme-overrides="themeOverrides"
  >
    <Canvas />

    <header>
      <div class="wrapper">
        <Login />
        <Title />

        <div class="main-menu-wrapper">
          <n-menu
            class="main-menu"
            :options="menuOptions"
            v-model:value="activeMenu"
            mode="horizontal"
          ></n-menu>
        </div>
      </div>
    </header>

    <main>
      <n-message-provider>
        <RouterView />
      </n-message-provider>

      <p>&nbsp;</p>
    </main>
  </n-config-provider>
</template>
