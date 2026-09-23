import { syncDesktopNetwork } from './sync-desktop-network.mjs'
import { syncChatModeOverrides, chatModePatchPath } from './sync-chat-mode.mjs'
import { stageBetterSidebar } from './stage-better-sidebar.mjs'
import { buildReasoningPlugin } from './build-reasoning-plugin.mjs'
import { execFileSync, spawn } from 'node:child_process'
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
import { prepareSubscriptionsClient, imageGenerateStylesPath } from './prepare-subscriptions-client.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const upstreamRoot = resolve(projectRoot, 'upstream', 'deepseek-harness')
const subscriptionsPluginName = 'dsh-plugin-subscriptions'
const subscriptionsPluginVersion = '0.3.1'
const subscriptionsPluginSource = resolve(projectRoot, 'node_modules', subscriptionsPluginName)
const subscriptionsPluginTarget = resolve(upstreamRoot, 'node_modules', subscriptionsPluginName)
const subscriptionsPluginStampPath = resolve(upstreamRoot, '.deepviewer-subscriptions-plugin')
const subscriptionsUiAdapterPath = resolve(appRoot, 'scripts', 'adapt-subscriptions-plugin.mjs')
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
const expectedHarnessCommit = 'fb2c4b9e698e30edb738bca4cf0618587db7d203'
if (harnessVersion !== '0.1.5-rc.2' || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstreamRoot, encoding: 'utf8' }).trim() !== expectedHarnessCommit) {
  throw new Error('DeepViewer requires DSH 0.1.5-rc.2 at the pinned official commit')
}
if (typeof desktopVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(desktopVersion)) {
  throw new Error(`Invalid DeepViewer version: ${String(desktopVersion)}`)
}
if (!Number.isInteger(desktopBuildNumber) || desktopBuildNumber < 1) {
  throw new Error(`Invalid DeepViewer build number: ${String(desktopBuildNumber)}`)
}
if (typeof harnessVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(harnessVersion)) {
  throw new Error(`Invalid DeepSeek Harness version: ${String(harnessVersion)}`)
}
syncDesktopNetwork(upstreamRoot)

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
// DSH 0.1.5 owns right-sidebar tabs, file path resolution, and Chat composition.
// Extend its current seats instead of restoring the removed details-view API.
const fileOverrides = [
  { name: 'delivery-alias-validation', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/presented.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/src/presented.ts') },
  { name: 'dedupe-delivery-chips', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/Deliverables.tsx'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/src/client/Deliverables.tsx') },
  { name: 'workspace-delivery', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/workspace-delivery.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/src/workspace-delivery.ts') },
  { name: 'present-delivery-boundary', sourcePath: resolve(appRoot, 'upstream-overrides/tool-present/index.ts'), targetPath: resolve(upstreamRoot, 'packages/fs/tool-present/src/index.ts') },
  { name: 'present-delivery-contract', sourcePath: resolve(appRoot, 'upstream-overrides/tool-present/types.ts'), targetPath: resolve(upstreamRoot, 'packages/fs/tool-present/src/types.ts') },
  { name: 'file-delivery-auto-delivery.host.spec.ts', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/auto-delivery.host.spec.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/tests/auto-delivery.host.spec.ts') },
  { name: 'file-delivery-prompt.host.spec.ts', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/prompt.host.spec.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/tests/prompt.host.spec.ts') },
  { name: 'file-delivery-auto-delivery.ts', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/auto-delivery.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/src/auto-delivery.ts') },
  { name: 'file-delivery-file-delivery-prompt.ts', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/file-delivery-prompt.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/src/file-delivery-prompt.ts') },
  { name: 'file-delivery-index.ts', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/index.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/src/index.ts') },
  { name: 'file-delivery-package.json', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/package.json'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/package.json') },
  { name: 'file-delivery-tsconfig.host.json', sourcePath: resolve(appRoot, 'upstream-overrides/ui-deliverables/tsconfig.host.json'), targetPath: resolve(upstreamRoot, 'packages/client/ui-deliverables/tsconfig.host.json') },
  { name: 'native-theme-preference', sourcePath: resolve(appRoot, 'upstream-overrides/ui-layout/theme-presenter.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-layout/src/client/theme-presenter.ts') },
  { name: 'progressive-process-tests', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/progressive-process.client.spec.tsx'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/tests/progressive-process.client.spec.tsx') },
  { name: 'progressive-progressive-process.ts', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/progressive-process.ts'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/progressive-process.ts') },
  { name: 'progressive-ProgressiveChatNodeList.tsx', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/ProgressiveChatNodeList.tsx'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ProgressiveChatNodeList.tsx') },
  { name: 'progressive-ProgressiveChatNodeList.module.css', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/ProgressiveChatNodeList.module.css'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ProgressiveChatNodeList.module.css') },
  {
    name: "deepviewer-brand-slot-components",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-brand-official/Brand.tsx"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-brand-official/src/client/Brand.tsx"),
  },
  {
    name: "deepviewer-brand-slot-registration",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-brand-official/index.ts"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-brand-official/src/client/index.ts"),
  },
  {
    name: "document-root-portal-primitive",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-primitives/Portal.tsx"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-primitives/src/Portal.tsx"),
  },
  {
    name: "global-settings-shell",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/SettingsRoot.tsx"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/SettingsRoot.tsx"),
  },
  {
    name: "global-settings-layout",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/SettingsRoot.module.css"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/SettingsRoot.module.css"),
  },
  {
    name: "about-deepviewer-section",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/AboutSection.tsx"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/AboutSection.tsx"),
    template: true,
  },
  {
    name: "about-deepviewer-layout",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/AboutSection.module.css"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/AboutSection.module.css"),
  },
  {
    name: "about-deepviewer-icon",
    sourcePath: resolve(appRoot, "assets/deepviewer-icon-macos26-1024.png"),
    targetPath: resolve(upstreamRoot, "apps/web/public/deepviewer-icon.png"),
  },
  {
    name: "EmptyHero.tsx",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/EmptyHero.tsx"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx"),
  },
]
const cssOverrides = [
  { name: 'session-drive-loader', sourcePath: resolve(appRoot, 'upstream-overrides/ui-workspace/SessionDrive.module.css'), targetPath: resolve(upstreamRoot, 'packages/client/ui-workspace/src/client/rows/Rows.module.css') },
  { name: 'progressive-status', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/ProgressiveStatus.module.css'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.module.css') },
  {
    name: 'thinking-status-neutral-shimmer',
    sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/ThinkingStatus.module.css'),
    targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.module.css'),
  },
  {
    name: 'active-composer-bottom-spacing',
    sourcePath: resolve(appRoot, 'upstream-overrides/dsh-015/InputBarBottomSpacing.module.css'),
    targetPath: resolve(upstreamRoot, 'packages/client/ui-conversation/src/client/skeleton/InputBar.module.css'),
  },
  {
    name: "hide-empty-hero-branding",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-conversation/HideEmptyHeroBranding.module.css"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-conversation/src/client/skeleton/HeroShell.module.css"),
  },
  {
    name: "bottom-align-empty-composer",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-conversation/BottomAlignEmptyComposer.module.css"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css"),
  },
  {
    name: "structural-macos-safe-areas",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-layout/DesktopSafeAreas.module.css"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-layout/src/client/AppFrame.module.css"),
  },
  {
    name: "center-sidebar-wordmark",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-sidebar/BrandWordmark.module.css"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-sidebar/src/client/SidebarRoot.module.css"),
  },
]
const textOverrides = [
  { name: 'search-drive-title', sourcePath: resolve(appRoot, 'upstream-overrides/ui-workspace/search-drive-title.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-workspace/src/client/rows/Rows.tsx'), needle: '<span className={css.searchResultTitle}>{result.title}</span>', indent: '', markerKind: 'raw' },
  { name: 'session-drive-title', sourcePath: resolve(appRoot, 'upstream-overrides/ui-workspace/session-drive-title.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-workspace/src/client/rows/Rows.tsx'), needle: '<span className={css.title}>{title}</span>', indent: '', markerKind: 'raw' },
  { name: 'session-drive-loader', sourcePath: resolve(appRoot, 'upstream-overrides/ui-workspace/SessionDrive.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-workspace/src/client/rows/Rows.tsx'), needle: '      <StateDot state={statuses[0].state} />', indent: '', markerKind: 'raw' },
  { name: 'process-en', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/process-en.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/locale.ts'), needle: "  'view.chat': 'Chat',", indent: '', markerKind: 'raw' },
  { name: 'process-zh', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/process-zh.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/locale.ts'), needle: "  'view.chat': '\u5bf9\u8bdd',", indent: '', markerKind: 'raw' },
  { name: 'progressive-status-wait', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/status-wait.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.tsx'), needle: "{running && <TurnStatus startTime={runningTurnStart} t={t} />}", indent: '', markerKind: 'raw' },
  { name: 'progressive-list-props', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/list-props.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.tsx'), needle: "          <ChatNodeList\n            order={order}", indent: '', markerKind: 'raw' },
  { name: 'progressive-pending-state', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/pending-state.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.tsx'), needle: "  const order = useChat(s => s.order)", indent: '', markerKind: 'raw' },
  { name: 'progressive-pending-hook', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/pending-hook.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.tsx'), needle: "  useTranscriptView, useProjection, t,", indent: '', markerKind: 'raw' },
  { name: 'progressive-list-route', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/list-route.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.tsx'), needle: "const ChatNodeList = memo(function ChatNodeList({ order, ...seatProps }: ChatNodeListProps) {\n  return order.map", indent: '', markerKind: 'raw' },
  { name: 'progressive-list-import', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/list-import.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatView.tsx'), needle: "import { ChatNodeSeat } from './ChatNodeSeat.tsx'", indent: '', markerKind: 'raw' },
  { name: 'progressive-seat-project', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/seat-project.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx'), needle: "  const routedNode = node as ChatNode | undefined", indent: '', markerKind: 'raw' },
  { name: 'progressive-seat-arg', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/seat-arg.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx'), needle: "  nodeKey, useChatNode, useChatNodeProcess, historyIncomplete, compactTranscript,", indent: '', markerKind: 'raw' },
  { name: 'progressive-seat-prop', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/seat-prop.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx'), needle: "  readonly nodeKey: string", indent: '', markerKind: 'raw' },
  { name: 'progressive-seat-import', sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/seat-import.fragment'), targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx'), needle: "import css from './ChatView.module.css'", indent: '', markerKind: 'raw' },
  {
    name: 'thinking-status-en',
    sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/ThinkingStatus.en.fragment'),
    targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/locale.ts'),
    needle: "  'chat.deepDiving': 'Deep diving...',",
    indent: '  ', markerKind: 'code',
  },
  {
    name: 'thinking-status-zh',
    sourcePath: resolve(appRoot, 'upstream-overrides/ui-chat/ThinkingStatus.zh.fragment'),
    targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/locale.ts'),
    needle: "  'chat.deepDiving': '深度求索中...',",
    indent: '  ', markerKind: 'code',
  },
  {
    name: 'scoped-rpc-webserver',
    sourcePath: resolve(appRoot, 'upstream-overrides/dsh-015/scoped-rpc-webserver.fragment'),
    targetPath: resolve(upstreamRoot, 'packages/client/connection/src/rpc-host.ts'),
    needle: '      () => owner.webServer.register(route),',
    indent: '      ', markerKind: 'code',
  },
  {
    name: 'official-preview-native-bridge',
    sourcePath: resolve(appRoot, 'upstream-overrides/dsh-015/official-preview-native-bridge.fragment'),
    targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/src/client/apply.ts'),
    needle: 'export function apply(ctx: Context): void {\n',
    indent: '  ', markerKind: 'code', preserveNeedle: true,
  },
  {
    name: "external-client-workspace-manifest",
    sourcePath: resolve(appRoot, "upstream-overrides/build/ExternalWorkspaceManifest.ts.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/tsdown.client.ts"),
    needle: "  if (cached !== undefined) return cached\n",
    indent: "  ",
    markerKind: "code",
    preserveNeedle: true,
  },
  {
    name: "document-root-portal-export",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-primitives/PortalExport.ts.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-primitives/src/index.ts"),
    needle: "export { Modal } from './Modal.tsx'\n",
    indent: "",
    markerKind: "code",
    preserveNeedle: true,
  },
  {
    name: "deepviewer-hero-leaves-composer",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-conversation/HeroWelcomeMoved.tsx.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx"),
    needle: "      {hero && <HeroShell t={t} renderSlot={renderSlot} />}",
    indent: "      ",
  },
  {
    name: "deepviewer-hero-scroll-seat",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-conversation/HeroWelcomeSeat.tsx.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx"),
    needle: "      <div className={css.scrollBody} data-conversation-scroll=\"\">\n",
    indent: "        ",
    preserveNeedle: true,
  },
  {
    name: "deepviewer-hero-headline-zh",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-conversation/HeroHeadline.zh.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-conversation/src/client/locales.ts"),
    needle: "  'hero.headline': '探索未至之境',",
    indent: "  ",
    markerKind: "code",
  },
  {
    name: "deepviewer-hero-headline-en",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-conversation/HeroHeadline.en.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-conversation/src/client/locales.ts"),
    needle: "  'hero.headline': 'Into the Unknown',",
    indent: "  ",
    markerKind: "code",
  },
  {
    name: "structural-main-safe-area",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-layout/CenterColumn.tsx.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-layout/src/client/AppFrame.tsx"),
    needle: "function CenterColumn(props: { children?: ReactNode }) {\n  return <div className={css.centerCol}>{props.children}</div>\n}",
    indent: "",
    markerKind: "code",
  },
  {
    name: "structural-sidebar-safe-area",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-layout/SidebarSafeArea.tsx.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-layout/src/client/AppFrame.tsx"),
    needle: "      <div className={css.sidebarCol}>\n",
    indent: "        ",
    preserveNeedle: true,
  },
  {
    name: "about-deepviewer-import",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/AboutSectionImport.ts.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/index.ts"),
    needle: "import { GeneralSection } from './GeneralSection.tsx'\n",
    indent: "",
    markerKind: "code",
    preserveNeedle: true,
  },
  {
    name: "about-deepviewer-registration",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/AboutSectionRegistration.ts.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/index.ts"),
    needle: "  }, GeneralSection))\n",
    indent: "  ",
    markerKind: "code",
    preserveNeedle: true,
  },
  {
    name: "settings-back-to-app-zh",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/BackToApp.zh.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/locales.ts"),
    needle: "  'close': '关闭',",
    indent: "  ",
    markerKind: "code",
  },
  {
    name: "settings-back-to-app-en",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/BackToApp.en.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/locales.ts"),
    needle: "  'close': 'Close',",
    indent: "  ",
    markerKind: "code",
  },
  {
    name: "about-deepviewer-locales-zh",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/AboutLocales.zh.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/locales.ts"),
    needle: "  'general.nav': '通用设置',\n",
    indent: "  ",
    markerKind: "code",
    preserveNeedle: true,
  },
  {
    name: "about-deepviewer-locales-en",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-general/AboutLocales.en.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-general/src/client/locales.ts"),
    needle: "  'general.nav': 'General',\n",
    indent: "  ",
    markerKind: "code",
    preserveNeedle: true,
  },
  {
    name: "models-section-title-zh",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-models/ModelsTitle.zh.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-models/src/client/locales.ts"),
    needle: "  title: '模型',",
    indent: "  ",
    markerKind: "code",
  },
  {
    name: "models-section-title-en",
    sourcePath: resolve(appRoot, "upstream-overrides/ui-settings-models/ModelsTitle.en.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-settings-models/src/client/locales.ts"),
    needle: "  title: 'Models',",
    indent: "  ",
    markerKind: "code",
  },
  {
    name: "browser-tab-lifetime",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/browser-tab-lifetime.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-dockkit/src/components/TabPanel.tsx"),
    needle: "{active === undefined\n          ? <p className={css.empty}>{callbacks.labels.emptyPane}</p>\n          : callbacks.renderTab(active)}",
    indent: "        ",
  },
  {
    name: "rightbar-safe-area",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/rightbar-safe-area.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-layout/src/client/AppFrame.tsx"),
    needle: "function RightbarColumn(props: { children?: ReactNode }) {\n  return <div className={css.rightbarCol} data-rightbar-col>{props.children}</div>\n}",
    indent: "",
    markerKind: "code",
  },
  {
    name: "sidebar-explicit-visibility",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/sidebar-explicit-visibility.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-layout/src/client/AppFrame.tsx"),
    needle: "  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE\n  const sidebarCollapsed = narrow ? !layoutInfo.narrowExpanded : layoutInfo.sidebar === 0",
    indent: "",
    markerKind: "code",
  },
  {
    name: "sidebar-column-import",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/sidebar-column-import.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-layout/src/client/AppFrame.tsx"),
    needle: "import { computeColumns, RIGHTBAR_DEFAULT_RATIO, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT } from './columns.ts'",
    indent: "",
    markerKind: "code",
  },
  {
    name: "native-tool-target",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/native-tool-target.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx"),
    needle: "                className={css.fileLink}",
    indent: "",
    markerKind: "raw",
  },
  {
    name: "native-deliverable-target",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/native-deliverable-target.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-deliverables/src/client/ProducedFiles.tsx"),
    needle: "              title={path}",
    indent: "",
    markerKind: "raw",
  },
  {
    name: "native-markdown-target",
    sourcePath: resolve(appRoot, "upstream-overrides/dsh-015/native-markdown-target.fragment"),
    targetPath: resolve(upstreamRoot, "packages/client/ui-primitives/src/markdown/render.tsx"),
    needle: "              title={mention.title}",
    indent: "",
    markerKind: "raw",
  },
]
const testContractReplacements = JSON.parse(readFileSync(resolve(appRoot, 'upstream-overrides/ui-chat/chat-view-contracts.json'), 'utf8')).map(entry => ({ ...entry, targetPath: resolve(upstreamRoot, 'packages/client/ui-chat/tests/chat-view.client.spec.tsx') }))
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
  const desiredStamp = `${sourceDigest}:${SUBSCRIPTIONS_UI_ADAPTER_ID}:${SUBSCRIPTIONS_DSH_PEER_VERSION}:${createHash("sha256").update(readFileSync(subscriptionsUiAdapterPath)).update(readFileSync(resolve(appRoot, "scripts/prepare-subscriptions-client.mjs"))).update(readFileSync(imageGenerateStylesPath)).digest("hex")}\n`
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
    const child = spawn(command, args, { stdio: 'inherit', ...options, env: { ...process.env, pnpm_config_verify_deps_before_run: 'warn', ...options.env } })
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

  if (markerKind === 'raw') {
    const current = readFileSync(targetPath, 'utf8')
    const desired = readFileSync(sourcePath, 'utf8').trimEnd()
    if (current.includes(desired)) return false
    if (current.split(needle).length !== 2) throw new Error(`DeepViewer override anchor mismatch: ${name}`)
    writeFileSync(targetPath, current.replace(needle, desired))
    return true
  }

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
  digest.update(readFileSync(fileURLToPath(import.meta.url)))
  digest.update(readFileSync(resolve(appRoot, 'scripts/prepare-subscriptions-client.mjs')))
  digest.update(readFileSync(resolve(appRoot, 'scripts/sync-desktop-network.mjs')))
  digest.update(readFileSync(resolve(appRoot, 'upstream-overrides/network/desktop-network.ts')))
  digest.update(readFileSync(resolve(appRoot, 'upstream-overrides/network/search-network-error.ts')))
  digest.update(readFileSync(imageGenerateStylesPath))
  digest.update(readFileSync(sourcePath))
  digest.update(readFileSync(subscriptionsUiAdapterPath))
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
  digest.update(readFileSync(chatModePatchPath))
  return digest.digest('hex')
}

async function main() {
  if (process.argv.includes('--build')) buildReasoningPlugin(upstreamRoot)
  stageSubscriptionsPlugin()
  stageBetterSidebar(upstreamRoot)
  const chatModeChanged = syncChatModeOverrides(upstreamRoot)
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
  const changed = chatModeChanged || wordmarkChanged || filesChanged || cssChanged || textChanged || testContractsChanged
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
  // The official profile also records artifact digests required by release:pack.
  await run('pnpm', ['run', 'build:official'], { cwd: upstreamRoot })
  prepareSubscriptionsClient(subscriptionsPluginTarget, upstreamRoot, subscriptionsPluginSource)
  await run('pnpm', ['exec', 'tsdown', '--config', resolve(subscriptionsPluginTarget, 'deepviewer-client.config.mjs')], {
    cwd: subscriptionsPluginTarget,
    env: { ...process.env, DSH_EXTERNAL_WORKSPACE_MANIFEST: resolve(subscriptionsPluginTarget, 'package.json') },
  })
  adaptSubscriptionsPlugin(subscriptionsPluginTarget)
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
