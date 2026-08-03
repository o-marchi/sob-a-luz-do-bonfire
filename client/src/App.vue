<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import Title from './components/Title.vue'
import Canvas from '@/components/Canvas.vue'
import TopNavigation from '@/components/TopNavigation.vue'
import {
  type GlobalThemeOverrides,
  darkTheme,
  datePtBR,
  ptBR,
  NConfigProvider,
  NMessageProvider,
} from 'naive-ui'

const route = useRoute()
const pageTitle = computed(() => route.meta.pageTitle as string | undefined)
const isInnerPage = computed(() => Boolean(pageTitle.value))

watch(
  isInnerPage,
  (innerPage) => {
    document.body.classList.toggle('bonfire-inner-page', innerPage)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.classList.remove('bonfire-inner-page')
})

const themeOverrides: GlobalThemeOverrides = {
  Tooltip: {
    color: '#24181b',
    textColor: '#f7ded0',
    borderRadius: '6px',
    padding: '8px 11px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.42)',
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
    <Canvas :compact="isInnerPage" />

    <header class="site-header">
      <TopNavigation />
    </header>

    <n-message-provider>
      <RouterView v-slot="{ Component, route: activeRoute }">
        <div class="route-viewport">
          <Transition name="route-page" mode="out-in">
            <div :key="activeRoute.path" class="route-stage">
              <section v-if="activeRoute.meta.pageTitle" class="page-intro">
                <p v-if="activeRoute.meta.pageKicker" class="page-intro__kicker">
                  {{ activeRoute.meta.pageKicker }}
                </p>
                <h1>{{ activeRoute.meta.pageTitle }}</h1>
              </section>

              <Title v-else />

              <main :class="{ 'main--inner-page': Boolean(activeRoute.meta.pageTitle) }">
                <component :is="Component" />
                <p>&nbsp;</p>
              </main>
            </div>
          </Transition>
        </div>
      </RouterView>
    </n-message-provider>
  </n-config-provider>
</template>
