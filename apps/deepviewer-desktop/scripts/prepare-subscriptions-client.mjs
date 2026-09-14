import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { adaptSubscriptionsClientSource } from './adapt-subscriptions-plugin.mjs'

/** Rebundle the pinned MIT plugin without the removed cross-plugin ImageGallery export. */
export function prepareSubscriptionsClient(target, upstream, source) {
  const map = JSON.parse(readFileSync(resolve(source, 'lib/client.js.map'), 'utf8'))
  const expected = ['locales.ts', 'SubscriptionsSection.tsx', 'ImageGenerateToolview.tsx', 'index.ts']
  if (map.sources.length !== expected.length || map.sourcesContent.length !== expected.length) {
    throw new Error('subscriptions 0.3.1 source map contract changed')
  }
  const client = resolve(target, 'src/client')
  const gallery = resolve(client, 'gallery')
  mkdirSync(gallery, { recursive: true })
  for (const name of expected) {
    const index = map.sources.findIndex(path => path === `../src/client/${name}`)
    if (index < 0 || typeof map.sourcesContent[index] !== 'string') throw new Error(`Missing pinned source: ${name}`)
    let content = map.sourcesContent[index]
      .replaceAll("'@deepseek-ai/dsh-client-runtime/client'", "'@deepseek-ai/dsh-client-ui-session/client'")
      .replaceAll("'@deepseek-ai/dsh-api-remotes/client'", "'@deepseek-ai/dsh-client-connection/client'")
    if (name === 'ImageGenerateToolview.tsx') {
      content = content.replace("import { ImageGallery } from '@deepseek-ai/dsh-client-ui-attachment'", "import { ImageGallery } from './gallery/MessageImage.tsx'")
        .replace("import type { ImageAttachmentRef, ImageLoader, MessageImageLabels } from '@deepseek-ai/dsh-client-ui-attachment'", "import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'\nimport type { ImageLoader, MessageImageLabels } from './gallery/MessageImage.tsx'")
    }
    writeFileSync(resolve(client, name), adaptSubscriptionsClientSource(name, content))
  }
  // This is a private source copy of the pinned upstream component, not a new public export.
  // Keep the upstream license alongside it; CSS is bundled by DSH's own client preset.
  for (const name of ['MessageImage.tsx', 'MessageImage.module.css', 'ImageLightbox.tsx', 'ImageLightbox.module.css']) {
    cpSync(resolve(upstream, 'packages/client/ui-attachment/src', name), resolve(gallery, basename(name)))
  }
  cpSync(resolve(upstream, 'LICENSE'), resolve(gallery, 'LICENSE'))
  cpSync(resolve(upstream, 'LICENSE'), resolve(target, 'lib/LICENSE.dsh-gallery'))
  writeFileSync(resolve(target, 'deepviewer-client.config.mjs'), `import { clientBundle } from ${JSON.stringify(resolve(upstream, 'packages/client/tsdown.client.ts'))}\nexport default clientBundle('dsh-plugin-subscriptions', [])({ env: {} }).filter(config => config.name === 'dsh-plugin-subscriptions/client')\n`)
}
