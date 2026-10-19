import { presentationContracts } from '../presentation/contracts.mjs'
import { toneContracts } from './tone-contracts.mjs'
import { chatContracts } from './chat-contracts.mjs'
import { brandingContracts } from './branding-contracts.mjs'
import { nativeModuleContracts } from './native-module-contracts.mjs'
/** Narrow extension gaps in the pinned upstream. Remove a contract when its seam is upstreamed. */
export const contracts = [
  {"id": "deepviewer-preview-update-feed", "file": "apps/desktop/src/update-coordinator.ts", "before": "    this.updater.channel = channel", "after": "    this.updater.channel = channel === 'nightly' && process.env.DEEPVIEWER_UPDATE_CHANNEL === 'preview' ? 'preview' : channel", "reason": "Keep the existing DeepViewer preview feed filename while native latest/nightly enforces prerelease policy."},
  {
    id: 'client-artifact-metadata-only-rebuild', file: 'packages/client/modules/src/index.ts',
    before: '    const bundle = readFileSync(record.meta.clientPath)\n    record.baseline = baseline\n    record.entry = graphRow(id, rev, record.meta)',
    after: '    const bundle = readFileSync(record.meta.clientPath)\n    // File providers may change ctime while synchronizing unchanged artifacts.\n    // Keep mtime stamps authoritative: they also announce sibling chunk builds.\n    if (baseline.mtimeMs === record.baseline.mtimeMs && baseline.size === record.baseline.size && bundle.equals(record.bundle)) {\n      record.baseline = baseline\n      return record.entry.rev\n    }\n    record.baseline = baseline\n    record.entry = graphRow(id, rev, record.meta)',
    reason: 'Metadata-only file-provider changes must not tear down the live renderer; content edits and stamped chunk builds still publish.',
  },
  { id: 'dedicated-rpc-explicit-owner-type', file: 'packages/client/connection/src/rpc.ts', before: '    channel: string,\n    handler: ConnectionRpcHandler,\n  ): () => Promise<void>', after: '    channel: string,\n    handler: ConnectionRpcHandler,\n    owner?: import("@deepseek-ai/cordis").Context,\n  ): () => Promise<void>', reason: 'Cordis 4 service getter shadows otherwise bind dedicated routes to the service provider instead of the consumer lifetime.' },
  { id: 'dedicated-rpc-explicit-owner', file: 'packages/client/connection/src/rpc-host.ts', before: 'handle: (channel, handler) => this.register(owner, channel, handler),', after: 'handle: (channel, handler, consumer) => this.register(consumer ?? owner, channel, handler),', reason: 'Explicit caller ownership preserves plugin unload and injection boundaries for dedicated channels.' },
  ...chatContracts,
  ...toneContracts,
  ...brandingContracts,
  ...nativeModuleContracts,
  ...presentationContracts,
  { id: 'optional-official-onboarding', file: 'apps/desktop/src/main.ts', before: "import { WELCOME_IPC, needsWelcome, type WelcomeNotice } from './welcome-api.ts'", after: "import { WELCOME_IPC, needsWelcome as officialNeedsWelcome, type WelcomeNotice } from './welcome-api.ts'\nconst needsWelcome: typeof officialNeedsWelcome = authentication => process.env.DEEPVIEWER_DESKTOP !== '1' && officialNeedsWelcome(authentication)", reason: 'Optional official account onboarding is desktop product policy, never a client environment variable.' },
  {
    id: 'desktop-product-name', file: 'apps/desktop/src/main.ts',
    before: "applicationName: 'DeepSeek Harness',", after: 'applicationName: app.name,',
    reason: 'The native About panel must use the product identity supplied before boot.',
  },
  {
    id: 'hero-style-anchor', file: 'packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx',
    before: '<div className={css.root}>', after: '<div className={css.root} data-deepviewer-hero="">',
    reason: 'Stable styling anchor for the native hero; no replacement Conversation component.',
  },
  {
    id: 'hero-headline-style-anchor', file: 'packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx',
    before: '<div className={css.headline}>', after: '<div className={css.headline} data-deepviewer-headline="">',
    reason: 'Style the native mark/headline vertically without matching generated CSS names.',
  },
  {
    id: 'hero-title-style-anchor', file: 'packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx',
    before: '<span className={css.titleGroup}>', after: '<span className={css.titleGroup} data-deepviewer-hero-title="">',
    reason: 'Restore released welcome typography and suppress the upstream product badge.',
  },
  {
    id: 'hero-independent-of-composer', file: 'packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx',
    before: '      {hero && <HeroShell t={t} renderSlot={renderSlot} />}\n      {hero && heroWorkspaceRow}',
    after: '      {hero && heroWorkspaceRow}',
    reason: 'Restore the released idle area above the bottom composer without remounting its native input or replacing its slots.',
  },
  {
    id: 'hero-scroll-body-seat', file: 'packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx',
    before: '      <div className={css.scrollBody} data-conversation-scroll="">\n        {sessionId === undefined ? null : <Views />}',
    after: '      <div className={css.scrollBody} data-conversation-scroll="">\n        {hero && <HeroShell t={t} renderSlot={renderSlot} />}\n        {sessionId === undefined ? null : <Views />}',
    reason: 'Let the idle mark and headline flex-center separately while the resident composer occupies the viewport floor.',
  },
  {
    "id": "stats-header-slot",
    "file": "packages/client/ui-chat/src/client/apply.ts",
    "before": "  ctx.slots.inject('conversation.composer.dock', function* () {\n    yield ctx.slots.register({\n      name: 'conversation.composer.dock', id: 'activity', order: 0, locale: NS, inject: statPillInject,\n    }, ActivityPill)\n    yield ctx.slots.register({\n      name: 'conversation.composer.dock', id: 'usage', order: 1, locale: NS, inject: statPillInject,\n    }, UsagePill)\n  })",
    "after": "  ctx.slots.inject('conversation.session.header.center', function* () {\n    yield ctx.slots.register({\n      name: 'conversation.session.header.center', id: 'activity', order: 0, locale: NS, inject: statPillInject,\n    }, ActivityPill)\n    yield ctx.slots.register({\n      name: 'conversation.session.header.center', id: 'usage', order: 1, locale: NS, inject: statPillInject,\n    }, UsagePill)\n  })",
    "reason": "Use the same native statistics component in the session header slot."
  },
  {"id": "deepviewer-copy-0", "file": "packages/client/ui-conversation/src/client/locales.ts", "before": "'hero.headline': '探索未至之境'", "after": "'hero.headline': '让我们做点什么'", "reason": "Product copy until native locale overrides are available."},
  {"id": "deepviewer-copy-1", "file": "packages/client/ui-conversation/src/client/locales.ts", "before": "'hero.headline': 'Into the Unknown'", "after": "'hero.headline': 'What shall we build?'", "reason": "Product copy until native locale overrides are available."},
  {"id": "deepviewer-copy-2", "file": "packages/client/ui-chat/src/client/locale.ts", "before": "'message.stepProcess.thinking': '正在分析请求'", "after": "'message.stepProcess.thinking': '深度求索中'", "reason": "Product copy until native locale overrides are available."},
  {"id": "deepviewer-copy-3", "file": "packages/client/ui-chat/src/client/locale.ts", "before": "'message.think': '思考'", "after": "'message.think': '深度求索中'", "reason": "Product copy until native locale overrides are available."},
  {"id": "deepviewer-thinking-en", "file": "packages/client/ui-chat/src/client/locale.ts", "before": "'message.stepProcess.thinking': 'Analyzing the request'", "after": "'message.stepProcess.thinking': 'Thinking'", "reason": "Use the DeepViewer thinking label."},
  {"id": "deepviewer-think-en", "file": "packages/client/ui-chat/src/client/locale.ts", "before": "'message.think': 'Think'", "after": "'message.think': 'Thinking'", "reason": "Use the DeepViewer thinking label."},

  {"id": "delivery-types", "file": "packages/deliverables/tool-present/src/index.ts", "before": "export const name = 'tool-present'", "after": "declare module '@deepseek-ai/cordis' {\n  interface Events {\n    'deliverables/prepare'(exec: ToolExecution, files: PresentedFile[], next: () => Promise<PresentedFile[]>): Promise<PresentedFile[]>\n  }\n}\nexport const name = 'tool-present'", "reason": "Keep the optional delivery-policy middleware on the Host face; browser-safe types never import Host services."},
  {"id": "delivery-source-alias", "file": "packages/deliverables/tool-present/src/types.ts", "before": "  description?: string\n}", "after": "  description?: string\n  /** Internal original source aliases, never native open targets. */\n  sourcePaths?: string[]\n}", "reason": "Optional producer aliases preserve generation provenance while only workspace path is openable."},
  {"id": "delivery-normalize", "file": "packages/deliverables/tool-present/src/index.ts", "before": "      for (const file of args.files) {", "after": "      const prepared = await ctx.waterfall('deliverables/prepare', exec, args.files, async () => args.files)\n      for (const file of prepared) {", "reason": "DeepViewer copies external generated outputs into the workspace before the native file checks/cards."},
  {"id": "warning-css", "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.module.css", "before": "  clip: rect(0 0 0 0);\n  white-space: nowrap;\n}", "after": "  clip: rect(0 0 0 0);\n  white-space: nowrap;\n}\n.errorSummary[data-tone=\"warning\"],\n.ioText[data-error][data-tone=\"warning\"] {\n  color: var(--dsw-alias-state-warn-primary);\n}", "reason": "File read guards are orange even while hovered."},
  {
    "id": "warning-memo",
    "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx",
    "before": "[summaryLinkKeyDown, linkHref, openFile, state, suffix, totals, summaryText, exitLabel]",
    "after": "[summaryLinkKeyDown, linkHref, openFile, state, errorTone, suffix, totals, summaryText, exitLabel]",
    "reason": "Recompute the summary when its protection tone changes."
  },
  {"id": "deepviewer-host-network-ready", "file": "apps/desktop/src/main.ts", "before": "hostEnvironment = await loginShell", "after": "hostEnvironment = { ...await loginShell, ...await (globalThis as typeof globalThis & { __DEEPVIEWER_HOST_ENVIRONMENT__?: Promise<NodeJS.ProcessEnv> }).__DEEPVIEWER_HOST_ENVIRONMENT__ }", "reason": "Await product PAC/private-network initialization before constructing the official Host."},
  {"id": "desktop-authorized-web-fetch-import", "file": "packages/web/web-fetch-http/src/provider.ts", "before": "import { WebError } from '@deepseek-ai/dsh-web'", "after": "import { WebError } from '@deepseek-ai/dsh-web'\nimport { requestDesktop } from './desktop-network.ts'", "reason": "The desktop owns bounded per-run local-network approval and address pinning."},
  {"id": "desktop-authorized-web-fetch", "file": "packages/web/web-fetch-http/src/provider.ts", "before": "      const route = proxyRouteFor(url)", "after": "      const desktop = await requestDesktop(url, signal, process.env.DEEPVIEWER_WEB_BRIDGE)\n      if (desktop) return desktop\n      const route = proxyRouteFor(url)", "reason": "Use the authorized desktop bridge when present; preserve standalone native transport otherwise."},
]
