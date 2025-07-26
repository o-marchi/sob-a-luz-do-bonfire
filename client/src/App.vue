<script setup lang="ts">
import { RouterView } from 'vue-router'
import Title from './components/Title.vue'
import Login from '@/components/Login.vue'
import { ref } from 'vue'
import Canvas from '@/components/Canvas.vue'
import {
  darkTheme,
  datePtBR,
  GlobalThemeOverrides,
  NConfigProvider,
  NMessageProvider,
  ptBR,
} from 'naive-ui'

const activeMenu = ref<string | null>(null)

const menuOptions: any[] = [
  {
    label: 'Home',
    path: '/',
  },
  {
    label: 'Lista de Jogos',
    path: '/games-list',
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
          <!--          <n-menu-->
          <!--            class="main-menu"-->
          <!--            :options="menuOptions"-->
          <!--            v-model:value="activeMenu"-->
          <!--            mode="horizontal"-->
          <!--          ></n-menu>-->
        </div>
      </div>
    </header>

    <main>
      <n-message-provider>
        <RouterView />
      </n-message-provider>
    </main>
  </n-config-provider>
</template>
