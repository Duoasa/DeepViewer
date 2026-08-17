import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const upstreamRoot = resolve(projectRoot, 'upstream', 'deepseek-harness')
const sourcePath = resolve(
  appRoot,
  'upstream-overrides',
  'ui-primitives',
  'BrandWordmark.tsx',
)
const targetPath = resolve(
  upstreamRoot,
  'packages',
  'client',
  'ui-primitives',
  'src',
  'BrandWordmark.tsx',
)
const cssOverrides = [
  {
    name: 'hide-empty-hero-branding',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'HideEmptyHeroBranding.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'HeroShell.module.css',
    ),
  },
  {
    name: 'bottom-align-empty-composer',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'BottomAlignEmptyComposer.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'ConversationRoot.module.css',
    ),
  },
  {
    name: 'stable-composer-footer-height',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'StableComposerFooter.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'InputBar.module.css',
    ),
  },
  {
    name: 'structural-macos-safe-areas',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-layout',
      'DesktopSafeAreas.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-layout',
      'src',
      'client',
      'AppFrame.module.css',
    ),
  },
]
const textOverrides = [
  {
    name: 'deepviewer-hero-primitives',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'HeroPrimitiveImports.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'EmptyHero.tsx',
    ),
    needle: `import {
  FishLogo, IconChevronDownOutline14, IconFolderClose16, IconFolderOpen16,
} from '@deepseek-ai/dsh-client-ui-primitives'`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'deepviewer-hero-shell',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'HeroShell.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'EmptyHero.tsx',
    ),
    needle: `export function HeroShell({ t, children }: HeroShellProps) {
  return (
    <div className={css.root}>
      <div className={css.stack}>
        <div className={css.headline}>
          {/* figma 34:10412: fish 34×25 leading the headline, gap 10. */}
          <span className={css.fishHitbox}>
            <FishLogo size={34} className={css.fish} />
          </span>
          <span className={css.headlineText}>{t('hero.headline')}</span>
          <span className={css.previewBadge}>{t('hero.preview')}</span>
        </div>
        <div className={css.body}>
          {/* The resident composer (ConversationRoot's root-owned scrollport;
              the workspace row rides the stack above the card) is CSS-centered
              in that scroll body during hero — see
              ConversationRoot.module.css [data-phase='hero']. */}
        </div>
      </div>
      {children}
    </div>
  )
}`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'deepviewer-hero-leaves-composer',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'HeroWelcomeMoved.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'ConversationRoot.tsx',
    ),
    needle: '      {hero && <HeroShell t={t} />}',
    indent: '      ',
  },
  {
    name: 'deepviewer-hero-scroll-seat',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'HeroWelcomeSeat.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'ConversationRoot.tsx',
    ),
    needle: '      <div className={css.scrollBody} data-conversation-scroll="">\n',
    indent: '        ',
    preserveNeedle: true,
  },
  {
    name: 'deepviewer-hero-headline-zh',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'HeroHeadline.zh.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  'hero.headline': '探索未至之境',",
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'deepviewer-hero-headline-en',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'HeroHeadline.en.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  'hero.headline': 'Into the Unknown',",
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'stable-composer-footer-seat',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'StableComposerFooter.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'InputBar.tsx',
    ),
    needle: '      {footer}',
    indent: '      ',
  },
  {
    name: 'structural-main-safe-area',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-layout',
      'CenterColumn.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-layout',
      'src',
      'client',
      'AppFrame.tsx',
    ),
    needle: `function CenterColumn(props: { children?: ReactNode }) {
  return <div className={css.centerCol}>{props.children}</div>
}`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'structural-details-safe-area',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-layout',
      'DetailsColumn.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-layout',
      'src',
      'client',
      'AppFrame.tsx',
    ),
    needle: `function DetailsColumn(props: { children?: ReactNode }) {
  return <div className={css.detailsCol}>{props.children}</div>
}`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'structural-sidebar-safe-area',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-layout',
      'SidebarSafeArea.tsx.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-layout',
      'src',
      'client',
      'AppFrame.tsx',
    ),
    needle: '      <div className={css.sidebarCol}>\n',
    indent: '        ',
    preserveNeedle: true,
  },
]
const buildStampPath = resolve(upstreamRoot, '.deepviewer-overrides-build')

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} failed with code=${String(code)} signal=${String(signal)}`))
    })
  })
}

export function syncUpstreamWordmark() {
  if (!existsSync(sourcePath)) throw new Error(`Missing DeepViewer wordmark override: ${sourcePath}`)
  if (!existsSync(targetPath)) throw new Error(`Missing DeepSeek Harness checkout: ${targetPath}`)

  const source = readFileSync(sourcePath, 'utf8')
  const current = readFileSync(targetPath, 'utf8')
  if (source === current) return false

  writeFileSync(targetPath, source)
  process.stdout.write('Synced DeepViewer React wordmark into the local Harness checkout.\n')
  return true
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function syncUpstreamCssOverride({ name, sourcePath, targetPath }) {
  if (!existsSync(sourcePath)) throw new Error(`Missing DeepViewer CSS override: ${sourcePath}`)
  if (!existsSync(targetPath)) throw new Error(`Missing DeepSeek Harness stylesheet: ${targetPath}`)

  const startMarker = `/* DeepViewer override:start ${name} */`
  const endMarker = `/* DeepViewer override:end ${name} */`
  const managedBlock = new RegExp(
    `\\n*${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n*`,
    'u',
  )
  const source = readFileSync(sourcePath, 'utf8').trim()
  const current = readFileSync(targetPath, 'utf8')
  const base = current.replace(managedBlock, '\n').trimEnd()
  const desired = `${base}\n\n${startMarker}\n${source}\n${endMarker}\n`
  if (current === desired) return false

  writeFileSync(targetPath, desired)
  process.stdout.write(`Synced DeepViewer CSS override: ${name}.\n`)
  return true
}

export function syncUpstreamTextOverride({
  name,
  sourcePath,
  targetPath,
  needle,
  indent,
  markerKind = 'jsx',
  preserveNeedle = false,
}) {
  if (!existsSync(sourcePath)) throw new Error(`Missing DeepViewer text override: ${sourcePath}`)
  if (!existsSync(targetPath)) throw new Error(`Missing DeepSeek Harness source: ${targetPath}`)

  const startMarker = markerKind === 'code'
    ? `${indent}/* DeepViewer override:start ${name} */`
    : `${indent}{/* DeepViewer override:start ${name} */}`
  const endMarker = markerKind === 'code'
    ? `${indent}/* DeepViewer override:end ${name} */`
    : `${indent}{/* DeepViewer override:end ${name} */}`
  const managedBlock = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
    'u',
  )
  const source = readFileSync(sourcePath, 'utf8').trim()
  const indentedSource = source.split('\n').map(line => `${indent}${line}`).join('\n')
  const desiredBlock = `${startMarker}\n${indentedSource}\n${endMarker}`
  const current = readFileSync(targetPath, 'utf8')
  const firstInsertion = preserveNeedle ? `${needle}${desiredBlock}\n` : desiredBlock
  const desired = managedBlock.test(current)
    ? current.replace(managedBlock, desiredBlock)
    : current.includes(needle)
      ? current.replace(needle, firstInsertion)
      : null
  if (desired === null) throw new Error(`DeepViewer override anchor not found: ${name}`)
  if (current === desired) return false

  writeFileSync(targetPath, desired)
  process.stdout.write(`Synced DeepViewer text override: ${name}.\n`)
  return true
}

function overrideDigest() {
  const digest = createHash('sha256')
  digest.update(readFileSync(sourcePath))
  for (const override of cssOverrides) {
    digest.update(override.name)
    digest.update(readFileSync(override.sourcePath))
  }
  for (const override of textOverrides) {
    digest.update(override.name)
    digest.update(readFileSync(override.sourcePath))
  }
  return digest.digest('hex')
}

async function main() {
  const wordmarkChanged = syncUpstreamWordmark()
  const cssChanged = cssOverrides
    .map(override => syncUpstreamCssOverride(override))
    .some(Boolean)
  const textChanged = textOverrides
    .map(override => syncUpstreamTextOverride(override))
    .some(Boolean)
  const changed = wordmarkChanged || cssChanged || textChanged
  const sourceDigest = overrideDigest()
  const builtDigest = existsSync(buildStampPath) ? readFileSync(buildStampPath, 'utf8').trim() : ''
  const needsBuild = changed || builtDigest !== sourceDigest
  if (!changed) process.stdout.write('DeepViewer upstream overrides are current.\n')
  if (!process.argv.includes('--build')) return
  if (!needsBuild) {
    process.stdout.write('DeepViewer upstream override build is current.\n')
    return
  }

  await run('pnpm', ['run', 'build:lib:client'], { cwd: upstreamRoot })
  await run('pnpm', ['run', 'build:web'], { cwd: upstreamRoot })
  writeFileSync(buildStampPath, `${sourceDigest}\n`)
}

const isEntrypoint = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntrypoint) {
  await main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
