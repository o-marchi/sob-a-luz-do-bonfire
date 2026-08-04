import { beforeEach, describe, expect, it } from 'vitest'
import { applySeo, siteUrl } from '@/seo'

describe('SEO metadata', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('publishes indexable route metadata and a canonical URL', () => {
    applySeo('/campanhas')

    expect(document.title).toBe('Campanhas | Sob a Luz do Bonfire')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${siteUrl}/campanhas/`,
    )
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `${siteUrl}/campanhas/`,
    )
  })

  it('marks unknown routes as noindex', () => {
    applySeo('/uma-pagina-que-nao-existe')

    expect(document.title).toBe('Página não encontrada | Sob a Luz do Bonfire')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    )
  })

  it('emits valid WebPage structured data', () => {
    applySeo('/regras')

    const structuredData = JSON.parse(
      document.querySelector('#structured-data')?.textContent ?? '{}',
    )

    expect(structuredData).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: `${siteUrl}/regras/`,
      inLanguage: 'pt-BR',
    })
  })
})
