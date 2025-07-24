<script setup lang="ts">
import { h } from 'vue'

interface TextNode {
  type: string
  text?: string,
  format?: number,
  children?: Node[],
  fields?: {
    url: string,
    newTab: boolean,
  },
}

interface Node {
  type: string
  format?: number,
  children?: Node[],
  fields?: {
    url: string,
    newTab: boolean,
  },
}

interface Props {
  content: {
    root: {
      children: Node[]
    }
  }
}

defineProps<Props>()

function renderNode(node: Node | TextNode): any {

  if ('text' in node) {
    if (node.format === 1) {
      return h('b', {}, node.text)
    }
    return node.text
  }

  if (!node.children?.length) {
    return h('br')
  }

  switch (node.type) {
    case 'paragraph':
      return h(
        'p',
        {},
        node.children?.map(child => renderNode(child))
      )

    case 'link':
      return h(
        'a',
        {
          href: node.fields?.url,
          // target: node.fields?.newTab ? '_blank' : '_self',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        node.children?.map(child => renderNode(child))
      )

    case 'root':
      return h(
        'div',
        {},
        node.children?.map(child => renderNode(child))
      )

    default:
      return null
  }
}
</script>

<template>
  <div v-if="content?.root?.children">
    <component
      :is="renderNode(content.root)"
    />
  </div>
</template>