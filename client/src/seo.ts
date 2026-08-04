import type { Router } from 'vue-router'
import seoConfig from '../seo-pages.json'

interface SeoPage {
  path: string
  canonicalPath: string
  title: string
  description: string
  heading: string
  summary: string
  indexable: boolean
}

const configuredSiteUrl = import.meta.env.VITE_SITE_URL || seoConfig.siteUrl
export const siteUrl = configuredSiteUrl.replace(/\/$/, '')

const fallbackPage: SeoPage = {
  path: '',
  canonicalPath: '',
  title: `Página não encontrada | ${seoConfig.siteName}`,
  description: 'A página procurada não existe no Sob a Luz do Bonfire.',
  heading: 'Página não encontrada',
  summary: 'A página procurada não existe.',
  indexable: false,
}

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
}

const upsertCanonical = (canonicalUrl: string) => {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = canonicalUrl
}

const normalizedPath = (routePath: string) =>
  routePath.length > 1 ? routePath.replace(/\/+$/, '') : routePath

const findPage = (routePath: string): SeoPage =>
  (seoConfig.pages.find((page) => page.path === normalizedPath(routePath)) as
    | SeoPage
    | undefined) ?? {
    ...fallbackPage,
    path: routePath,
    canonicalPath: routePath,
  }

const currentImageUrl = () =>
  document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ||
  `${siteUrl}/src/assets/bonfire.png`

const updateStructuredData = (page: SeoPage, canonicalUrl: string) => {
  let script = document.head.querySelector<HTMLScriptElement>('#structured-data')

  if (!script) {
    script = document.createElement('script')
    script.id = 'structured-data'
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: page.title,
    description: page.description,
    inLanguage: seoConfig.language,
    isPartOf: { '@id': `${siteUrl}/#website` },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: currentImageUrl(),
    },
  })
}

export const applySeo = (routePath: string) => {
  const page = findPage(routePath)
  const canonicalUrl = `${siteUrl}${page.canonicalPath || routePath}`
  const robots = page.indexable ? 'index, follow' : 'noindex, nofollow'
  const imageUrl = currentImageUrl()

  document.title = page.title
  upsertMeta('meta[name="description"]', { name: 'description', content: page.description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: robots })
  upsertCanonical(canonicalUrl)

  const metadata = [
    ['meta[property="og:title"]', 'property', 'og:title', page.title],
    ['meta[property="og:description"]', 'property', 'og:description', page.description],
    ['meta[property="og:url"]', 'property', 'og:url', canonicalUrl],
    ['meta[property="og:image"]', 'property', 'og:image', imageUrl],
    ['meta[name="twitter:title"]', 'name', 'twitter:title', page.title],
    ['meta[name="twitter:description"]', 'name', 'twitter:description', page.description],
    ['meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl],
  ] as const

  for (const [selector, attribute, key, value] of metadata) {
    upsertMeta(selector, { [attribute]: key, content: value })
  }

  updateStructuredData(page, canonicalUrl)
}

export const installSeo = (router: Router) => {
  router.afterEach((route) => {
    applySeo(route.path)
  })
}
