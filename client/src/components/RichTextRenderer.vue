<script setup lang="ts">
import { h } from 'vue'

defineProps<{
  content: any[]
}>()

function renderNode(node: any) {
  if (node.type === 'paragraph') {
    return h('p', {}, node.children.map(renderNode))
  }

  if (node.type === 'link') {
    return h('a', { href: node.url, target: '_blank', rel: 'noopener' }, node.children.map(renderNode))
  }

  if (node.type === 'text' || typeof node.text === 'string') {
    if (!node.text) {
      return h('br')
    }

    if (node.bold) {
      return h('b', {}, node.text)
    }


    return node.text
  }

  return null
}
</script>

<template>
  <div>
    <component
      v-for="(block, i) in content"
      :key="i"
      :is="renderNode(block)"
    />
  </div>
</template>