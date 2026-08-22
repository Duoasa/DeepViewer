import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adaptSubscriptionsPlugin,
  SUBSCRIPTIONS_DSH_PEER_VERSION,
  SUBSCRIPTIONS_UI_ADAPTER_ID,
} from './adapt-subscriptions-plugin.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const upstreamRoot = resolve(projectRoot, 'upstream', 'deepseek-harness')
const subscriptionsPluginName = 'dsh-plugin-subscriptions'
const subscriptionsPluginVersion = '0.3.1'
const subscriptionsPluginSource = resolve(projectRoot, 'node_modules', subscriptionsPluginName)
const subscriptionsPluginTarget = resolve(upstreamRoot, 'node_modules', subscriptionsPluginName)
const subscriptionsPluginStampPath = resolve(upstreamRoot, '.deepviewer-subscriptions-plugin')
const subscriptionsUiAdapterPath = resolve(appRoot, 'scripts', 'adapt-subscriptions-plugin.mjs')
const previewPluginName = '@deepviewer/dsh-plugin-preview'
const previewPluginVersion = '0.1.0'
const previewPluginSource = resolve(appRoot, 'dsh-plugins', 'preview')
const previewPluginStage = resolve(upstreamRoot, '.deepviewer', 'plugins', 'preview')
const previewPluginTarget = resolve(upstreamRoot, 'node_modules', '@deepviewer', 'dsh-plugin-preview')
const previewPluginStampPath = resolve(upstreamRoot, '.deepviewer-preview-plugin')
const previewPluginPeers = new Map([
  ['react', resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'node_modules', 'react')],
  ['@types/react', resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'node_modules', '@types', 'react')],
])
const subscriptionsPluginPeers = new Map([
  ['@deepseek-ai/cordis', resolve(upstreamRoot, 'vendor', 'cordis')],
  ['@deepseek-ai/dsh-attachment', resolve(upstreamRoot, 'packages', 'attachment', 'attachment')],
  ['@deepseek-ai/dsh-home-paths', resolve(upstreamRoot, 'packages', 'util', 'home-paths')],
  ['@deepseek-ai/dsh-llm', resolve(upstreamRoot, 'packages', 'llm', 'llm')],
  ['@deepseek-ai/dsh-tools', resolve(upstreamRoot, 'packages', 'core', 'tools')],
  ['@deepseek-ai/schemastery', resolve(upstreamRoot, 'vendor', 'schemastery')],
])
const desktopManifest = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'))
const desktopVersion = desktopManifest.version
const desktopBuildNumber = desktopManifest.buildNumber
const harnessManifest = JSON.parse(readFileSync(resolve(upstreamRoot, 'package.json'), 'utf8'))
const harnessVersion = harnessManifest.version
if (typeof desktopVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(desktopVersion)) {
  throw new Error(`Invalid DeepViewer version: ${String(desktopVersion)}`)
}
if (!Number.isInteger(desktopBuildNumber) || desktopBuildNumber < 1) {
  throw new Error(`Invalid DeepViewer build number: ${String(desktopBuildNumber)}`)
}
if (typeof harnessVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(harnessVersion)) {
  throw new Error(`Invalid DeepSeek Harness version: ${String(harnessVersion)}`)
}
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
const fileOverrides = [
  {
    name: 'deepviewer-brand-slot-components',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-brand-official',
      'Brand.tsx',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-brand-official',
      'src',
      'client',
      'Brand.tsx',
    ),
  },
  {
    name: 'deepviewer-brand-slot-registration',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-brand-official',
      'index.ts',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-brand-official',
      'src',
      'client',
      'index.ts',
    ),
  },
  {
    name: 'deepviewer-preview-file-router',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-primitives',
      'DeepViewerPreviewFile.ts',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-primitives',
      'src',
      'DeepViewerPreviewFile.ts',
    ),
  },
  {
    name: 'document-root-portal-primitive',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-primitives',
      'Portal.tsx',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-primitives',
      'src',
      'Portal.tsx',
    ),
  },
  {
    name: 'global-settings-shell',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'SettingsRoot.tsx',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'SettingsRoot.tsx',
    ),
  },
  {
    name: 'global-settings-layout',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'SettingsRoot.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'SettingsRoot.module.css',
    ),
  },
  {
    name: 'about-deepviewer-section',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'AboutSection.tsx',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'AboutSection.tsx',
    ),
    template: true,
  },
  {
    name: 'about-deepviewer-layout',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'AboutSection.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'AboutSection.module.css',
    ),
  },
  {
    name: 'about-deepviewer-icon',
    sourcePath: resolve(appRoot, 'assets', 'deepviewer-icon-macos26-1024.png'),
    targetPath: resolve(upstreamRoot, 'apps', 'web', 'public', 'deepviewer-icon.png'),
  },
  {
    name: 'extensible-details-panel',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'DetailsPanel.tsx',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'DetailsPanel.tsx',
    ),
  },
  {
    name: 'extensible-details-panel-layout',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-conversation',
      'DetailsPanel.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-conversation',
      'src',
      'client',
      'skeleton',
      'DetailsPanel.module.css',
    ),
  },
]
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
  {
    name: 'center-sidebar-wordmark',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-sidebar',
      'BrandWordmark.module.css',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-sidebar',
      'src',
      'client',
      'SidebarRoot.module.css',
    ),
  },
]
const textOverrides = [
  {
    name: 'external-client-workspace-manifest',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'build',
      'ExternalWorkspaceManifest.ts.fragment',
    ),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'tsdown.client.ts'),
    needle: '  if (cached !== undefined) return cached\n',
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'tool-row-native-path-import',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ToolRowNativePathImport.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'components', 'ToolRow.tsx'),
    needle: "import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'tool-row-cwd-prop',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ToolRowCwdProp.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'components', 'ToolRow.tsx'),
    needle: '  filePath?: string | undefined\n',
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'tool-row-cwd-destructure',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ToolRowCwdDestructure.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'components', 'ToolRow.tsx'),
    needle: '  filePath,\n',
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'tool-row-native-path',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ToolRowNativePath.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'components', 'ToolRow.tsx'),
    needle: "  const fileLink = filePath !== undefined && onOpenFile !== undefined && failureLine === null\n",
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'tool-row-preview-first-open',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ToolRowOpenFile.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'components', 'ToolRow.tsx'),
    needle: `  const openFile = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (filePath !== undefined) onOpenFile?.(filePath)
  }`,
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'tool-row-file-button-native-path',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ToolRowFileButton.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'components', 'ToolRow.tsx'),
    needle: `              <button
                type="button"
                className={css.fileLink}
                onClick={openFile}
                onKeyDown={fileLinkKeyDown}
              >
                {summaryText}
              </button>`,
    indent: '              ',
    markerKind: 'code',
  },
  {
    name: 'generic-tool-row-native-path',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'GenericToolCardNativePath.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'toolviews', 'GenericToolCard.tsx'),
    needle: `    <ToolRow
      t={t}
      variant={model.variant}
      toolName={toolName}
      icon={VARIANT_ICONS[model.variant]}
      title={model.title}
      // A terminal presenter's description is the contract's above-card text, so
      // it outranks the args-derived summary here exactly as it does in BashRow;
      // a search result view's replacement title outranks it the same way.
      summary={terminal?.description ?? search?.title ?? model.summary}
      // Single-file tools never expose an args body — the path link is the only
      // args interaction. A card is not an args body: a read/write/edit row is
      // single-file AND carries a card, so the card expands under the path link.
      body={singleFile ? null : model.body}
      output={model.output}
      errorSummary={model.errorSummary}
      terminal={terminal}
      diff={diff}
      read={read}
      search={search}
      web={web}
      state={state}
      filePath={model.filePath}
      onOpenFile={singleFile ? openFile : undefined}
      inspect={inspect}
    />`,
    indent: '    ',
    markerKind: 'code',
  },
  {
    name: 'file-mutation-row-native-path',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'FileMutationRowNativePath.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'toolviews', 'file-mutation-row.tsx'),
    needle: `    <ToolRow
      t={t}
      variant={model.variant}
      toolName={toolName}
      icon={<IconEditOutline16 size={14} />}
      title={model.title}
      summary={model.summary}
      body={null}
      output={model.output}
      errorSummary={model.errorSummary}
      diff={diff}
      state={model.state}
      filePath={model.filePath}
      onOpenFile={openFile}
      inspect={inspect}
    />`,
    indent: '    ',
    markerKind: 'code',
  },
  {
    name: 'read-row-native-path',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ReadRowNativePath.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'src', 'client', 'tool', 'toolviews', 'read-row.tsx'),
    needle: `    <ToolRow
      t={t}
      variant={model.variant}
      toolName={toolName}
      icon={<IconBrowseOutline16 size={14} />}
      title={model.title}
      summary={model.summary}
      body={null}
      output={model.output}
      errorSummary={model.errorSummary}
      read={read}
      state={model.state}
      filePath={model.filePath}
      onOpenFile={openFile}
      inspect={inspect}
    />`,
    indent: '    ',
    markerKind: 'code',
  },
  {
    name: 'turn-tail-cwd-contract',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'TurnTailCwdContract.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'contract', 'slots.ts'),
    needle: '  seq: number\n',
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'turn-tail-cwd-destructure',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'TurnTailCwdDestructure.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'chat', 'TurnTailNodeView.tsx'),
    needle: '  node, openFile, forkAt, renderSlot, renderSlotChain, t, useSession,\n',
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'turn-tail-cwd-owner',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'TurnTailCwdOwner.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'chat', 'TurnTailNodeView.tsx'),
    needle: '  const owner: TurnTailOwnerProps = { turn, seq: closing?.finalNode.seq ?? data.seq, openFile }',
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'assistant-cwd-owner',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'AssistantCwdOwner.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'chat', 'AssistantNodeView.tsx'),
    needle: `  node, useTurnData, openFile, renderMessageImages, fileMentions, t,
}: ChatNodeViewProps<'assistant-step'>) {
  const data = node.data
  const turn = node.location.kind === 'turn' || node.location.kind === 'step'
    ? node.location.turn
    : undefined
  const tail = useTurnData('turn-tail')
  const owner = useMemo<TurnTailOwnerProps | undefined>(() => {
    if (turn?.status !== 'closed' || data.finalNode === undefined) return undefined
    if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return undefined
    return { turn, seq: data.finalNode.seq, openFile }
  }, [data.finalNode, openFile, tail, turn])`,
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'produced-files-native-path-import',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'ProducedFilesNativePathImport.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'ProducedFiles.tsx'),
    needle: "import type { HostDescriptionSource } from '@deepseek-ai/dsh-client-connection/client'\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'produced-files-cwd-props',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'ProducedFilesCwdProps.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'ProducedFiles.tsx'),
    needle: `export type ProducedFilesProps = Pick<TurnTailOwnerProps, 'openFile'> & {
  matched: readonly string[]
} & PropsLocale<typeof NS> & InjectFace<ProducedFilesInjected>`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'produced-files-cwd-destructure',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'ProducedFilesCwdDestructure.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'ProducedFiles.tsx'),
    needle: '  matched: paths, openFile, isLoopback, useHostDescription, t,\n',
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'produced-files-button-native-path',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'ProducedFilesButton.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'ProducedFiles.tsx'),
    needle: `          <button
            key={path}
            type="button"
            className={css.file}
            // The full path is the disambiguator when two turns produce files
            // that share a basename; the chip itself stays short.
            title={path}
            aria-label={t('produced.open', { name: path })}
            onClick={() => { openFile(path) }}
          >
            {basename(path)}
          </button>`,
    indent: '          ',
    markerKind: 'code',
  },
  {
    name: 'produced-mentions-native-path-import',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'MentionsNativePathImport.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'turn-deliverables.ts'),
    needle: "import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-client-runtime/client'",
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'produced-mentions-cwd-signature',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'MentionsCwdSignature.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'turn-deliverables.ts'),
    needle: `export function producedFileMentions(
  paths: readonly string[],
  openFile: (path: string) => void,
  label: (path: string) => string,
): MarkdownFileMentions {`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'produced-mentions-native-title',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'MentionsNativeTitle.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'turn-deliverables.ts'),
    needle: '      return { open: () => { openFile(path) }, label: label(path), title: path }',
    indent: '      ',
    markerKind: 'code',
  },
  {
    name: 'produced-mentions-cwd-call',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'MentionsCwdCall.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'src', 'client', 'index.ts'),
    needle: "      return producedFileMentions(paths, owner.openFile, path => t('produced.open', { name: path }))",
    indent: '      ',
    markerKind: 'code',
  },
  {
    name: 'tool-row-native-path-test',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-tool', 'ToolRowNativePathTest.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'tests', 'tool-row.client.spec.tsx'),
    needle: `  it('file rows expand from the row while the path link opens without toggling', () => {
    const open = vi.fn()
    const view = render(
      <ToolRow {...rowProps} variant="read" title="Read" summary="src/a.ts" filePath="src/a.ts" onOpenFile={open} />,
    )
    const row = view.getByRole('button', { name: /Read/ })
    // Path click opens the file and leaves the row collapsed.
    fireEvent.click(view.getByText('src/a.ts'))
    expect(open).toHaveBeenCalledWith('src/a.ts')
    expect(row.getAttribute('aria-expanded')).toBe('false')
    // Row click (outside the link) expands the args body.
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(view.getByText(/"a": 1/)).toBeTruthy()
  })`,
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'produced-files-native-path-test',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'ProducedFilesNativePathTest.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'tests', 'produced-files.client.spec.tsx'),
    needle: "  it('keeps the folder action absent without overflow or a local native opener', () => {",
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'produced-mentions-native-path-test',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-deliverables', 'MentionsNativePathTest.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-deliverables', 'tests', 'produced-files.client.spec.tsx'),
    needle: `  it('resolves exact paths and unique basenames; ambiguity and unknowns stay unresolved', () => {
    const opened: string[] = []
    const resolver = producedFileMentions(
      ['out/index.html', 'a/style.css', 'b/style.css'],
      (path) => { opened.push(path) },
      label,
    )
    // Unique basename resolves to its full path; the full path rides title.
    const byBasename = resolver.resolve('index.html')
    expect(byBasename?.label).toBe('打开 out/index.html')
    expect(byBasename?.title).toBe('out/index.html')
    byBasename?.open()
    expect(opened).toEqual(['out/index.html'])
    // An exact path resolves even when its basename is ambiguous.
    const exact = resolver.resolve('a/style.css')
    expect(exact?.title).toBe('a/style.css')
    // A basename two paths share stays unresolved rather than guessing,
    // and so does a token naming nothing the turn wrote.
    expect(resolver.resolve('style.css')).toBeUndefined()
    expect(resolver.resolve('notes.md')).toBeUndefined()
    expect(basename('a\\\\b\\\\c.txt')).toBe('c.txt')
  })`,
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'markdown-file-mention-native-path',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-primitives', 'MarkdownFileMentionNativePath.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-primitives', 'src', 'markdown', 'render.tsx'),
    needle: `            <button
              type="button"
              className={css.fileMention}
              title={mention.title}
              aria-label={mention.label}
              onClick={mention.open}
            >
              {value}
            </button>`,
    indent: '            ',
  },
  {
    name: 'wider-preview-details-geometry',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsPreviewGeometry.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'columns.ts'),
    needle: `/** Details drag clamp ceiling. */
export const DETAILS_MAX = 520`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'preview-specific-center-floor',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsPreviewSolver.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'columns.ts'),
    needle: `export function computeColumns(viewport: number, sidebar: number, details: number): Columns {
  // The sidebar is fixed at its preference (or the rail) — it never concedes.
  const s = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const d0 = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)

  // Step 1: everything fits at preferred widths.
  if (s + d0 + CENTER_MIN <= viewport) return { sidebar: s, center: viewport - s - d0, details: d0 }

  // Step 2: shrink details toward its minimum.
  const d1 = d0 === 0 ? 0 : Math.max(DETAILS_MIN, viewport - s - CENTER_MIN)
  if (s + d1 + CENTER_MIN <= viewport) return { sidebar: s, center: CENTER_MIN, details: d1 }

  // Step 3: auto-close details (derived — preferences untouched); center
  // absorbs any remaining deficit (may drop below CENTER_MIN).
  return { sidebar: s, center: Math.max(0, viewport - s), details: 0 }
}`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-layout-state',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewState.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'stores.ts'),
    needle: 'type LayoutState = { sidebar: number; details: number; narrow: boolean; narrowExpanded: boolean }',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-action-type',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewActionType.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'stores.ts'),
    needle: '  openDetails: (draft: LayoutState) => void',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-initial-state',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewInitialState.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'stores.ts'),
    needle: '    init: (): LayoutState => ({ sidebar: SIDEBAR_DEFAULT, details: 0, narrow: false, narrowExpanded: false }),',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-open-action',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewOpenAction.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'stores.ts'),
    needle: '      openDetails: (d) => { if (d.details === 0) d.details = DETAILS_DEFAULT },',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-service-contract',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewServiceContract.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'service.ts'),
    needle: '  /** Open the details panel (no-op when already open). */\n  openDetails(): void',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-service-implementation',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewServiceImplementation.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'service.ts'),
    needle: '  /** Open the details panel (no-op when already open). */\n  openDetails(): void {\n    this.#require().openDetails()\n  }',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-toggle-service-test-fake',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsToggleServiceTest.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'tests', 'service.client.spec.ts'),
    needle: '    openDetails: vi.fn(),\n',
    indent: '    ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'details-view-owner-props',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewOwnerProps.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'index.ts'),
    needle: 'export interface DetailsOwnerProps {}',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-render-owner',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsViewRender.tsx.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'AppFrame.tsx'),
    needle: "<DetailsColumn>{renderSlot('details', {})}</DetailsColumn>",
    indent: '        ',
  },
  {
    name: 'details-view-slot-contract',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsViewSlot.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'contract', 'slots.ts'),
    needle: "    'conversation.details.tool': { kind: 'single'; scope: 'session'; owner: DetailsToolOwnerProps }\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'details-view-owner-type',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsViewOwnerType.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'contract', 'slots.ts'),
    needle: 'export interface ConversationHeaderActionOwnerProps {}\n',
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'details-view-contracts',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsViewContracts.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'contract', 'slots.ts'),
    needle: `/**
 * Injected share of the details slot: the panel is otherwise a pure reader of
 * the shared chat store, but its close button is a layout orchestration call.
 */
export interface DetailsInjected {
  /** Close the details panel (layout geometry stays with ctx.layout). */
  closeDetails: () => void
}

/** Full details-slot props: selection store, Tool output seat, injected close callback, and locale. */
export type DetailsSlotProps = PropsRuntime<'details'> & PropsRenderSlots<'conversation.details.tool'>
  & PropsStore<ChatStore> & DetailsInjected & PropsLocale<'conversation'>`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-tool-locale-zh',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsViewToolLocale.zh.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'locales.ts'),
    needle: "  'details.title': '详情',\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'details-view-tool-locale-en',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsViewToolLocale.en.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'locales.ts'),
    needle: "  'details.title': 'Details',\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'details-panel-component-import',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsPanelImport.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'apply.ts'),
    needle: "import { DetailsPanel } from './skeleton/DetailsPanel.tsx'",
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-registry',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsViewRegistry.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'apply.ts'),
    needle: '  // The per-session input machine registry (SessionInputResolver face; published as',
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'open-tool-details-view',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'OpenToolDetailsView.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'apply.ts'),
    needle: '          layout.openDetails()',
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'details-view-registration',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-conversation', 'DetailsRegistration.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'src', 'client', 'apply.ts'),
    needle: `  slots.register({
    name: 'details',
    locale: NS,
    children: {
      'conversation.details.tool': { kind: 'single', scope: 'session' },
    },
    store: chatStore,
    inject: (): DetailsInjected => ({
      closeDetails: () => { layout.closeDetails() },
    }),
  }, DetailsPanel)`,
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'document-root-portal-export',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-primitives',
      'PortalExport.ts.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-primitives',
      'src',
      'index.ts',
    ),
    needle: "export { Modal } from './Modal.tsx'\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'deepviewer-preview-file-router-export',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-primitives',
      'DeepViewerPreviewFileExport.ts.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-primitives',
      'src',
      'index.ts',
    ),
    needle: "export { Modal } from './Modal.tsx'\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
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
    needle: `export function HeroShell({ t, renderSlot, children }: HeroShellProps) {
  return (
    <div className={css.root}>
      <div className={css.stack}>
        <div className={css.headline}>
          {/* figma 34:10412: fish 34×25 leading the headline, gap 10. */}
          <span className={css.fishHitbox}>
            {renderSlot('conversation.hero.brand.mark', { size: 34, className: css.fish }, {
              fallback: <FishLogo size={34} className={css.fish} />,
            })}
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
    needle: '      {hero && <HeroShell t={t} renderSlot={renderSlot} />}',
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
  {
    name: 'disable-sidebar-auto-collapse-import',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-layout',
      'DisableAutoCollapseImport.ts.fragment',
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
    needle: "import { computeColumns, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT } from './columns.ts'",
    indent: '',
    markerKind: 'code',
  },
  {
    name: 'disable-sidebar-auto-collapse',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-layout',
      'DisableAutoCollapse.ts.fragment',
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
    needle: `  // Narrow viewports auto-collapse the sidebar; the store mirror keeps
  // toggleSidebar's semantics right (narrow toggles flip the manual
  // re-expand override, stores.ts). Collapsed is decided here, so the
  // solver stays breakpoint-free: a narrow re-expand passes the preference
  // (or the default when the wide preference is closed) and the center
  // absorbs the squeeze.
  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  useEffect(() => { actions.setNarrow(narrow) }, [actions, narrow])
  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0`,
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'preview-specific-column-solve',
    sourcePath: resolve(appRoot, 'upstream-overrides', 'ui-layout', 'DetailsPreviewColumns.ts.fragment'),
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'src', 'client', 'AppFrame.tsx'),
    needle: '  const cols = computeColumns(viewport, sidebarPreference, detailsSession === undefined ? 0 : panels.details)',
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'about-deepviewer-import',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'AboutSectionImport.ts.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'index.ts',
    ),
    needle: "import { GeneralSection } from './GeneralSection.tsx'\n",
    indent: '',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'about-deepviewer-registration',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'AboutSectionRegistration.ts.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'index.ts',
    ),
    needle: '  }, GeneralSection))\n',
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'settings-back-to-app-zh',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'BackToApp.zh.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  'close': '关闭',",
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'settings-back-to-app-en',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'BackToApp.en.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  'close': 'Close',",
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'about-deepviewer-locales-zh',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'AboutLocales.zh.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  'general.nav': '通用设置',\n",
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'about-deepviewer-locales-en',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-general',
      'AboutLocales.en.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-general',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  'general.nav': 'General',\n",
    indent: '  ',
    markerKind: 'code',
    preserveNeedle: true,
  },
  {
    name: 'models-section-title-zh',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-models',
      'ModelsTitle.zh.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-models',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  title: '模型',",
    indent: '  ',
    markerKind: 'code',
  },
  {
    name: 'models-section-title-en',
    sourcePath: resolve(
      appRoot,
      'upstream-overrides',
      'ui-settings-models',
      'ModelsTitle.en.fragment',
    ),
    targetPath: resolve(
      upstreamRoot,
      'packages',
      'client',
      'ui-settings-models',
      'src',
      'client',
      'locales.ts',
    ),
    needle: "  title: 'Models',",
    indent: '  ',
    markerKind: 'code',
  },
]

// DeepViewer intentionally changes several upstream presentation contracts. Keep the
// generated checkout's narrow GUI assertions aligned so upstream regressions still fail.
const testContractReplacements = [
  {
    name: 'brand-official-deepviewer-split-name',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-brand-official', 'tests', 'browser-plugin.client.spec.tsx'),
    before: "    expect(name.container.querySelector('svg')?.getAttribute('viewBox')).toBe('26 0 156 24')",
    after: `    expect(name.getByText('DeepViewer')).toBeTruthy()
    expect(name.container.querySelector('svg')).toBeNull()`,
  },
  {
    name: 'brand-official-deepviewer-local-profile-registration',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-brand-official', 'tests', 'browser-plugin.client.spec.tsx'),
    before: `  it('leaves every slot empty outside the official build profile', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'local')
    const subject = await bench()
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
  })`,
    after: `  it('fills every brand slot in the local DeepViewer build profile', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'local')
    const subject = await bench()
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(1)
  })`,
  },
  {
    name: 'brand-wordmark-deepviewer-geometry',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-primitives', 'tests', 'icons.client.spec.tsx'),
    before: `    expect(svg.getAttribute('width')).toBe('182')
    expect(svg.getAttribute('viewBox')).toBe('0 0 182 24')

    view.rerender(<primitives.BrandWordmark includeMark={false} />)
    expect(svg.getAttribute('width')).toBe('156')
    expect(svg.getAttribute('viewBox')).toBe('26 0 156 24')`,
    after: `    expect(svg.getAttribute('width')).toBe('124.5')
    expect(svg.getAttribute('viewBox')).toBe('0 0 747 144')

    view.rerender(<primitives.BrandWordmark includeMark={false} />)
    expect(svg.getAttribute('width')).toBe('95.16666666666667')
    expect(svg.getAttribute('viewBox')).toBe('176 0 571 144')`,
  },
  {
    name: 'deepviewer-hero-chrome-contract',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'tests', 'skeleton.client.spec.tsx'),
    before: `  it('renders the English preview badge through the hero locale seat', () => {
    const renderSlot = vi.fn<HeroShellProps['renderSlot']>(() => null)
    const view = render(<HeroShell t={makeTranslate(en, commonEn)} renderSlot={renderSlot} />)
    expect(view.getByText('Into the Unknown')).toBeTruthy()
    expect(view.getByText('Preview')).toBeTruthy()
    expect(renderSlot).toHaveBeenCalledOnce()
    expect(renderSlot.mock.calls[0]?.[0]).toBe('conversation.hero.brand.mark')
    const brandMarkOwner = renderSlot.mock.calls[0]?.[1]
    if (brandMarkOwner === undefined || !('size' in brandMarkOwner) || !('className' in brandMarkOwner)) {
      throw new Error('hero brand-mark owner must provide size and className')
    }
    expect(brandMarkOwner.size).toBe(34)
    expect(brandMarkOwner.className).toBeTypeOf('string')
    expect(renderSlot.mock.calls[0]?.[2]?.fallback).toBeTruthy()
  })`,
    after: `  it('renders the DeepViewer welcome without the upstream preview badge', () => {
    const renderSlot = vi.fn<HeroShellProps['renderSlot']>(() => null)
    const view = render(<HeroShell t={makeTranslate(en, commonEn)} renderSlot={renderSlot} />)
    expect(view.getByText('What shall we build?')).toBeTruthy()
    expect(view.queryByText('Preview')).toBeNull()
    expect(view.container.querySelector('svg')).toBeTruthy()
    expect(renderSlot).not.toHaveBeenCalled()
  })`,
  },
  {
    name: 'deepviewer-hero-zh-copy',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'tests', 'skeleton.client.spec.tsx'),
    before: "'探索未至之境'",
    after: "'让我们做点什么'",
    expectedMatches: 4,
  },
  {
    name: 'deepviewer-hero-no-preview-badge',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'tests', 'skeleton.client.spec.tsx'),
    before: "    expect(b.view.getByText('预览版')).toBeTruthy()",
    after: "    expect(b.view.queryByText('预览版')).toBeNull()",
  },
  {
    name: 'details-multiview-inject-contract',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-conversation', 'tests', 'apply-inject.client.spec.tsx'),
    before: `    expect(Object.keys(injected)).toEqual(['closeDetails'])
    injected.closeDetails()
    expect(b.layoutFake.closeDetails).toHaveBeenCalledTimes(1)`,
    after: `    expect(Object.keys(injected)).toEqual(['closeDetails', 'selectDetailsView', 'views'])
    const views = injected.views
    const selectDetailsView = injected.selectDetailsView
    if (!views || !selectDetailsView) throw new Error('details multiview inject contract is incomplete')
    expect(views.list().map(view => view.id)).toEqual(['tool'])
    selectDetailsView('preview')
    expect(b.layoutFake.openDetails).toHaveBeenCalledWith('preview')
    injected.closeDetails()
    expect(b.layoutFake.closeDetails).toHaveBeenCalledTimes(1)`,
  },
  {
    name: 'details-no-duplicate-close-title',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'tests', 'terminal-card.client.spec.tsx'),
    before: "  it('the close button reaches closeDetails', () => {",
    after: "  it('leaves the shell close action outside the details content', () => {",
  },
  {
    name: 'details-no-duplicate-close-assertion',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-tool', 'tests', 'terminal-card.client.spec.tsx'),
    before: `    fireEvent.click(view.getByRole('button', { name: '关闭详情' }))
    expect(closeDetails).toHaveBeenCalledTimes(1)`,
    after: `    expect(view.queryByRole('button', { name: '关闭详情' })).toBeNull()
    expect(closeDetails).not.toHaveBeenCalled()`,
  },
  {
    name: 'details-active-view-owner-test',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'tests', 'app-frame.client.spec.tsx'),
    before: "    expect(slotCalls.find(c => c.key === 'details')!.props).toEqual({})",
    after: "    expect(slotCalls.find(c => c.key === 'details')!.props).toEqual({ activeView: 'tool' })",
  },
  {
    name: 'manual-sidebar-continuity-tests',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'tests', 'app-frame.client.spec.tsx'),
    before: `describe('AppFrame — narrow-viewport auto-collapse', () => {
  it('mounts collapsed below the breakpoint with no sidebar handle', () => {
    frameWidth = 980
    const { frame, slotCalls } = mountFrame()
    expect(tracks(frame)).toEqual([SIDEBAR_COLLAPSED, 0])
    expect(frame.hasAttribute('data-sidebar-collapsed')).toBe(true)
    expect(slotCalls.filter(c => c.key === 'sidebar').at(-1)!.props).toEqual({ collapsed: true, width: SIDEBAR_COLLAPSED })
    expect(frame.querySelectorAll('[class*="handle"]')).toHaveLength(0)
  })

  it('narrow toggle re-expands over the squeezed center and back', () => {
    frameWidth = 980
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)).toEqual([280, 0])
    expect(frame.hasAttribute('data-sidebar-collapsed')).toBe(false)
    expect(frame.querySelectorAll('[class*="handle"]')).toHaveLength(1)
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)).toEqual([SIDEBAR_COLLAPSED, 0])
  })

  it('a wide-closed preference re-expands at the contract default while narrow', () => {
    frameWidth = 1920
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.toggleSidebar() }) // close while wide: preference 0
    frameWidth = 980
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)).toEqual([280, 0])
    expect(instance.getSnapshot().sidebar).toBe(0) // preference untouched
  })

  it('shrinking across the breakpoint auto-collapses; re-widening restores the drag width', () => {
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.setSidebar(400) })
    frameWidth = 980
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)).toEqual([SIDEBAR_COLLAPSED, 0])
    frameWidth = 1920
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)).toEqual([400, 0])
  })
})`,
    after: `describe('AppFrame — DeepViewer manual sidebar continuity', () => {
  it('keeps the sidebar open below the upstream auto-collapse breakpoint', () => {
    frameWidth = 980
    const { frame, slotCalls } = mountFrame()
    expect(tracks(frame)).toEqual([280, 0])
    expect(frame.hasAttribute('data-sidebar-collapsed')).toBe(false)
    expect(slotCalls.filter(c => c.key === 'sidebar').at(-1)!.props).toEqual({ collapsed: false, width: 280 })
    expect(frame.querySelectorAll('[class*="handle"]')).toHaveLength(1)
  })

  it('lets the user explicitly close and reopen the sidebar while narrow', () => {
    frameWidth = 980
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)).toEqual([SIDEBAR_COLLAPSED, 0])
    expect(frame.hasAttribute('data-sidebar-collapsed')).toBe(true)
    expect(frame.querySelectorAll('[class*="handle"]')).toHaveLength(0)
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)).toEqual([280, 0])
  })

  it('preserves a wide-closed preference across resize until explicit reopen', () => {
    frameWidth = 1920
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.toggleSidebar() })
    frameWidth = 980
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)).toEqual([SIDEBAR_COLLAPSED, 0])
    expect(instance.getSnapshot().sidebar).toBe(0)
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)).toEqual([280, 0])
    expect(instance.getSnapshot().sidebar).toBe(280)
  })

  it('preserves a dragged width while shrinking and re-widening', () => {
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.setSidebar(400) })
    frameWidth = 980
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)).toEqual([400, 0])
    frameWidth = 1920
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)).toEqual([400, 0])
  })
})`,
  },
  {
    name: 'layout-store-default-details-view',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'tests', 'layout-store.client.spec.ts'),
    before: 'expect(store.getSnapshot()).toEqual({ sidebar: SIDEBAR_DEFAULT, details: 0, narrow: false, narrowExpanded: false })',
    after: "expect(store.getSnapshot()).toEqual({ sidebar: SIDEBAR_DEFAULT, details: 0, detailsView: 'tool', narrow: false, narrowExpanded: false })",
  },
  {
    name: 'layout-store-narrow-details-view',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'tests', 'layout-store.client.spec.ts'),
    before: 'expect(store.getSnapshot()).toEqual({ sidebar: 400, details: 0, narrow: true, narrowExpanded: true })',
    after: "expect(store.getSnapshot()).toEqual({ sidebar: 400, details: 0, detailsView: 'tool', narrow: true, narrowExpanded: true })",
  },
  {
    name: 'layout-store-recreated-details-view',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-layout', 'tests', 'layout-store.client.spec.ts'),
    before: `      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      narrow: false,`,
    after: `      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      detailsView: 'tool',
      narrow: false,`,
  },
  {
    name: 'settings-test-about-registration',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-settings-general', 'tests', 'apply.client.spec.ts'),
    before: "    expect(resolveSlotLabel(entry.options.label)).toBe('通用设置')",
    after: `    expect(resolveSlotLabel(entry.options.label)).toBe('通用设置')
    expect(before.slots.entries('settings.section').map(item => item.options.id)).toEqual(['general', 'about'])`,
  },
  {
    name: 'settings-test-list-seat-count',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-settings-general', 'tests', 'apply.client.spec.ts'),
    before: '      expect(after.slots.entries(name)).toHaveLength(1)',
    after: "      expect(after.slots.entries(name)).toHaveLength(name === 'settings.section' ? 2 : 1)",
  },
  {
    name: 'settings-test-live-list-seat-count',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-settings-general', 'tests', 'apply.client.spec.ts'),
    before: '      expect(b.slots.entries(name)).toHaveLength(1)',
    after: "      expect(b.slots.entries(name)).toHaveLength(name === 'settings.section' ? 2 : 1)",
  },
  {
    name: 'settings-test-back-to-app-copy',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-settings-general', 'tests', 'apply.client.spec.ts'),
    before: "    expect(b.locale.bind('settings')('close')).toBe('Close')",
    after: "    expect(b.locale.bind('settings')('close')).toBe('Back to app')",
  },
  {
    name: 'settings-component-back-to-app-copy',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-settings-general', 'tests', 'components.client.spec.tsx'),
    before: "    expect(screen.getByText('Close')).toBeTruthy()",
    after: "    expect(screen.getByText('Back to app')).toBeTruthy()",
  },
  {
    name: 'settings-shell-about-baseline',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-settings-general', 'tests', 'shell.client.spec.ts'),
    before: `    const GENERAL = { id: 'general', order: 0, label: 'general.nav' }
    expect(sections.getSnapshot()).toEqual([GENERAL])`,
    after: `    const GENERAL = { id: 'general', order: 0, label: 'general.nav' }
    const ABOUT = { id: 'about', order: 1000, label: 'about.nav' }
    expect(sections.getSnapshot()).toEqual([GENERAL, ABOUT])`,
  },
  {
    name: 'settings-shell-about-order',
    targetPath: resolve(upstreamRoot, 'packages', 'client', 'ui-settings-general', 'tests', 'shell.client.spec.ts'),
    before: `      GENERAL,
      { id: 'a', order: 0, label: '' },
      { id: 'z', order: 20, label: 'Z' },`,
    after: `      GENERAL,
      { id: 'a', order: 0, label: '' },
      { id: 'z', order: 20, label: 'Z' },
      ABOUT,`,
  },
]
const buildStampPath = resolve(upstreamRoot, '.deepviewer-overrides-build')

function subscriptionsPluginDigest(root) {
  const digest = createHash('sha256')
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === 'node_modules') continue
      const path = resolve(directory, entry.name)
      const relativePath = path.slice(root.length + 1)
      digest.update(relativePath)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() || entry.isSymbolicLink()) digest.update(readFileSync(path))
    }
  }
  visit(root)
  return digest.digest('hex')
}

function validatePreviewPlugin(root, requireBuild = false) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Missing ${previewPluginName} source: ${root}`)
  }
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const clientExport = manifest.exports?.['./client']?.default
  const valid = manifest.name === previewPluginName
    && manifest.version === previewPluginVersion
    && manifest.license === 'MIT'
    && manifest.dsh?.bundle?.patch === './cordis.patch.yml'
    && manifest.dsh?.client?.platform === 'web'
    && typeof manifest.main === 'string'
    && typeof clientExport === 'string'
    && existsSync(resolve(root, 'cordis.patch.yml'))
    && existsSync(resolve(root, 'LICENSE'))
    && (!requireBuild || (existsSync(resolve(root, manifest.main)) && existsSync(resolve(root, clientExport))))
  if (!valid) throw new Error(`Invalid ${previewPluginName}@${previewPluginVersion} package`)
}

function ensureDirectorySymlink(link, target) {
  try {
    if (lstatSync(link).isSymbolicLink() && realpathSync(link) === realpathSync(target)) return false
  } catch {
    // A missing, wrong, or dangling generated entry is replaced below.
  }
  rmSync(link, { recursive: true, force: true })
  mkdirSync(resolve(link, '..'), { recursive: true })
  symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
  return true
}

export function stagePreviewPlugin() {
  validatePreviewPlugin(previewPluginSource)
  const sourceDigest = subscriptionsPluginDigest(previewPluginSource)
  const desiredStamp = `${sourceDigest}\n`
  const stageCurrent = existsSync(previewPluginStage)
    && existsSync(previewPluginStampPath)
    && readFileSync(previewPluginStampPath, 'utf8') === desiredStamp
  if (!stageCurrent) {
    rmSync(previewPluginStage, { recursive: true, force: true })
    mkdirSync(resolve(previewPluginStage, '..'), { recursive: true })
    cpSync(previewPluginSource, previewPluginStage, { recursive: true, dereference: true })
    const stagedTsconfigPath = resolve(previewPluginStage, 'tsconfig.json')
    const stagedTsconfig = readFileSync(stagedTsconfigPath, 'utf8')
      .replaceAll('"../../tsconfig.json"', '"../../../tsconfig.base.client.json"')
    writeFileSync(stagedTsconfigPath, stagedTsconfig)
    const stagedBuildTsconfigPath = resolve(previewPluginStage, 'tsconfig.dsh.json')
    const stagedBuildTsconfig = readFileSync(stagedBuildTsconfigPath, 'utf8')
      .replaceAll('../../../../upstream/deepseek-harness/', '../../../')
    writeFileSync(stagedBuildTsconfigPath, stagedBuildTsconfig)
    const stagedTsdownPath = resolve(previewPluginStage, 'tsdown.config.ts')
    const stagedTsdown = readFileSync(stagedTsdownPath, 'utf8')
      .replaceAll('../../../../upstream/deepseek-harness/', '../../../')
    writeFileSync(stagedTsdownPath, stagedTsdown)
    writeFileSync(previewPluginStampPath, desiredStamp)
  }
  validatePreviewPlugin(previewPluginStage)
  let peersChanged = false
  for (const [name, target] of previewPluginPeers) {
    if (!existsSync(target)) throw new Error(`Missing pinned Harness peer package for ${previewPluginName}: ${name}`)
    peersChanged = ensureDirectorySymlink(
      resolve(previewPluginStage, 'node_modules', ...name.split('/')),
      target,
    ) || peersChanged
  }
  const linkChanged = ensureDirectorySymlink(previewPluginTarget, previewPluginStage)
  if (stageCurrent && !peersChanged && !linkChanged) return false
  process.stdout.write(`Staged ${previewPluginName}@${previewPluginVersion}.\n`)
  return true
}

async function buildPreviewPlugin() {
  const env = {
    ...process.env,
    DSH_EXTERNAL_WORKSPACE_MANIFEST: resolve(previewPluginStage, 'package.json'),
  }
  await run('pnpm', ['exec', 'tsc', '-b', 'tsconfig.dsh.json'], { cwd: previewPluginStage })
  await run('pnpm', ['exec', 'tsdown', '--env.DSH_BUILD_FACE', 'client'], {
    cwd: previewPluginStage,
    env,
  })
  validatePreviewPlugin(previewPluginStage, true)
}

function validateSubscriptionsPlugin(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Missing ${subscriptionsPluginName}; run pnpm install in the DeepViewer workspace`)
  }
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const clientExport = manifest.exports?.['./client']?.default
  if (
    manifest.name !== subscriptionsPluginName
    || manifest.version !== subscriptionsPluginVersion
    || manifest.license !== 'MIT'
    || manifest.dsh?.bundle?.patch !== './cordis.patch.yml'
    || manifest.dsh?.client?.platform !== 'web'
    || typeof manifest.main !== 'string'
    || typeof clientExport !== 'string'
    || !existsSync(resolve(root, manifest.main))
    || !existsSync(resolve(root, clientExport))
    || !existsSync(resolve(root, 'cordis.patch.yml'))
    || !existsSync(resolve(root, 'LICENSE'))
  ) {
    throw new Error(`Invalid ${subscriptionsPluginName}@${subscriptionsPluginVersion} package`)
  }
}

function stageSubscriptionsPluginPeers() {
  let changed = false
  for (const [name, target] of subscriptionsPluginPeers) {
    if (!existsSync(resolve(target, 'package.json'))) {
      throw new Error(`Missing pinned Harness peer package for ${subscriptionsPluginName}: ${name}`)
    }
    const link = resolve(subscriptionsPluginTarget, 'node_modules', ...name.split('/'))
    try {
      if (lstatSync(link).isSymbolicLink() && realpathSync(link) === realpathSync(target)) continue
    } catch {
      // Any missing, wrong, or dangling generated entry is replaced below.
    }
    rmSync(link, { recursive: true, force: true })
    mkdirSync(resolve(link, '..'), { recursive: true })
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
    changed = true
  }
  return changed
}

export function stageSubscriptionsPlugin() {
  validateSubscriptionsPlugin(subscriptionsPluginSource)
  const sourceDigest = subscriptionsPluginDigest(subscriptionsPluginSource)
  const desiredStamp = `${sourceDigest}:${SUBSCRIPTIONS_UI_ADAPTER_ID}:${SUBSCRIPTIONS_DSH_PEER_VERSION}\n`
  const packageCurrent = (
    existsSync(subscriptionsPluginTarget)
    && lstatSync(subscriptionsPluginTarget).isDirectory()
    && existsSync(subscriptionsPluginStampPath)
    && readFileSync(subscriptionsPluginStampPath, 'utf8') === desiredStamp
  )
  if (!packageCurrent) {
    rmSync(subscriptionsPluginTarget, { recursive: true, force: true })
    mkdirSync(resolve(subscriptionsPluginTarget, '..'), { recursive: true })
    cpSync(subscriptionsPluginSource, subscriptionsPluginTarget, { recursive: true, dereference: true })
  }
  validateSubscriptionsPlugin(subscriptionsPluginTarget)
  const adapterChanged = adaptSubscriptionsPlugin(subscriptionsPluginTarget)
  if (!packageCurrent || adapterChanged) writeFileSync(subscriptionsPluginStampPath, desiredStamp)
  const peersChanged = stageSubscriptionsPluginPeers()
  if (packageCurrent && !adapterChanged && !peersChanged) return false
  process.stdout.write(
    `Staged ${subscriptionsPluginName}@${subscriptionsPluginVersion} with ${SUBSCRIPTIONS_UI_ADAPTER_ID} for DSH ${SUBSCRIPTIONS_DSH_PEER_VERSION}.\n`,
  )
  return true
}

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

function fileOverrideContent({ name, sourcePath, template = false }) {
  if (!existsSync(sourcePath)) throw new Error(`Missing DeepViewer file override: ${sourcePath}`)
  const source = readFileSync(sourcePath)
  if (!template) return source

  const desired = source.toString('utf8')
    .replaceAll('__DEEPVIEWER_VERSION__', desktopVersion)
    .replaceAll('__DEEPVIEWER_BUILD_NUMBER__', String(desktopBuildNumber))
    .replaceAll('__DEEPSEEK_HARNESS_VERSION__', harnessVersion)
  if (desired.includes('__DEEP')) {
    throw new Error(`Unresolved DeepViewer template placeholder: ${name}`)
  }
  return Buffer.from(desired)
}

export function syncUpstreamFileOverride(override) {
  const desired = fileOverrideContent(override)
  const current = existsSync(override.targetPath) ? readFileSync(override.targetPath) : undefined
  if (current?.equals(desired) === true) return false

  writeFileSync(override.targetPath, desired)
  process.stdout.write(`Synced DeepViewer file override: ${override.name}.\n`)
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

function syncUpstreamTestContract({ name, targetPath, before, after, expectedMatches = 1 }) {
  if (!existsSync(targetPath)) throw new Error(`Missing upstream test contract target: ${name}`)
  const current = readFileSync(targetPath, 'utf8')
  const beforeMatches = current.split(before).length - 1
  const afterMatches = current.split(after).length - 1
  if (afterMatches === expectedMatches) return false
  if (beforeMatches !== expectedMatches || afterMatches !== 0) {
    throw new Error(
      `DeepViewer test contract anchor mismatch: ${name} (before=${String(beforeMatches)}, after=${String(afterMatches)})`,
    )
  }
  writeFileSync(targetPath, current.replaceAll(before, after))
  process.stdout.write(`Synced DeepViewer test contract: ${name}.\n`)
  return true
}

function overrideDigest() {
  const digest = createHash('sha256')
  digest.update(readFileSync(sourcePath))
  digest.update(readFileSync(subscriptionsUiAdapterPath))
  digest.update(subscriptionsPluginDigest(previewPluginSource))
  for (const override of fileOverrides) {
    digest.update(override.name)
    digest.update(fileOverrideContent(override))
  }
  for (const override of cssOverrides) {
    digest.update(override.name)
    digest.update(readFileSync(override.sourcePath))
  }
  for (const override of textOverrides) {
    digest.update(override.name)
    digest.update(readFileSync(override.sourcePath))
  }
  for (const override of testContractReplacements) {
    digest.update(override.name)
    digest.update(override.before)
    digest.update(override.after)
    digest.update(String(override.expectedMatches ?? 1))
  }
  return digest.digest('hex')
}

async function main() {
  stageSubscriptionsPlugin()
  const previewChanged = stagePreviewPlugin()
  const wordmarkChanged = syncUpstreamWordmark()
  const filesChanged = fileOverrides
    .map(override => syncUpstreamFileOverride(override))
    .some(Boolean)
  const cssChanged = cssOverrides
    .map(override => syncUpstreamCssOverride(override))
    .some(Boolean)
  const textChanged = textOverrides
    .map(override => syncUpstreamTextOverride(override))
    .some(Boolean)
  const testContractsChanged = testContractReplacements
    .map(override => syncUpstreamTestContract(override))
    .some(Boolean)
  const changed = previewChanged || wordmarkChanged || filesChanged || cssChanged || textChanged || testContractsChanged
  const sourceDigest = overrideDigest()
  const builtDigest = existsSync(buildStampPath) ? readFileSync(buildStampPath, 'utf8').trim() : ''
  const needsBuild = changed || builtDigest !== sourceDigest
  if (!changed) process.stdout.write('DeepViewer upstream overrides are current.\n')
  if (!process.argv.includes('--build')) return
  if (!needsBuild) {
    process.stdout.write('DeepViewer upstream override build is current.\n')
    return
  }

  // Client types consume remote contracts emitted by the host build.
  // Build both faces so a clean pinned checkout is reproducible.
  await run('pnpm', ['run', 'build:lib'], { cwd: upstreamRoot })
  await buildPreviewPlugin()
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
