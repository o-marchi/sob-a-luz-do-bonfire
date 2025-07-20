<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import { NButton, NTooltip, NGradientText, NIcon, NPopover } from 'naive-ui'
import { ChevronDown, LogOut } from '@vicons/ionicons5'
import { useCampaignStore } from '@/stores/campaign.ts'

const auth = useAuthStore()
const { user, isAuthenticated } = storeToRefs(auth)

const campaignStore = useCampaignStore()
const { campaignUser } = storeToRefs(campaignStore)

const pluralize = (plural: string, singular: string, count: number): string => {
  if (count === 1) {
    return singular
  }

  return plural
}

const logout = () => {
  auth.logout()
  window.location.href = '/'
}
</script>

<template>
  <div class="login-wrapper">
    <div>
      <div class="float-login">
        <div v-if="isAuthenticated">
          <template v-if="user">

            <template v-if="user.picture">
              <img :src="user.picture" alt="">
            </template>
            <template v-else>
              <div v-if="user.name" class="user-initial">{{ user.name[0] }}</div>
              <div v-if="!user.name && user.username" class="user-initial">{{ user.username[0] }}</div>
            </template>
            
            <p v-if="user.username">{{ user.name || user.username }}</p>
          </template>

          <n-tooltip v-if="campaignUser">
            <template #trigger>
              <div class="user-token">
                <div class="token"></div>
                <span>{{ campaignUser.tokens }}</span>
              </div>
            </template>
            <span>
              Você tem
              <n-gradient-text type="warning">
                {{ campaignUser.tokens }} {{ pluralize('tokens', 'token', campaignUser.tokens) }}
              </n-gradient-text>
              !
            </span>
          </n-tooltip>

          <n-popover class="login-popover" trigger="click" placement="bottom-end">
            <template #trigger>
              <n-icon size="16">
                <ChevronDown />
              </n-icon>
            </template>
            <div class="login-menu">
              <n-button @click="logout">
                Deixar a fogueira

                <n-icon size="16" style="margin-left: 10px">
                  <LogOut />
                </n-icon>
              </n-button>
            </div>
          </n-popover>
        </div>
      </div>
    </div>
  </div>
</template>
