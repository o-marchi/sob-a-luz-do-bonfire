import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const clientRoot = fileURLToPath(new URL('..', import.meta.url))
const distDirectory = path.join(clientRoot, 'dist')
const config = JSON.parse(await readFile(path.join(clientRoot, 'seo-pages.json'), 'utf8'))
const siteUrl = (process.env.VITE_SITE_URL || config.siteUrl).replace(/\/$/, '')
const template = await readFile(path.join(distDirectory, 'index.html'), 'utf8')

const assets = await readdir(path.join(distDirectory, 'assets'))
const bonfireImage = assets.find((asset) => /^bonfire-[\w-]+\.png$/.test(asset))

if (!bonfireImage) {
  throw new Error('Could not find the built bonfire image used by SEO metadata.')
}

const imageUrl = `${siteUrl}/assets/${bonfireImage}`
const indexablePages = config.pages.filter((page) => page.indexable)

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const replaceTag = (html, pattern, replacement, label) => {
  if (!pattern.test(html)) {
    throw new Error(`Could not find ${label} in the built index.html.`)
  }

  return html.replace(pattern, replacement)
}

const metaTagPattern = (attribute, key) =>
  new RegExp(`<meta\\s+(?=[^>]*\\b${attribute}="${key}")[^>]*>`)

const buildStructuredData = (page, canonicalUrl) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: config.siteName,
      url: `${siteUrl}/`,
      logo: {
        '@type': 'ImageObject',
        url: imageUrl,
        width: 320,
        height: 332,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: config.siteName,
      description: config.pages[0].description,
      inLanguage: config.language,
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: page.title,
      description: page.description,
      inLanguage: config.language,
      isPartOf: { '@id': `${siteUrl}/#website` },
    },
  ],
})

const buildFallback = (page) => {
  const navigation = indexablePages
    .map(
      (navigationPage) =>
        `<li><a href="${navigationPage.canonicalPath}">${escapeHtml(navigationPage.heading)}</a></li>`,
    )
    .join('')

  return `<!-- SEO_FALLBACK_START -->
      <main class="seo-fallback">
        <h1>${escapeHtml(page.heading)}</h1>
        <p>${escapeHtml(page.summary)}</p>
        <nav aria-label="Páginas do Sob a Luz do Bonfire"><ul>${navigation}</ul></nav>
      </main>
    <!-- SEO_FALLBACK_END -->`
}

const renderPage = (page) => {
  const canonicalUrl = `${siteUrl}${page.canonicalPath}`
  const robots = page.indexable ? 'index, follow' : 'noindex, nofollow'
  let html = template

  html = replaceTag(
    html,
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(page.title)}</title>`,
    'title',
  )
  html = replaceTag(
    html,
    metaTagPattern('name', 'description'),
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    'meta description',
  )
  html = replaceTag(
    html,
    metaTagPattern('name', 'robots'),
    `<meta name="robots" content="${robots}">`,
    'robots metadata',
  )
  html = replaceTag(
    html,
    /<link\s+(?=[^>]*\brel="canonical")[^>]*>/,
    `<link rel="canonical" href="${canonicalUrl}">`,
    'canonical URL',
  )

  const metaValues = {
    'og:title': page.title,
    'og:description': page.description,
    'og:url': canonicalUrl,
    'og:image': imageUrl,
    'twitter:title': page.title,
    'twitter:description': page.description,
    'twitter:image': imageUrl,
  }

  for (const [key, value] of Object.entries(metaValues)) {
    const attribute = key.startsWith('og:') ? 'property' : 'name'
    html = replaceTag(
      html,
      metaTagPattern(attribute, key),
      `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`,
      key,
    )
  }

  html = replaceTag(
    html,
    /<script id="structured-data" type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script id="structured-data" type="application/ld+json">${JSON.stringify(buildStructuredData(page, canonicalUrl)).replaceAll('<', '\\u003c')}</script>`,
    'structured data',
  )
  html = replaceTag(
    html,
    /<!-- SEO_FALLBACK_START -->[\s\S]*?<!-- SEO_FALLBACK_END -->/,
    buildFallback(page),
    'SEO fallback content',
  )

  return html
}

for (const page of config.pages) {
  const outputDirectory =
    page.path === '/' ? distDirectory : path.join(distDirectory, page.path.slice(1))
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'index.html'), renderPage(page))
}

console.log(`Generated ${config.pages.length} static route pages with canonical SEO metadata.`)
