export const chatContracts = [
  { id: 'chat-history-projection-parameter', file: 'packages/api/session-controller/src/history.ts', before: '    withProjections: boolean,', after: '    _withProjections: boolean,', reason: 'History always observes the preset needed to authorize workspace-free Chat.' },
  { id: 'chat-create-cwd-match', file: 'packages/api/session-controller/src/agent.ts', before: 'if (agent.session.header.cwd !== cwd) {', after: "if (agent.session.header.cwd !== (presetId === 'deepviewer-chat' ? undefined : cwd)) {", reason: 'Workspace-free Chat creation must validate its absent cwd instead of the Host default directory.' },
  { id: 'chat-adopt-cwd-match', file: 'packages/api/session-controller/src/agent.ts', before: 'if (observation.header.cwd !== cwd) {', after: "if (observation.header.cwd !== (presetId === 'deepviewer-chat' ? undefined : cwd)) {", reason: 'Explicit-id Chat adoption cannot silently bind a workspace.' },
  { id: 'chat-resume-cwd-free', file: 'packages/api/session-controller/src/agent.ts', before: 'if (observation.header.id !== sessionId || observation.header.cwd === undefined) {', after: "if (observation.header.id !== sessionId || (observation.header.cwd === undefined && this.presetForObservation(observation) !== 'deepviewer-chat')) {", reason: 'A cold Chat Agent is valid without a workspace; unknown workspace-free sessions stay rejected.' },
  { id: 'chat-inspect-projections', file: 'packages/api/session-controller/src/agent.ts', before: "      projectionMode: 'none',", after: "      projectionMode: 'all',", reason: 'Inspect must prove a workspace-free session is Chat from its persisted native preset projection.' },
  { id: 'chat-inspect-cwd-free', file: 'packages/api/session-controller/src/agent.ts', before: 'if (observation.header.cwd === undefined) {', after: "if (observation.header.cwd === undefined && observation.projections?.values.agentPreset !== 'deepviewer-chat') {", reason: 'Read cold Chat attachments/history while preserving ordinary Session authorization.' },
  { id: 'chat-history-projections', file: 'packages/api/session-controller/src/history.ts', before: "projectionMode: withProjections || address.kind === 'subagent' ? 'all' : 'none',", after: "projectionMode: 'all',", reason: 'Cold history needs a native preset projection to authorize workspace-free Chat.' },
  { id: 'chat-history-cwd-free', file: 'packages/api/session-controller/src/history.ts', before: 'if (observation.header.cwd === undefined) {', after: "if (observation.header.cwd === undefined && observation.projections?.values.agentPreset !== 'deepviewer-chat') {", reason: 'History may read workspace-free Chat without opening a project Agent.' },
  {
    "id": "chat-commands.ts-0",
    "file": "packages/api/session-controller/src/commands.ts",
    "before": "import { randomUUID } from 'node:crypto'\nimport type { Context } from '@deepseek-ai/cordis'\nimport { brandString } from '@deepseek-ai/dsh-brand'\nimport type { Agent, ModelSelection as AgentModelSelection } from '@deepseek-ai/dsh-agent'\nimport { AttachmentError } from '@deepseek-ai/dsh-attachment'\nimport type {\n  AttachmentAdmissionPart, FileAttachmentRef, ImageAttachmentRef,\n} from '@deepseek-ai/dsh-attachment'\nimport type { FileUploadReceiptId } from '@deepseek-ai/dsh-client-file-upload/types'\nimport type {} from '@deepseek-ai/dsh-client-file-upload'\n",
    "after": "import { randomUUID } from 'node:crypto'\nimport type { Context } from '@deepseek-ai/cordis'\nimport { brandString } from '@deepseek-ai/dsh-brand'\nimport type { Agent, ModelSelection as AgentModelSelection } from '@deepseek-ai/dsh-agent'\nimport { AttachmentError } from '@deepseek-ai/dsh-attachment'\nimport { expandChatAttachments } from './chat-attachments.ts'\nimport type {\n  AttachmentAdmissionPart, FileAttachmentRef, ImageAttachmentRef,\n} from '@deepseek-ai/dsh-attachment'\nimport type { FileUploadReceiptId } from '@deepseek-ai/dsh-client-file-upload/types'\nimport type {} from '@deepseek-ai/dsh-client-file-upload'\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-commands.ts-1",
    "file": "packages/api/session-controller/src/commands.ts",
    "before": "   * @returns the Session identity and resolved preset when configured.\n   */\n  async create(request: SessionCreateRequest): Promise<SessionCreateValue> {\n    if (request.workspaceId !== undefined && request.cwd !== undefined) {\n      throw new RemoteError('gateway/bad-request', 'session.create accepts workspaceId or cwd, not both', {})\n    }\n    const sessionId = request.sessionId ?? brandString<SessionId>(`session-${randomUUID()}`)\n    let workspace: Workspace | undefined\n    if (request.workspaceId !== undefined) {\n      workspace = this.ctx.workspaceRegistry.get(request.workspaceId)\n",
    "after": "   * @returns the Session identity and resolved preset when configured.\n   */\n  async create(request: SessionCreateRequest): Promise<SessionCreateValue> {\n    if (request.workspaceId !== undefined && request.cwd !== undefined) {\n      throw new RemoteError('gateway/bad-request', 'session.create accepts workspaceId or cwd, not both', {})\n    }\n    if (request.agentPreset === 'deepviewer-chat' && (request.workspaceId !== undefined || request.cwd !== undefined)) {\n      throw new RemoteError('gateway/bad-request', 'Chat sessions do not accept a workspace or working directory', {})\n    }\n    const sessionId = request.sessionId ?? brandString<SessionId>(`session-${randomUUID()}`)\n    let workspace: Workspace | undefined\n    if (request.workspaceId !== undefined) {\n      workspace = this.ctx.workspaceRegistry.get(request.workspaceId)\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-commands.ts-2",
    "file": "packages/api/session-controller/src/commands.ts",
    "before": "        const admission = resolvePromptFileReceipts(\n          request.content,\n          receiptId => this.ctx.fileUploads.resolve(agent, receiptId),\n        )\n        const content = await this.ctx.attachments.admitPromptContent(admission.content)\n        const message: UserMessage = createUserMessage({ content, source })\n        if (this.ctx.agents.get(agent.id) !== agent) {\n          throw new RemoteError(\n            'session/not-found',\n            `session \"${agent.id}\" was disposed during prompt admission`,\n",
    "after": "        const admission = resolvePromptFileReceipts(\n          request.content,\n          receiptId => this.ctx.fileUploads.resolve(agent, receiptId),\n        )\n        const content = await this.ctx.attachments.admitPromptContent(admission.content)\n        if (this.agents.presetForSession(agent.session) === 'deepviewer-chat') {\n          await expandChatAttachments(this.ctx.attachments, content)\n        }\n        const message: UserMessage = createUserMessage({ content, source })\n        if (this.ctx.agents.get(agent.id) !== agent) {\n          throw new RemoteError(\n            'session/not-found',\n            `session \"${agent.id}\" was disposed during prompt admission`,\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-types.ts-0",
    "file": "packages/api/session-controller/src/types.ts",
    "before": "}\n\n/** Session search request. */\nexport interface SessionSearchRequest {\n  readonly query: string\n}\n\n/** Session search response value. */\nexport interface SessionSearchValue {\n  readonly items: readonly SessionSearchItem[]\n",
    "after": "}\n\n/** Session search request. */\nexport interface SessionSearchRequest {\n  readonly query: string\n  readonly mode?: 'chat' | 'work'\n}\n\n/** Session search response value. */\nexport interface SessionSearchValue {\n  readonly items: readonly SessionSearchItem[]\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-index.ts-0",
    "file": "packages/api/session-controller/src/index.ts",
    "before": "   * @param signal - cancellation for list and search reads.\n   * @returns authorized bounded Session search results.\n   */\n  @Remote('search')\n  search(request: SessionSearchRequest, signal: AbortSignal): Promise<SessionSearchValue> {\n    return this.listState.search(request.query, signal)\n  }\n\n  /**\n   * Create or idempotently adopt one ordinary Session.\n   * @param request - requested identity, location, and Agent preset.\n",
    "after": "   * @param signal - cancellation for list and search reads.\n   * @returns authorized bounded Session search results.\n   */\n  @Remote('search')\n  search(request: SessionSearchRequest, signal: AbortSignal): Promise<SessionSearchValue> {\n    return this.listState.search(request.query, signal, request.mode)\n  }\n\n  /**\n   * Create or idempotently adopt one ordinary Session.\n   * @param request - requested identity, location, and Agent preset.\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-list.ts-0",
    "file": "packages/api/session-controller/src/list.ts",
    "before": "   * Search current visible message content without activating any matching Session.\n   * @param query - literal message-content query.\n   * @param signal - cancellation for list and search reads.\n   * @returns authorized bounded Session search results.\n   */\n  async search(query: string, signal: AbortSignal): Promise<SessionSearchValue> {\n    const normalizedQuery = normalizeSearchQuery(query)\n    signal.throwIfAborted()\n    const provider = this.ctx.get('sessionQuery')\n    if (provider === undefined) {\n      throw new RemoteError(\n",
    "after": "   * Search current visible message content without activating any matching Session.\n   * @param query - literal message-content query.\n   * @param signal - cancellation for list and search reads.\n   * @returns authorized bounded Session search results.\n   */\n  async search(query: string, signal: AbortSignal, mode?: 'chat' | 'work'): Promise<SessionSearchValue> {\n    const normalizedQuery = normalizeSearchQuery(query)\n    signal.throwIfAborted()\n    const provider = this.ctx.get('sessionQuery')\n    if (provider === undefined) {\n      throw new RemoteError(\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-list.ts-1",
    "file": "packages/api/session-controller/src/list.ts",
    "before": "    }\n    try {\n      const visible = await provider.listSessions(signal)\n      signal.throwIfAborted()\n      const visibleIds = new Set(visible\n        .filter(record => record.header.cwd !== undefined)\n        .map(record => record.header.id))\n      if (visibleIds.size === 0) return { items: [], hasMore: false }\n      const authorized: SessionSearchItem[] = []\n      const acceptedIds = new Set<SessionId>()\n      const seenCursors = new Set<SessionSearchCursor>()\n",
    "after": "    }\n    try {\n      const visibleIds = mode === undefined\n        ? new Set((await provider.listSessions(signal)).filter(record => record.header.cwd !== undefined).map(record => record.header.id))\n        : new Set((await this.list(signal)).filter(summary => {\n          const preset = summary.projections?.values.agentPreset\n          return mode === 'chat' ? preset === 'deepviewer-chat' : summary.cwd !== undefined && preset !== 'deepviewer-chat'\n        }).map(summary => summary.sessionId))\n      signal.throwIfAborted()\n      if (visibleIds.size === 0) return { items: [], hasMore: false }\n      const authorized: SessionSearchItem[] = []\n      const acceptedIds = new Set<SessionId>()\n      const seenCursors = new Set<SessionSearchCursor>()\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-list.ts-2",
    "file": "packages/api/session-controller/src/list.ts",
    "before": "      if (record.header.cwd === undefined) continue\n      cold.push(record.header)",
    "after": "      cold.push(record.header)",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-list.ts-3",
    "file": "packages/api/session-controller/src/list.ts",
    "before": "    for (const header of cold) items.push(this.summarizeCold(header))",
    "after": "    for (const header of cold) {\n      const summary = await this.summarizeCold(header, signal)\n      // Work is workspace-bound; Chat remains visible while detached and cwd-free.\n      if (header.cwd !== undefined || summary.projections?.values.agentPreset === 'deepviewer-chat') items.push(summary)\n    }",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-list.ts-4",
    "file": "packages/api/session-controller/src/list.ts",
    "before": "  private summarizeCold(header: SessionHeader): SessionSummary {\n    const projections = this.projectionsFor(header, undefined)",
    "after": "  private async summarizeCold(header: SessionHeader, signal?: AbortSignal): Promise<SessionSummary> {\n    const projections = await this.coldProjections(header, signal)",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "chat-list.ts-5",
    "file": "packages/api/session-controller/src/list.ts",
    "before": "  private projectionsFor(\n",
    "after": "  /** Recover list classification and titles after cache loss without activating an Agent. */\n  private async coldProjections(header: SessionHeader, signal?: AbortSignal): Promise<SessionProjectionHints | undefined> {\n    signal?.throwIfAborted()\n    const cached = this.projectionsFor(header, undefined)\n    if (cached?.values.agentPreset !== undefined && cached.values.sessionListMetadata !== undefined) return cached\n    try {\n      const handle = await this.ctx.sessionPersistence.open(header.id, 'read', signal === undefined ? undefined : { signal })\n      try {\n        const { events } = await handle.read(0, Number.MAX_SAFE_INTEGER, signal === undefined ? undefined : { signal })\n        signal?.throwIfAborted()\n        const cache = this.ctx.get('sessionProjectionCache')\n        const snapshot = cache !== undefined\n          ? cache.coldSnapshot(handle.header, handle.inheritedEventCount, events)\n          : this.ctx.sessionProjections.restore({}, events, SessionLogOffset(0), handle.header, handle.inheritedEventCount).snapshot\n        return { kind: 'cached', asOfSeq: snapshot.asOfSeq, values: snapshot.values as SessionProjectionValues }\n      } finally { await handle.close() }\n    } catch (error) {\n      signal?.throwIfAborted()\n      this.ctx.logger.warn(`api-session.list: could not rebuild metadata for \"${header.id}\": ${String(error)}`)\n      return cached\n    }\n  }\n\n  private projectionsFor(\n",
    "reason": "Preserve workspace-free Chat and cold mode-filtered history at the Session API boundary."
  },
  {
    "id": "deepviewer-mode-11",
    "file": "packages/api/session-controller/src/list.ts",
    "before": "import type { Session, SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'",
    "after": "import { SessionLogOffset, type Session, type SessionEvent, type SessionHeader, type SessionId } from '@deepseek-ai/dsh-session'",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-12",
    "file": "packages/api/session-controller/src/agent.ts",
    "before": "    try {\n      await mkdir(cwd, { recursive: true })",
    "after": "    try {\n      if (presetId !== 'deepviewer-chat') await mkdir(cwd, { recursive: true })",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-13",
    "file": "packages/api/session-controller/src/agent.ts",
    "before": "      meta: {\n        cwd,",
    "after": "      meta: {\n        ...(presetId === 'deepviewer-chat' ? {} : { cwd }),",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-14",
    "file": "packages/api/session-controller/src/client/contract/sessions.ts",
    "before": "  create(opts?: {\n    workspaceId?: WorkspaceId",
    "after": "  create(opts?: {\n    agentPreset?: string\n    workspaceId?: WorkspaceId",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-15",
    "file": "packages/api/session-controller/src/client/sessions/service.ts",
    "before": "async create(opts: { workspaceId?: WorkspaceId; cwd?: string; sessionId?: SessionId }",
    "after": "async create(opts: { workspaceId?: WorkspaceId; cwd?: string; sessionId?: SessionId; agentPreset?: string }",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-16",
    "file": "packages/api/session-controller/src/client/sessions/manager.ts",
    "before": "    opts: {\n      workspaceId?: WorkspaceId",
    "after": "    opts: {\n      agentPreset?: string\n      workspaceId?: WorkspaceId",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-17",
    "file": "packages/api/session-controller/src/client/sessions/manager.ts",
    "before": "const shared = opts.sessionId === undefined ? {} : { sessionId: opts.sessionId }",
    "after": "const shared = { ...(opts.sessionId === undefined ? {} : { sessionId: opts.sessionId }), ...(opts.agentPreset === undefined ? {} : { agentPreset: opts.agentPreset }) }",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-18",
    "file": "packages/api/session-controller/src/client/contract/sessions.ts",
    "before": "    query: string,\n    signal: AbortSignal,",
    "after": "    query: string,\n    signal: AbortSignal,\n    mode?: 'chat' | 'work',",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-19",
    "file": "packages/api/session-controller/src/client/sessions/service.ts",
    "before": "    query: string,\n    signal: AbortSignal,",
    "after": "    query: string,\n    signal: AbortSignal,\n    mode?: 'chat' | 'work',",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-20",
    "file": "packages/api/session-controller/src/client/sessions/manager.ts",
    "before": "    query: string,\n    signal: AbortSignal,",
    "after": "    query: string,\n    signal: AbortSignal,\n    mode?: 'chat' | 'work',",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-21",
    "file": "packages/api/session-controller/src/client/sessions/service.ts",
    "before": "return this.manager.search(query, signal)",
    "after": "return this.manager.search(query, signal, mode)",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-22",
    "file": "packages/api/session-controller/src/client/sessions/manager.ts",
    "before": "this.remote.session.search({ query }, signal)",
    "after": "this.remote.session.search({ query, ...(mode === undefined ? {} : { mode }) }, signal)",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-23",
    "file": "packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx",
    "before": "  const inputState = useInput(s => s)",
    "after": "  const isChat = useSessions(s => sessionId !== undefined && s.byId[sessionId]?.projectionValues?.agentPreset === 'deepviewer-chat')\n  const inputState = useInput(s => s)",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-24",
    "file": "packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx",
    "before": "  const heroWorkspaceRow = (",
    "after": "  const heroWorkspaceRow = isChat ? null : (",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-25",
    "file": "packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx",
    "before": "const inert = sessionId === undefined || (hero && chipTitle === undefined)",
    "after": "const inert = sessionId === undefined || (!isChat && hero && chipTitle === undefined)",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-26",
    "file": "packages/client/ui-sidebar/src/client/contract/slots.ts",
    "before": "    'sidebar.brand.name': { kind: 'single'; scope: 'root'; owner: SidebarBrandNameOwnerProps }",
    "after": "    'sidebar.brand.name': { kind: 'single'; scope: 'root'; owner: SidebarBrandNameOwnerProps }\n    'sidebar.mode': { kind: 'single'; scope: 'root'; owner: SidebarSectionOwnerProps }",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-27",
    "file": "packages/client/ui-sidebar/src/client/contract/slots.ts",
    "before": "    | 'sidebar.brand.name'",
    "after": "    | 'sidebar.brand.name'\n    | 'sidebar.mode'",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-28",
    "file": "packages/client/ui-sidebar/src/client/index.ts",
    "before": "      'sidebar.brand.name': { kind: 'single', scope: 'root' },",
    "after": "      'sidebar.brand.name': { kind: 'single', scope: 'root' },\n      'sidebar.mode': { kind: 'single', scope: 'root' },",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-29",
    "file": "packages/client/ui-sidebar/src/client/SidebarRoot.tsx",
    "before": "      {/* The label fades before the hover/focus shortcut, including on translucent backgrounds. */}",
    "after": "      {renderSlot('sidebar.mode', { wide, expandSidebar: () => { if (collapsed) toggleSidebar() } })}\n      {/* The label fades before the hover/focus shortcut, including on translucent backgrounds. */}",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-30",
    "file": "packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx",
    "before": "  const list = useSessions(state => state)",
    "after": "  const allSessions = useSessions(state => state)\n  const isChat = Object.values(allSessions.byId).some(row => (row.retainedBy.mainView ?? 0) > 0 && row.projectionValues?.agentPreset === 'deepviewer-chat')\n  const list = useMemo(() => ({ ...allSessions, ids: allSessions.ids.filter(id => (allSessions.byId[id]?.projectionValues?.agentPreset === 'deepviewer-chat') === isChat) }), [allSessions, isChat])",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-31",
    "file": "packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx",
    "before": "  const groupBy = useStore(s => s.groupBy)",
    "after": "  const storedGroupBy = useStore(s => s.groupBy)\n  const groupBy = isChat ? 'flat' : storedGroupBy",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  },
  {
    "id": "deepviewer-mode-32",
    "file": "packages/client/ui-workspace/src/client/navigation.ts",
    "before": "  startSession(workspaceId?: WorkspaceId): void {\n    const workspace",
    "after": "  startSession(workspaceId?: WorkspaceId): void {\n    const currentId = this.mainReference?.sessionId\n    if (workspaceId === undefined && currentId !== undefined && this.sessions.list.getSnapshot().byId[currentId]?.projectionValues?.agentPreset === 'deepviewer-chat') {\n      void this.sessions.create({ agentPreset: 'deepviewer-chat' }).then(id => this.openSession(id)).catch((error: unknown) => console.warn('Chat creation failed:', error))\n      return\n    }\n    const workspace",
    "reason": "DeepViewer mode policy uses native controllers and stores."
  }
,
{"id": "chat-host-source", "file": "packages/api/session-controller/tsconfig.host.json", "before": "    \"src/remote-events.ts\",\n    \"src/agent.ts\",\n    \"src/assistant-stream.ts\",\n    \"src/catalog.ts\",\n    \"src/commands.ts\",\n    \"src/control.ts\",\n    \"src/file-references.ts\",\n    \"src/history.ts\",\n    \"src/list.ts\",\n    \"src/media-references.ts\",\n", "after": "    \"src/remote-events.ts\",\n    \"src/agent.ts\",\n    \"src/assistant-stream.ts\",\n    \"src/catalog.ts\",\n    \"src/commands.ts\",\n    \"src/chat-attachments.ts\",\n    \"src/control.ts\",\n    \"src/file-references.ts\",\n    \"src/history.ts\",\n    \"src/list.ts\",\n    \"src/media-references.ts\",\n", "reason": "Compile the bounded Chat attachment expansion in the host face."}
,
{"id": "chat-search-filter", "file": "packages/client/ui-workspace/src/client/index.ts", "before": "sessions.search(query, signal)", "after": "sessions.search(query, signal, Object.values(sessions.list.getSnapshot().byId).some(row => (row.retainedBy.mainView ?? 0) > 0 && row.projectionValues?.agentPreset === 'deepviewer-chat') ? 'chat' : 'work')", "reason": "Apply the active product mode before native search pagination."}
]
