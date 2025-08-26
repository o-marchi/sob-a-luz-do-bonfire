<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NSpace, NSpin, NSwitch, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCampaignStore } from '@/stores/campaign.ts'
import {
  recalculateElectionResult,
  updatePlayerGameInformation,
} from '@/services/campaignService.ts'
import { getGameCover } from '@/services/gameService.ts'
import ElectionView from '@/components/ElectionView.vue'
import VueMarkdown from 'vue-markdown-render'

const campaignStore = useCampaignStore()
const { campaign, currentGame, campaignUser } = storeToRefs(campaignStore)

const lockedDate = ref(new Date(2025, 6, 31))
const targetDateString = '2025-7-31'

function onUpdateMonth(date: Date) {
  lockedDate.value = new Date(2025, 6, 31)
}

const initialState = ref({
  finished_the_game: false,
  played_the_game: false,
})

const played_the_game = ref<boolean>(false)
const finished_the_game = ref<boolean>(false)

const saveInformationLoading = ref<boolean>(false)

onMounted(async () => {
  await campaignStore.init()

  played_the_game.value = Boolean(campaignUser.value?.played_the_game)
  finished_the_game.value = Boolean(campaignUser.value?.finished_the_game)

  initialState.value = {
    finished_the_game: Boolean(campaignUser.value?.played_the_game),
    played_the_game: Boolean(campaignUser.value?.finished_the_game),
  }
})

const params = new URLSearchParams(window.location.search)

if (params.get('authentication_error') === 'true') {
  useMessage().error('Autenticação falhou. Tente novamente (ou desista).', {
    duration: 5000,
  })

  history.replaceState({}, '', window.location.pathname)
}

const switchPlayedTheGame = (value: boolean) => {
  played_the_game.value = value

  if (!played_the_game.value) {
    finished_the_game.value = false
  }
}

const formattedDescription = computed(() => {
  return campaign.value?.description.replace(/\\n/g, '\n')
})

const hasChanges = computed(() => {
  return (
    initialState.value.finished_the_game !== finished_the_game.value ||
    initialState.value.played_the_game !== played_the_game.value
  )
})

const saveInformation = async () => {
  saveInformationLoading.value = true

  const newCampaignValue = await updatePlayerGameInformation({
    played_the_game: played_the_game.value,
    finished_the_game: finished_the_game.value,
  })

  initialState.value.played_the_game = played_the_game.value
  initialState.value.finished_the_game = finished_the_game.value

  await campaignStore.init(newCampaignValue)

  saveInformationLoading.value = false
}

const recalculateElection = async () => {
  recalculateElectionResult()
}
</script>

<template>
  <div>
    <button class="secret-action" @click="recalculateElection"></button>

    <ElectionView />

    <div v-if="currentGame" class="home main-block">
      <div class="main-block-cover">
        <div
          class="main-block-cover-bg"
          :style="`background-image: url('${getGameCover(currentGame)}')`"
        ></div>
        <div class="main-block-cover-content">
          <p v-if="campaign?.month">Jogo do mês de {{ campaign.month }}</p>
          <h2>{{ currentGame.title }}</h2>
        </div>
      </div>
      <div class="main-block-prepend" v-if="campaignUser">
        <n-space class="main-block-prepend-actions">
          <n-space>
            <n-switch
              :round="false"
              :value="played_the_game"
              @update:value="switchPlayedTheGame($event)"
            />
            <p>Iniciou sua jornada?</p>
          </n-space>

          <n-space>
            <n-switch
              v-show="played_the_game"
              :round="false"
              :value="finished_the_game"
              @update:value="finished_the_game = $event"
            />
            <p v-show="played_the_game">Chegou a concluí-la?</p>
          </n-space>
        </n-space>
        <n-space>
          <n-button type="primary" @click="saveInformation()">
            <n-spin stroke="#18131C" size="small" v-show="saveInformationLoading" />
            <span v-show="!saveInformationLoading">Salvar informação</span>
          </n-button>
        </n-space>
      </div>
      <div class="main-block-content" v-if="campaign">
        <!--        <RichTextRenderer v-if="campaign?.heroDescription" :content="campaign.heroDescription" />-->
        <!--        <pre>{{ campaign.description }}</pre>-->

        <!--        :options="{ breaks: true, html: true, linkify: true }"-->
        <vue-markdown
          :source="formattedDescription"
          :options="{ breaks: true, html: true, linkify: true }"
        />
      </div>
    </div>

    <!--    <div style="padding-top: 100px">-->
    <!--      <n-calendar-->
    <!--        :value="lockedDate"-->
    <!--        #="{ year, month, date }"-->
    <!--        :on-update:value="onUpdateMonth"-->
    <!--      >-->
    <!--        <div v-if="targetDateString === `${year}-${month}-${date}`">-->
    <!--          <p style="margin-top: 6px; text-align: center; color: var(&#45;&#45;color-accent)">Data do próximo encontro</p>-->
    <!--        </div>-->
    <!--      </n-calendar>-->
    <!--    </div>-->
  </div>
</template>
