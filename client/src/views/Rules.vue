<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NSpin, useMessage } from 'naive-ui'
import VueMarkdown from 'vue-markdown-render'
import { getRules, type SiteContent } from '@/services/contentService'

const rules = ref<SiteContent | null>(null)
const loading = ref(true)
const message = useMessage()

const formattedRules = computed(() => {
  return rules.value?.content.replace(/\\n/g, '\n').replace(/<br\s*\/?\s*>/gi, '\n') ?? ''
})

onMounted(async () => {
  try {
    rules.value = await getRules()
  } catch {
    message.error('Não foi possível carregar as regras. Tente novamente.')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="main-block">
      <div class="main-block-content">
        <n-spin v-if="loading" size="large" />
        <vue-markdown
          v-else-if="rules"
          :source="formattedRules"
          :options="{ breaks: true, html: false, linkify: true }"
        />
      </div>
    </div>
  </div>
</template>
