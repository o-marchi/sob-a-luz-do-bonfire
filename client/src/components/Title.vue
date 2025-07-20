<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NButton, NIcon } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import { LogoDiscord, LogOut } from '@vicons/ionicons5'

const auth = useAuthStore()
const { isAuthenticated } = storeToRefs(auth);

const showModal = ref(false)
</script>

<template>
  <div class="title-wrapper">
    <n-modal class="luz-modal" v-model:show="showModal" :mask-closable="false" :close-on-esc="false" preset="card" style="width: 400px">
      <div v-if="isAuthenticated" class="flex">
        <p><b>A chama reconhece sua presença.</b></p>
        <p>Sente-se ao redor da fogueira.</p>
        <p>O próximo capítulo está prestes a começar.</p>
      </div>
      <div v-else class="flex">
        <p><b>Saudações, viajante</b></p>
        <p>Ao tocar na luz, revelou-se um segredo guardado pelas sombras.</p>
        <p>Agora, para se juntar ao círculo da fogueira, basta revelar sua presença.</p>

        <n-button
          style="margin: 20px 0 10px; width: 100%"
          size="large"
          @click="auth.login"
        >
          Revelar-se

          <n-icon size="16" style="margin-left: 10px">
            <LogoDiscord />
          </n-icon>
        </n-button>
      </div>
    </n-modal>

    <div>
      <h1 class="title">Sob a <span @click="showModal = true">Luz</span> do <em>Bonfire</em></h1>
      <p class="subtitle">Jogando <em>juntos</em> um jogo single player por mês.</p>
    </div>

    <div class="bonfire">
      <img draggable="false" class="unselectable" src="../assets/bonfire.png" alt="bonfire" />
    </div>
  </div>
</template>