<script setup lang="ts">
import { computed } from 'vue'
import VueMarkdown from 'vue-markdown-render'

import rules from '@/assets/rules.md?raw'

const formattedRules = computed(() => {
  return rules.replace(/\\n/g, '\n')
})
</script>

<template>
  <div>
    <div class="main-block">
      <div class="main-block-content">
        <vue-markdown
          :source="formattedRules"
          :options="{ breaks: true, html: true, linkify: true }"
        />
      </div>
    </div>
  </div>
</template>
