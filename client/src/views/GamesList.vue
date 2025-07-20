<script setup lang="ts">
import { getGames } from '@/services/gameService.ts';
import { onMounted, ref } from 'vue'

const games = ref([]);

onMounted(async () => {
  games.value = (await getGames()).data;
});

</script>

<template>
  <div class="games-list main-block">
    <p> Hello world </p>

    <div v-for="game in games" style="margin-top: 40px;">
      <h2>{{ game.title }}</h2>
      <img :src="game.img" :alt="game.title" width="300">
      <p>{{ game.period }}</p>
    </div>

  </div>
</template>
