<script setup lang="ts">
import { useCampaignStore } from '@/stores/campaign.ts'
import { storeToRefs } from 'pinia'
import { getGameCover } from '@/services/gameService.ts'
import { LogoSteam, LogoYoutube } from '@vicons/ionicons5'
import { NButton, NIcon, NSpace, NSpin, NTooltip } from 'naive-ui'
import { useAuthStore } from '@/stores/auth.ts'
import type { User } from '@/types/User.ts'
import { undoVote, vote } from '@/services/campaignService.ts'
import { ref } from 'vue'

const campaignStore = useCampaignStore()
const { electionActive, election: pool } = storeToRefs(campaignStore)

const auth = useAuthStore()
const { user } = storeToRefs(auth)

const loadingVote = ref<boolean | string>(false)

const didIVoteForThis = (players: User[]) => {
  return !!(players ?? []).find((player: User) => player?.id === user.value.id)
}

const undoVoteAction = async () => {
  loadingVote.value = true
  const newCampaignValue = await undoVote()
  await campaignStore.init(newCampaignValue)
  loadingVote.value = false
}

const voteAction = async (option: string) => {
  loadingVote.value = option
  const newCampaignValue = await vote(option)
  await campaignStore.init(newCampaignValue)
  loadingVote.value = false
}
</script>

<template>
  <div v-if="electionActive" class="election-wrap">
    <h3>Hora de lançar seus votos à fogueira:</h3>

    <div class="election">
      <div
        v-for="option in pool?.options || []"
        class="election-option"
        :class="didIVoteForThis(option?.players || []) ? '--voted' : '--not-voted'"
      >
        <div v-if="option?.game">
          <div class="election-option-cover">
            <div
              class="election-option-cover-bg"
              :style="`background-image: url('${getGameCover(option.game)}')`"
            ></div>
            <div class="election-option-cover-content --top">
              <n-space justify="center" align="center">
                <n-tooltip v-if="option?.game?.steam">
                  <template #trigger>
                    <a target="_blank" :href="option?.game?.steam">
                      <n-icon size="28">
                        <LogoSteam />
                      </n-icon>
                    </a>
                  </template>

                  <span>Steam</span>
                </n-tooltip>

                <n-tooltip v-if="option?.game?.trailer">
                  <template #trigger>
                    <a target="_blank" :href="option?.game?.trailer">
                      <n-icon size="22">
                        <LogoYoutube />
                      </n-icon>
                    </a>
                  </template>

                  <span>Trailer</span>
                </n-tooltip>
              </n-space>
            </div>
          </div>
          <div class="election-option-content">
            <h4>{{ option.game?.title }}</h4>

            <div class="undo-vote-action" v-if="user">
              <div v-if="didIVoteForThis(option?.players || [])">
                <n-button
                  quaternary
                  style="margin: 10px 0 0; width: 100%"
                  size="small"
                  @click="undoVoteAction"
                  :disabled="!!loadingVote"
                >
                  <n-spin size="small" v-show="loadingVote" />
                  <span v-show="!loadingVote">Retirar o seu voto</span>
                </n-button>
              </div>
            </div>

            <div class="vote-action">
              <n-tooltip :disabled="!!user">
                <template #trigger>
                  <n-button
                    style="margin: 10px 0 0; width: 100%"
                    size="large"
                    @click="voteAction(option.id)"
                    :disabled="!!loadingVote || !user"
                  >
                    <n-spin size="small" v-show="loadingVote === option.id" />
                    <span v-show="loadingVote !== option.id">Votar</span>
                  </n-button>
                </template>
                <div v-if="!user">Você precisa estar logado para votar.</div>
              </n-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
