<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { NIcon, NPopover } from 'naive-ui'
import { ChevronDown, LogOut } from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { useCampaignStore } from '@/stores/campaign'
import { getUserTokenBreakdown } from '@/services/userService'

const auth = useAuthStore()
const { isAuthenticated, user } = storeToRefs(auth)

const campaignStore = useCampaignStore()
const { campaignUser } = storeToRefs(campaignStore)

const userMenuOpen = ref(false)

const displayName = computed(() => {
  return (
    user.value?.name?.trim() ||
    user.value?.discord?.globalName?.trim() ||
    user.value?.discord?.username?.trim() ||
    'Você'
  )
})

const userInitial = computed(() => displayName.value.charAt(0).toUpperCase())
const tokenBreakdown = computed(() => {
  return campaignUser.value ? getUserTokenBreakdown(campaignUser.value) : []
})

onMounted(async () => {
  try {
    await campaignStore.init()
  } catch {
    // The current page owns user-facing campaign loading errors.
  }
})

const logout = async () => {
  userMenuOpen.value = false
  await auth.logout()
  window.location.href = '/'
}
</script>

<template>
  <nav class="top-navigation" aria-label="Navegação principal">
    <div class="top-navigation__inner">
      <div class="top-navigation__links">
        <RouterLink to="/" class="top-navigation__link">Início</RouterLink>
        <RouterLink to="/campanhas" class="top-navigation__link">Campanhas</RouterLink>
        <RouterLink to="/regras" class="top-navigation__link">Regras</RouterLink>
      </div>

      <div v-if="isAuthenticated" class="top-navigation__account">
        <n-popover
          v-model:show="userMenuOpen"
          class="user-menu-popover"
          trigger="click"
          placement="bottom-end"
          :show-arrow="false"
        >
          <template #trigger>
            <button
              class="user-menu-trigger"
              type="button"
              :aria-expanded="userMenuOpen"
              aria-label="Abrir menu do usuário"
            >
              <img
                v-if="user?.discord?.avatar"
                class="user-avatar"
                :src="user.discord.avatar"
                :alt="`Avatar de ${displayName}`"
              />
              <span v-else class="user-avatar user-avatar--initial" aria-hidden="true">
                {{ userInitial }}
              </span>

              <span class="user-menu-trigger__label">{{ displayName }}</span>

              <span v-if="campaignUser" class="user-token-summary">
                <span class="token" aria-hidden="true"></span>
                <span>{{ campaignUser.tokens }}</span>
              </span>

              <n-icon class="user-menu-trigger__chevron" size="15">
                <ChevronDown />
              </n-icon>
            </button>
          </template>

          <div class="user-menu-card">
            <div class="user-menu-card__identity">
              <strong>{{ displayName }}</strong>
            </div>

            <template v-if="campaignUser">
              <div class="token-summary-heading">
                <div>
                  <span>Seus tokens</span>
                  <strong>{{ campaignUser.tokens }}</strong>
                </div>
                <span class="token token--large" aria-hidden="true"></span>
              </div>

              <ul class="token-breakdown" aria-label="Cálculo dos seus tokens">
                <li
                  v-for="item in tokenBreakdown"
                  :key="item.key"
                  :class="{
                    'token-breakdown__item--inactive': !item.applied,
                    'token-breakdown__item--deduction': item.applied && item.value < 0,
                  }"
                >
                  <span>{{ item.label }}</span>
                  <strong>
                    {{ item.value > 0 ? `+${item.value}` : item.value }}
                  </strong>
                </li>
              </ul>

              <p class="token-cycle-note">Os tokens reiniciam no começo de cada ciclo.</p>
            </template>

            <p v-else class="token-unavailable">
              Seus tokens aparecerão quando você participar da campanha atual.
            </p>

            <button class="user-menu-card__logout" type="button" @click="logout">
              <span>Deixar a fogueira</span>
              <n-icon size="17"><LogOut /></n-icon>
            </button>
          </div>
        </n-popover>
      </div>
    </div>
  </nav>
</template>
