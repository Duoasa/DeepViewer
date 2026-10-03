const app = document.querySelector('#app')
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
const UI_STATE_KEY = 'deepviewer:synapse:view:v1'
const savedBranchAnchors = []
const savedCardPositions = []
const savedCollapsedCards = []
let locale = 'zh-CN'
const copy = {
  map: ['地图', 'Map'], detail: ['详情', 'Details'], compare: ['对比', 'Compare'],
  arrange: ['整理', 'Arrange'], locate: ['定位', 'Locate'], zoomOut: ['缩小', 'Zoom out'], zoomIn: ['放大', 'Zoom in'],
  mapViews: ['会话地图视图', 'Map views'], arrangeHint: ['整理节点', 'Arrange cards'], locateHint: ['定位到当前会话', 'Locate current conversation'],
  sourceSession: ['DeepViewer 会话', 'DeepViewer conversation'], sourceBranch: ['DeepViewer 分支', 'DeepViewer branch'], followup: ['追问', 'Follow up'],
  addFollowup: ['添加追问', 'Add follow-up'], expandChildren: ['展开后续对话', 'Expand following turns'], collapseChildren: ['折叠后续对话', 'Collapse following turns'],
  branchNew: ['在新对话中分支', 'Branch into a new conversation'], dragCard: ['拖动卡片', 'Drag card'], drag: ['拖动', 'Drag'],
  viewConversation: ['查看完整会话', 'View conversation'], failed: ['失败', 'Failed'], tools: ['工具', 'Tools'], waiting: ['等待助手回复', 'Waiting for a reply'],
  replying: ['正在回复', 'Replying'], turnFailed: ['本轮失败', 'Turn failed'], openNative: ['在 DeepViewer 中打开', 'Open in DeepViewer'],
  hideConversation: ['从地图隐藏此会话', 'Hide conversation from map'], hide: ['隐藏', 'Hide'], close: ['关闭', 'Close'],
  emptyMap: ['当前会话还没有可展示的对话。', 'There are no turns to show yet.'], emptyMapHelp: ['使用下方输入框开始对话，发送后会自动显示在地图中。', 'Start a conversation in the composer below. New turns appear on the map.'],
  processFallback: ['工具调用记录', 'Tool call record'], you: ['你', 'You'], error: ['错误', 'Error'], record: ['记录', 'Record'], branch: ['分支', 'Branch'],
  branchAnswer: ['从此回答创建分支', 'Branch from this reply'], collapseProcess: ['收起过程记录', 'Collapse process records'], expandProcess: ['展开过程记录', 'Expand process records'],
  collapse: ['收起', 'Collapse'], expand: ['展开', 'Expand'], waitingResult: ['等待结果', 'Waiting for result'], done: ['完成', 'Done'], process: ['过程记录', 'Process records'],
  toolResult: ['工具结果', 'Tool result'], incomplete: ['本轮未完成', 'This turn is incomplete'], continueFollowup: ['继续追问', 'Continue conversation'],
  createBranch: ['创建分支', 'Create branch'], cardDetails: ['卡片详情', 'Card details'], closeCardDetails: ['关闭卡片详情', 'Close card details'],
  session: ['会话', 'Conversation'], openNativeHint: ['在原生对话中打开此会话', 'Open this conversation in the native view'], branchLatest: ['基于最新回答创建分支', 'Branch from the latest reply'],
  emptyDetail: ['等待这条会话的第一条消息。', 'Waiting for the first message.'], waitQuestion: ['等待用户提问', 'Waiting for a question'],
  selectionFollowup: ['基于所选内容创建追问', 'Follow up on the selected text'], selectionHint: ['基于所选内容追问', 'Ask about the selected text'],
  noSource: ['该节点没有关联的 DeepViewer 会话', 'This card has no linked DeepViewer conversation'], standalone: ['请从 DeepViewer 的会话地图中操作', 'Open the conversation map in DeepViewer'],
  timeout: ['DeepViewer 未在规定时间内响应', 'DeepViewer did not respond in time'], activeCollapsed: ['当前会话位于这个后续分支中，请先切换会话', 'Switch conversations before collapsing the active branch'],
  waitBranch: ['请等待这张卡片的最终回答后再创建分支', 'Wait for the final reply before creating a branch'],
  compareEmpty: ['选择两张卡片进行对比', 'Select two cards to compare'], compareHelp: ['在地图卡片下方点击“对比”，可以并排查看两个回答。', 'Choose Compare on two map cards to read their replies side by side.'],
  attachmentMessage: ['附件消息', 'Attachment message'],
  cardActions: ['继续或创建分支', 'Continue or create a branch'], continueSession: ['继续当前会话', 'Continue this conversation'],
  continueHint: ['切到此会话的最新位置，在下方输入框继续。', 'Switch to the latest turn in this conversation and use the composer below.'],
  branchFromReply: ['从此回答创建分支', 'Branch from this reply'], branchHint: ['保留到此回答的上下文，在新会话中继续。', 'Keep the context through this reply and continue in a new conversation.'],
  preparingDraft: ['正在准备输入框…', 'Preparing the composer…'], draftPrepared: ['已切到此会话，请在下方输入框继续。', 'This conversation is ready. Continue in the composer below.'],
  branchPrepared: ['新分支已准备，请在下方输入框开始。', 'The new branch is ready. Start in the composer below.'],
  compareSelected: ['已加入对比', 'Selected for comparison'], clearCompare: ['清除对比', 'Clear comparison'],
}
const t = (key, ...values) => {
  const value = copy[key]?.[locale === 'en-US' ? 1 : 0] ?? key
  return values.reduce((text, item, index) => text.replaceAll(`{${index}}`, String(item)), value)
}
const turnLabel = value => locale === 'en-US' ? `Turn ${value}` : `第 ${value} 轮`
const hideConfirm = title => locale === 'en-US'
  ? `Hide “${title}” and its branches from the map? The original DeepViewer conversations remain available.`
  : `从地图隐藏「${title}」及其分支？DeepViewer 原会话会保留，可继续查看。`
const CARD_WIDTH = 310
const CARD_HEIGHT = 276
const CARD_GAP_Y = 42
const CAMERA_INSET_X = 56
const CAMERA_INSET_Y = 56
// Cards outside the viewport (plus this world-space margin) are not mounted
// into the DOM; the margin pre-mounts cards just before they scroll into view
// so panning never flashes empty space.
const VIEWPORT_MARGIN = 1400
const state = {
  summaries: [], workspace: null, activeId: null, selectedCardId: null, mode: 'canvas', zoom: 1, currentDsh: null, compareCardIds: [],
  dshWorkspaces: [], selectedDshWorkspaceId: null,
  historyBySession: new Map(), historyRequests: new Map(), pendingRpc: new Map(), liveReplies: new Map(),
  error: '', workspaceLoad: 0, branchAnchors: new Map(savedBranchAnchors), cardPositions: new Map(savedCardPositions), collapsedCardIds: new Set(savedCollapsedCards),
  dragging: false, canvasGesture: false, canvasRefreshAfter: 0, canvasViewInitialized: false, canvasCamera: { x: 0, y: 0 },
  expandedMessageIds: new Set(),
  canvasCards: undefined, canvasCardsById: undefined, canvasGraph: undefined, mountedCardIds: new Set(), canvasNeedsCenter: false,
  detailScrollByThread: new Map(), detailThreadId: null, detailTargetCardId: null,
  inspectorCardId: null, inspectorOpening: false, inspectorScrollByCard: new Map(),
  actionMenuCardId: null, composePending: false, notice: '', pointerPressed: false, renderDeferred: false,
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
const formatTime = value => new Date(value).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const currentThread = () => state.workspace?.threads.find(thread => thread.id === state.activeId) ?? state.workspace?.threads[0] ?? null

function viewStateKey(sessionId = state.currentDsh?.id) {
  return typeof sessionId === 'string' ? `${UI_STATE_KEY}:${sessionId}` : null
}
function persistViewState(sessionId = state.currentDsh?.id, overrides = {}) {
  const key = viewStateKey(sessionId)
  if (key === null) return
  const detail = app.querySelector('.detail-scroll')
  if (detail instanceof HTMLElement && state.activeId !== null) state.detailScrollByThread.set(state.activeId, detail.scrollTop)
  const inspector = app.querySelector('.card-inspector-scroll')
  if (inspector instanceof HTMLElement && state.inspectorCardId !== null) state.inspectorScrollByCard.set(state.inspectorCardId, inspector.scrollTop)
  // Store geometry and identifiers only. Messages, titles and drafts stay in the native session store.
  const snapshot = { camera: state.canvasCamera, initialized: state.canvasViewInitialized, zoom: state.zoom,
    mode: state.mode, activeId: state.activeId, selectedCardId: state.selectedCardId, inspectorCardId: state.inspectorCardId,
    compareCardIds: state.compareCardIds, branchAnchors: [...state.branchAnchors], cardPositions: [...state.cardPositions],
    collapsedCardIds: [...state.collapsedCardIds], expandedMessageIds: [...state.expandedMessageIds],
    detailScroll: [...state.detailScrollByThread], inspectorScroll: [...state.inspectorScrollByCard], ...overrides }
  try { sessionStorage.setItem(key, JSON.stringify(snapshot)) } catch { /* Storage may be disabled. */ }
}
function restoreViewState(sessionId) {
  const key = viewStateKey(sessionId)
  let saved
  try { saved = key === null ? null : JSON.parse(sessionStorage.getItem(key) ?? 'null') } catch { saved = null }
  const validId = value => typeof value === 'string' && value.length <= 512
  const idList = values => Array.isArray(values) ? values.filter(validId).slice(0, 10000) : []
  const positionList = values => Array.isArray(values) ? values.filter(item => Array.isArray(item) && validId(item[0]) && Number.isFinite(item[1]?.x) && Number.isFinite(item[1]?.y)).slice(0, 10000) : []
  const scrollList = values => Array.isArray(values) ? values.filter(item => Array.isArray(item) && validId(item[0]) && Number.isFinite(item[1]) && item[1] >= 0).slice(0, 10000) : []
  state.mode = ['canvas', 'thread', 'compare'].includes(saved?.mode) ? saved.mode : 'canvas'
  state.zoom = Number.isFinite(saved?.zoom) ? Math.min(4, Math.max(.6, saved.zoom)) : 1
  state.canvasCamera = Number.isFinite(saved?.camera?.x) && Number.isFinite(saved?.camera?.y) ? saved.camera : { x: 0, y: 0 }
  state.canvasViewInitialized = saved?.initialized === true
  state.activeId = validId(saved?.activeId) ? saved.activeId : null
  state.selectedCardId = validId(saved?.selectedCardId) ? saved.selectedCardId : null
  state.inspectorCardId = validId(saved?.inspectorCardId) ? saved.inspectorCardId : null
  state.inspectorOpening = false
  state.detailTargetCardId = validId(saved?.detailTargetCardId) ? saved.detailTargetCardId : null
  state.compareCardIds = idList(saved?.compareCardIds).slice(0, 2)
  state.cardPositions = new Map(positionList(saved?.cardPositions))
  state.collapsedCardIds = new Set(idList(saved?.collapsedCardIds))
  state.expandedMessageIds = new Set(idList(saved?.expandedMessageIds))
  state.branchAnchors = new Map(Array.isArray(saved?.branchAnchors) ? saved.branchAnchors.filter(item => Array.isArray(item) && item.every(validId)).slice(0, 10000) : [])
  state.detailScrollByThread = new Map(scrollList(saved?.detailScroll))
  state.inspectorScrollByCard = new Map(scrollList(saved?.inspectorScroll))
  return saved !== null
}
function rememberBranchAnchor(sessionId, cardId) { state.branchAnchors.set(sessionId, cardId); persistViewState() }
function persistCardPositions() { persistViewState() }
function persistCollapsedCards() { persistViewState() }
window.addEventListener('pagehide', () => persistViewState())
app.addEventListener('scroll', () => persistViewState(), true)

function rememberCardPosition(cardId, position, aliases = []) {
  state.cardPositions.set(cardId, { x: Math.round(position.x), y: Math.round(position.y) })
  for (const alias of aliases) state.cardPositions.set(alias, { x: Math.round(position.x), y: Math.round(position.y) })
  persistCardPositions()
}

function resetCardPositions() { state.cardPositions.clear(); persistViewState() }

function resetCanvasCamera() {
  state.canvasViewInitialized = false
  state.canvasCamera = { x: 0, y: 0 }
}

async function api(path, options = {}) {
  return dshRpc('synapse:api', { path, method: options.method ?? 'GET', body: options.body });
}

function post(type, payload = {}) {
  if (window.parent !== window) window.parent.postMessage({ source: 'dsh-synapse', type, ...payload }, window.location.origin)
}

function dshRpc(type, payload = {}) {
  if (window.parent === window) return Promise.reject(new Error(t('standalone')))
  const requestId = crypto.randomUUID()
  post(type, { requestId, ...payload })
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      state.pendingRpc.delete(requestId)
      reject(new Error(t('timeout')))
    }, 20_000)
    state.pendingRpc.set(requestId, { resolve, reject, timer })
  })
}

function settleRpc(requestId, value, error) {
  const pending = state.pendingRpc.get(requestId)
  if (pending === undefined) return
  state.pendingRpc.delete(requestId)
  window.clearTimeout(pending.timer)
  if (error === undefined) pending.resolve(value)
  else pending.reject(error instanceof Error ? error : new Error(String(error)))
}

function setError(error = '') { state.error = error instanceof Error ? error.message : error; state.notice = ''; render() }

async function loadThreadHistory() {}

function canReplaceView() {
  return !state.pointerPressed && !state.dragging && !state.canvasGesture && Date.now() >= state.canvasRefreshAfter && !document.activeElement?.matches('textarea')
}

function deferCanvasRefresh(delay = 700) {
  state.canvasRefreshAfter = Math.max(state.canvasRefreshAfter, Date.now() + delay)
}

function currentDshWorkspace() {
  const id = state.currentDsh?.id
  return typeof id === 'string' ? state.dshWorkspaces.find(workspace => workspace.sessionIds.includes(id)) : undefined
}

function selectedDshWorkspace() {
  return state.dshWorkspaces.find(workspace => workspace.id === state.selectedDshWorkspaceId)
}

function currentDshThread(threads = state.workspace?.threads ?? []) {
  const id = state.currentDsh?.id
  return typeof id === 'string' ? threads.find(thread => thread.dshSessionId === id) : undefined
}

async function threadsForDshWorkspace(workspace) {
  if (workspace.sessionIds.length === 0) return []
  const requested = new Set(workspace.sessionIds)
  const projections = await Promise.all(state.summaries.map(summary => api(`/synapse/api/workspaces/${summary.id}`)))
  return projections.flatMap(projection => projection.workspace.threads.filter(thread => requested.has(thread.dshSessionId)))
}

async function openDshWorkspace(id, { renderAfter = true, preserveCanvasCamera = false } = {}) {
  const workspace = state.dshWorkspaces.find(item => item.id === id)
  if (workspace === undefined) return false
  const load = ++state.workspaceLoad
  state.selectedDshWorkspaceId = id
  const threads = await threadsForDshWorkspace(workspace)
  if (load !== state.workspaceLoad) return true
  const nextWorkspaceId = `dsh:${workspace.id}`
  if (state.workspace?.id !== nextWorkspaceId && !preserveCanvasCamera && !state.canvasViewInitialized) resetCanvasCamera()
  state.workspace = { id: nextWorkspaceId, title: workspace.title, cwd: workspace.path, threads }
  const currentThread = currentDshThread(state.workspace.threads)
  state.activeId = state.workspace.threads.some(thread => thread.id === state.activeId) ? state.activeId : currentThread?.id ?? state.workspace.threads[0]?.id ?? null
  if (currentThread !== undefined) revealConversationThread(conversationCards(state.workspace.threads), currentThread.id)
  if (renderAfter && canReplaceView()) render()
  await Promise.all(state.workspace.threads.map(thread => loadThreadHistory(thread, false)))
  if (renderAfter && load === state.workspaceLoad && canReplaceView()) render()
  return true
}

async function openCurrentWorkspace({ preserveCanvasCamera = false } = {}) {
  const workspace = currentDshWorkspace()
  if (workspace === undefined || workspace.id === state.selectedDshWorkspaceId) return false
  return openDshWorkspace(workspace.id, { preserveCanvasCamera })
}

async function refreshSummaries({ renderAfter = true } = {}) {
  const before = JSON.stringify(state.summaries)
  const body = await api('/synapse/api/workspaces')
  state.summaries = body.workspaces
  const changed = before !== JSON.stringify(state.summaries)
  const current = state.workspace?.id
  if (state.selectedDshWorkspaceId === null && current !== null && !state.summaries.some(item => item.id === current)) state.workspace = null
  const selected = selectedDshWorkspace()
  if (selected !== undefined && (changed || state.workspace === null)) await openDshWorkspace(selected.id, { renderAfter })
  else if (state.workspace === null && state.currentDsh !== null) {
    const summary = state.summaries.find(item => Array.isArray(item.sessionIds) && item.sessionIds.includes(state.currentDsh.id))
    if (summary !== undefined) await openWorkspace(summary.id)
  }
  else if (renderAfter && changed && canReplaceView()) render()
  return changed
}

async function openWorkspace(id, { renderAfter = true } = {}) {
  const load = ++state.workspaceLoad
  const body = await api(`/synapse/api/workspaces/${id}`)
  if (load !== state.workspaceLoad) return
  if (state.workspace?.id !== body.workspace.id && !state.canvasViewInitialized) resetCanvasCamera()
  state.workspace = body.workspace
  state.activeId = state.workspace.threads.some(thread => thread.id === state.activeId) ? state.activeId : state.workspace.threads[0]?.id ?? null
  if (renderAfter && canReplaceView()) render()
  await Promise.all(state.workspace.threads.map(thread => loadThreadHistory(thread, false)))
  if (renderAfter && load === state.workspaceLoad && canReplaceView()) render()
}

let projectionRequest = null
let projectionDirty = false
function refreshProjection({ force = false } = {}) {
  // Native turn events can precede a summary revision. Keep the detail refresh
  // pending through pointer/drag gestures, and coalesce streaming notifications.
  projectionDirty ||= force
  if (projectionRequest !== null) return projectionRequest
  projectionRequest = (async () => {
    const summariesChanged = await refreshSummaries({ renderAfter: false })
    projectionDirty ||= summariesChanged
    if (!projectionDirty || state.workspace === null || !canReplaceView()) return summariesChanged
    projectionDirty = false
    if (state.selectedDshWorkspaceId !== null) await openDshWorkspace(state.selectedDshWorkspaceId)
    else await openWorkspace(state.workspace.id)
    projectionDirty ||= !canReplaceView() || [...state.liveReplies].some(([sessionId, live]) => {
      if (!Number.isSafeInteger(live.userSeq)) return false
      const thread = state.workspace?.threads.find(item => item.dshSessionId === sessionId)
      return thread === undefined || !persistedMessagesFor(thread).some(message => message.kind === 'user' && message.sourceSeq === live.userSeq)
    })
    return true
  })().catch(error => { projectionDirty = true; throw error }).finally(() => { projectionRequest = null })
  return projectionRequest
}

async function archiveThread(thread) {
  if (!window.confirm(hideConfirm(thread.title))) return
  await api(`/synapse/api/threads/${thread.id}`, { method: 'DELETE' })
  state.historyBySession.delete(thread.dshSessionId)
  state.detailScrollByThread.delete(thread.id)
  state.detailTargetCardId = state.detailThreadId === thread.id ? null : state.detailTargetCardId
  if (state.workspace !== null) {
    const removed = new Set([thread.id])
    for (let changed = true; changed;) {
      changed = false
      for (const item of state.workspace.threads) {
        if (item.parentId !== null && removed.has(item.parentId) && !removed.has(item.id)) {
          removed.add(item.id)
          changed = true
        }
      }
    }
    state.workspace.threads = state.workspace.threads.filter(item => !removed.has(item.id))
    for (const key of [...state.cardPositions.keys()]) {
      if ([...removed].some(id => key.startsWith(`${id}:`))) state.cardPositions.delete(key)
    }
    let collapsedChanged = false
    for (const key of [...state.collapsedCardIds]) {
      if ([...removed].some(id => key.startsWith(`${id}:`))) {
        state.collapsedCardIds.delete(key)
        collapsedChanged = true
      }
    }
    if (collapsedChanged) persistCollapsedCards()
    state.activeId = state.activeId !== null && state.workspace.threads.some(item => item.id === state.activeId)
      ? state.activeId
      : state.workspace.threads[0]?.id ?? null
    render()
  } else {
    state.activeId = null
  }
  await refreshSummaries()
}

async function composeNative(parent, { text, atSeq, fork = false, anchorId } = {}) {
  if (state.composePending) return
  if (typeof parent.dshSessionId !== 'string') throw new Error(t('noSource'))
  state.composePending = true
  state.error = ''
  state.notice = ''
  updateComposeControls()
  persistViewState()
  try {
    const result = await dshRpc('synapse:compose', { sessionId: parent.dshSessionId, text, atSeq, fork, anchorId })
    if (fork && typeof result?.id === 'string') {
      if (anchorId !== undefined) rememberBranchAnchor(result.id, anchorId)
      persistViewState(result.id)
    }
    closeCardActionMenu()
    state.notice = t(fork ? 'branchPrepared' : 'draftPrepared')
    updateComposeNotice()
  } finally {
    state.composePending = false
    updateComposeControls()
  }
}
function openContinue(parent, anchorId = undefined, text = undefined) { return composeNative(parent, { text, anchorId }) }
function openBranch(parent, atSeq = undefined, anchorId = undefined) { return composeNative(parent, { atSeq, fork: true, anchorId }) }

function threadsById() { return new Map((state.workspace?.threads ?? []).map(thread => [thread.id, thread])) }
function persistedMessagesFor(thread) { return state.historyBySession.get(thread.dshSessionId) ?? thread.messages ?? [] }

function messagesFor(thread) {
  // Host projection owns source filtering. A user may intentionally quote internal-looking text.
  const messages = persistedMessagesFor(thread)
  const live = state.liveReplies.get(thread.dshSessionId)
  if (live?.running !== true || !Number.isSafeInteger(live.userSeq) || !messages.some(message => message.kind === 'user' && message.sourceSeq === live.userSeq)) return messages
  const index = messages.findIndex(message => message.kind === 'user' && message.sourceSeq === live.userSeq)
  const next = messages.findIndex((message, offset) => offset > index && message.kind === 'user')
  const end = next === -1 ? messages.length : next
  return [...messages.slice(0, end), { kind: 'assistant', text: live.text, pending: true, at: new Date().toISOString() }, ...messages.slice(end)]
}

function latestMessage(thread, kind) { return [...messagesFor(thread)].reverse().find(message => message.kind === kind) }
function messageText(message) {
  return message?.kind === 'user' && message.deepviewerAttachmentOnly === true ? t('attachmentMessage') : message?.text ?? ''
}
function questionFor(thread) {
  const question = latestMessage(thread, 'user')
  return question === undefined ? thread.dshSessionTitle ?? t('waitQuestion') : messageText(question)
}
function answerFor(thread) { return latestMessage(thread, 'assistant') ?? null }

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
}

const tableCells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())

const isTableDelimiter = line => {
  const cells = tableCells(line)
  return cells.length > 0 && cells.every(cell => /^:?-+:?$/.test(cell))
}

function markdownBlock(text) {
  const lines = text.split('\n')
  const output = []
  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    if (line.trim() === '') { index++; continue }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading !== null) {
      const level = heading[1].length
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      index++
      continue
    }
    const unordered = /^[-*+]\s+(.+)$/.exec(line)
    const ordered = /^\d+[.)]\s+(.+)$/.exec(line)
    if (unordered !== null || ordered !== null) {
      const matcher = unordered === null ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/
      const items = []
      while (index < lines.length) {
        const item = matcher.exec(lines[index])
        if (item === null) break
        items.push(`<li>${inlineMarkdown(item[1])}</li>`)
        index++
      }
      output.push(`<${unordered === null ? 'ol' : 'ul'}>${items.join('')}</${unordered === null ? 'ol' : 'ul'}>`)
      continue
    }
    // GFM table: a leading-pipe header row followed by a |-delimiter row,
    // then any number of leading-pipe body rows.
    if (/^\s*\|/.test(line) && index + 1 < lines.length && isTableDelimiter(lines[index + 1])) {
      const header = line
      const body = []
      index += 2
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        body.push(lines[index])
        index++
      }
      output.push(`<table><thead><tr>${tableCells(header).map(cell => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${tableCells(row).map(cell => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    const paragraph = []
    while (index < lines.length && lines[index].trim() !== '' && !/^(#{1,3})\s+/.test(lines[index]) && !/^[-*+]\s+/.test(lines[index]) && !/^\d+[.)]\s+/.test(lines[index])) paragraph.push(lines[index++])
    // A marker-only line such as PowerShell's "+ " diagnostic is neither a
    // list item nor paragraph content under the rules above. Consume it so
    // the parser always makes progress.
    if (paragraph.length === 0) paragraph.push(lines[index++])
    output.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`)
  }
  return output.join('')
}

// Markdown parsing is pure CPU and repeats for every card on every canvas
// rebuild; cache the rendered HTML by input text so stable answers are never
// re-parsed. Bounded: streaming partial texts churn keys, so evict oldest.
const markdownCache = new Map()
const MARKDOWN_CACHE_LIMIT = 5000
function renderMarkdown(text) {
  const key = String(text)
  const cached = markdownCache.get(key)
  if (cached !== undefined) return cached
  const parts = key.split(/```/)
  const rendered = parts.map((part, index) => index % 2 === 1
    ? `<pre><code>${escapeHtml(part.replace(/^\w*\n/, ''))}</code></pre>`
    : markdownBlock(part)).join('')
  if (markdownCache.size >= MARKDOWN_CACHE_LIMIT) markdownCache.delete(markdownCache.keys().next().value)
  markdownCache.set(key, rendered)
  return rendered
}

function overlapsCard(position, other) {
  return position.x < other.x + CARD_WIDTH && position.x + CARD_WIDTH > other.x
    && position.y < other.y + CARD_HEIGHT && position.y + CARD_HEIGHT > other.y
}

function firstAvailableCardPosition(position, occupied) {
  const candidate = { x: Math.round(position.x), y: Math.max(82, Math.round(position.y)) }
  while (true) {
    const collisions = occupied.filter(other => overlapsCard(candidate, other))
    if (collisions.length === 0) return candidate
    candidate.y = Math.max(...collisions.map(other => other.y + CARD_HEIGHT + CARD_GAP_Y))
  }
}

function connectorPath(fromPosition, toPosition) {
  const fromX = fromPosition.x + CARD_WIDTH
  const fromY = fromPosition.y + CARD_HEIGHT / 2
  const toX = toPosition.x
  const toY = toPosition.y + CARD_HEIGHT / 2
  const bend = Math.min(110, Math.max(36, Math.abs(toX - fromX) * .2))
  return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`
}

function connectorPathFromElements(fromCard, toCard) {
  const fromX = Number.parseFloat(fromCard.style.left) + CARD_WIDTH
  const fromY = Number.parseFloat(fromCard.style.top) + CARD_HEIGHT / 2
  const toX = Number.parseFloat(toCard.style.left)
  const toY = Number.parseFloat(toCard.style.top) + CARD_HEIGHT / 2
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return null
  const bend = Math.min(110, Math.max(36, Math.abs(toX - fromX) * .2))
  return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`
}

function selectorValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// Connector paths are rebuilt together with the canvas DOM; cache the mapping
// from card id to its incident paths so dragging never scans the whole SVG.
let connectorPathsByCard = new Map()
function cacheCardConnectors() {
  connectorPathsByCard = new Map()
  const viewport = document.querySelector('.canvas-viewport')
  if (!(viewport instanceof HTMLElement)) return
  for (const path of viewport.querySelectorAll('.connectors path[data-from]')) {
    const fromId = path.getAttribute('data-from')
    const toId = path.getAttribute('data-to')
    if (fromId === null || toId === null) continue
    for (const id of [fromId, toId]) {
      const paths = connectorPathsByCard.get(id)
      if (paths === undefined) connectorPathsByCard.set(id, new Set([path]))
      else paths.add(path)
    }
  }
}

function refreshCardConnectors(cardId) {
  const paths = connectorPathsByCard.get(cardId)
  if (paths === undefined || paths.size === 0) return
  const byId = state.canvasCardsById
  if (byId === undefined) return
  for (const path of paths) {
    const fromId = path.getAttribute('data-from')
    const toId = path.getAttribute('data-to')
    if (fromId === null || toId === null) continue
    const fromCard = byId.get(fromId)
    const toCard = byId.get(toId)
    if (fromCard === undefined || toCard === undefined) continue
    // Data-driven endpoints: the counterpart card may be unmounted (outside
    // the viewport) but its position is still authoritative.
    path.setAttribute('d', connectorPath(fromCard.position, toCard.position))
  }
}

function initialCanvasCamera(cards) {
  // The native composer owns the current route. Local inspection is separate.
  const route = nativeCanvasRoute(cards)
  const focus = cards.find(card => card.id === route.currentCardId) ?? cards[0]
  const position = focus?.position
  if (position === undefined) return { x: 0, y: 0 }
  return { x: CAMERA_INSET_X - position.x * state.zoom, y: CAMERA_INSET_Y - position.y * state.zoom }
}

function placeConversationCards(cards) {
  const saved = new Map(cards.flatMap(card => {
    if (card.positionLocked !== true) return []
    const position = state.cardPositions.get(card.id) ?? state.cardPositions.get(card.positionKey)
    return position === undefined ? [] : [[card.id, { x: position.x, y: position.y }]]
  }))
  const occupied = []
  for (const card of cards) {
    const position = saved.get(card.id)
    if (position !== undefined) {
      card.position = position
      continue
    }
    card.position = firstAvailableCardPosition(card.naturalPosition ?? card.position, occupied)
    occupied.push(card.position)
  }
  return cards
}

function layoutConversationGraph(cards, threads) {
  const childrenByThread = new Map()
  for (const thread of threads) {
    if (thread.parentId === null) continue
    const children = childrenByThread.get(thread.parentId) ?? []
    children.push(thread.id)
    childrenByThread.set(thread.parentId, children)
  }
  const laneByThread = new Map()
  const visitThread = threadId => {
    if (laneByThread.has(threadId)) return
    laneByThread.set(threadId, laneByThread.size)
    for (const childId of childrenByThread.get(threadId) ?? []) visitThread(childId)
  }
  for (const thread of threads) if (thread.parentId === null) visitThread(thread.id)
  for (const thread of threads) visitThread(thread.id)

  const byId = new Map(cards.map(card => [card.id, card]))
  const positioned = new Map()
  const positionFor = (card, visiting = new Set()) => {
    if (positioned.has(card.id)) return positioned.get(card.id)
    if (visiting.has(card.id)) return { x: 86, y: 82 + (laneByThread.get(card.dshThreadId) ?? 0) * (CARD_HEIGHT + CARD_GAP_Y) }
    visiting.add(card.id)
    const parent = card.parentId === null ? undefined : byId.get(card.parentId)
    const parentPosition = parent === undefined ? undefined : positionFor(parent, visiting)
    const position = {
      x: parentPosition === undefined ? 86 : parentPosition.x + 365,
      y: 82 + (laneByThread.get(card.dshThreadId) ?? 0) * (CARD_HEIGHT + CARD_GAP_Y),
    }
    visiting.delete(card.id)
    positioned.set(card.id, position)
    return position
  }
  for (const card of cards) {
    card.naturalPosition = positionFor(card)
    if (!card.positionLocked) card.position = card.naturalPosition
  }
  return placeConversationCards(cards)
}

function conversationCards(threads) {
  const cards = []
  const cardsByThread = new Map()
  for (const thread of threads) {
    const messages = messagesFor(thread)
    const turns = []
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
      const question = messages[messageIndex]
      if (question.kind !== 'user') continue
      const replies = []
      const errors = []
      let processCount = 0
      for (let replyIndex = messageIndex + 1; replyIndex < messages.length; replyIndex++) {
        const reply = messages[replyIndex]
        if (reply.kind === 'user') break
        if (reply.kind === 'assistant') replies.push(reply)
        if (reply.kind === 'error') errors.push(reply)
        if (Array.isArray(reply.process)) processCount += reply.process.length
        else if (reply.kind === 'tool') processCount += 1
      }
      const answer = replies.at(-1) ?? null
      const error = errors.at(-1) ?? null
      const turnIndex = turns.length
      const id = `${thread.id}:turn:${question.sourceSeq ?? messageIndex}`
      const previous = turns.at(-1)
      const positionKey = `${thread.id}:turn-index:${turnIndex}`
      const naturalPosition = previous === undefined ? { x: 86, y: 82 } : { x: previous.naturalPosition.x + 365, y: previous.naturalPosition.y }
      const savedPosition = state.cardPositions?.get(id) ?? state.cardPositions?.get(positionKey)
      const positionLocked = savedPosition !== undefined
      const position = positionLocked ? savedPosition : naturalPosition
      turns.push({
        id,
        positionKey,
        dshThreadId: thread.id,
        sourceParentId: thread.parentId,
        parentId: null,
        sourceSeq: question.sourceSeq,
        turnIndex,
        naturalPosition,
        position,
        positionLocked,
        question: messageText(question),
        answer,
        error,
        processCount,
      })
    }
    const liveReply = state.liveReplies.get(thread.dshSessionId)
    const latestTurn = turns.find(turn => turn.sourceSeq === liveReply?.userSeq)
    if (liveReply?.running && Number.isSafeInteger(liveReply.userSeq) && latestTurn !== undefined && (latestTurn.answer === null || latestTurn.answer.pending === true)) latestTurn.answer = { kind: 'assistant', text: liveReply.text, pending: true, at: new Date().toISOString() }
    if (turns.length === 0) {
      const id = `${thread.id}:turn:empty`
      const positionKey = `${thread.id}:turn-index:0`
      const naturalPosition = { x: 86, y: 82 }
      const savedPosition = state.cardPositions?.get(id) ?? state.cardPositions?.get(positionKey)
      const positionLocked = savedPosition !== undefined
      turns.push({
      id,
      positionKey,
      dshThreadId: thread.id,
      sourceParentId: thread.parentId,
      parentId: null,
      sourceSeq: undefined,
      turnIndex: 0,
      naturalPosition,
      position: positionLocked ? savedPosition : naturalPosition,
      positionLocked,
      question: thread.dshSessionTitle ?? thread.title,
      answer: null,
      error: null,
      processCount: 0,
      })
    }
    turns.at(-1).canContinue = true
    cardsByThread.set(thread.id, turns)
    cards.push(...turns)
  }
  for (const card of cards) {
    const siblings = cardsByThread.get(card.dshThreadId)
    if (card.turnIndex > 0) card.parentId = siblings[card.turnIndex - 1].id
    else {
      const parentCards = cardsByThread.get(card.sourceParentId)
      const sourceThread = threads.find(thread => thread.id === card.dshThreadId)
      const firstChildQuestion = siblings?.[0]
      const seedLength = sourceThread?.sourceSeedLength ?? firstChildQuestion?.sourceSeq
      // A fork inherits every parent event before DeepViewer's durable seed boundary.
      // The latest parent question below that boundary is the exact Turn where
      // this child was born. Canvas coordinates never participate in lineage.
      const inheritedTurn = Number.isSafeInteger(seedLength)
        ? parentCards?.filter(candidate => Number.isInteger(candidate.sourceSeq) && candidate.sourceSeq < seedLength).at(-1)
        : undefined
      card.parentId = state.branchAnchors.get(threads.find(thread => thread.id === card.dshThreadId)?.dshSessionId) ?? state.branchAnchors.get(card.dshThreadId) ?? inheritedTurn?.id ?? null
    }
  }
  return layoutConversationGraph(cards, threads)
}

function conversationGraphView(cards, collapsedCardIds = state.collapsedCardIds) {
  const cardIds = new Set(cards.map(card => card.id))
  const childrenByParent = new Map()
  for (const card of cards) {
    if (card.parentId === null || !cardIds.has(card.parentId)) continue
    const children = childrenByParent.get(card.parentId) ?? []
    children.push(card.id)
    childrenByParent.set(card.parentId, children)
  }

  const hiddenIds = new Set()
  for (const rootId of collapsedCardIds) {
    if (!cardIds.has(rootId)) continue
    const visited = new Set([rootId])
    const visit = parentId => {
      for (const childId of childrenByParent.get(parentId) ?? []) {
        if (visited.has(childId)) continue
        visited.add(childId)
        hiddenIds.add(childId)
        visit(childId)
      }
    }
    visit(rootId)
  }

  // Persisted collapse roots must remain visible even if malformed metadata
  // contains a cycle where two collapsed nodes otherwise hide each other.
  for (const rootId of collapsedCardIds) hiddenIds.delete(rootId)

  // Post-order accumulation: each card's descendant count is 1 + the sum of
  // its children's subtree sizes, so the whole graph is O(n) instead of a BFS
  // from every card (O(n²) on deep chains). Malformed parent cycles are
  // detected through the DFS path: every member of a cycle reaches every other
  // member plus the union of their off-cycle subtrees, so when the cycle entry
  // pops last, all members are settled to (cycleSize - 1) + off-cycle total,
  // which matches the per-card BFS' unique-descendant count.
  const descendantCounts = new Map()
  const inStack = new Set()
  for (const card of cards) {
    if (descendantCounts.has(card.id)) continue
    const stack = [{ id: card.id, children: childrenByParent.get(card.id) ?? [], index: 0 }]
    const path = [card.id]
    let cycleEntry = null
    let cycleMembers = null
    let cycleOffCycleTotal = 0
    inStack.add(card.id)
    while (stack.length > 0) {
      const top = stack[stack.length - 1]
      if (top.index < top.children.length) {
        const childId = top.children[top.index++]
        if (descendantCounts.has(childId)) continue
        if (inStack.has(childId)) {
          // Back edge: the nodes from childId up to top.id form a cycle.
          cycleEntry = childId
          cycleMembers = new Set(path.slice(path.indexOf(childId)))
          cycleOffCycleTotal = 0
          continue
        }
        inStack.add(childId)
        path.push(childId)
        stack.push({ id: childId, children: childrenByParent.get(childId) ?? [], index: 0 })
      } else {
        stack.pop()
        path.pop()
        inStack.delete(top.id)
        let count = 0
        for (const childId of top.children) {
          if (cycleMembers !== null && cycleMembers.has(childId)) continue // ring edge; base count added below
          count += 1 + (descendantCounts.get(childId) ?? 0)
        }
        if (cycleMembers !== null && cycleMembers.has(top.id)) cycleOffCycleTotal += count
        if (cycleMembers !== null && top.id === cycleEntry) {
          // All cycle members have popped (the entry pops last in post-order);
          // settle them so ancestors popping next read the final counts.
          const base = cycleMembers.size - 1
          for (const id of cycleMembers) descendantCounts.set(id, base + cycleOffCycleTotal)
          cycleEntry = null
          cycleMembers = null
        } else {
          descendantCounts.set(top.id, count)
        }
      }
    }
  }

  return {
    cards: cards.filter(card => !hiddenIds.has(card.id)),
    childCounts: new Map(cards.map(card => [card.id, childrenByParent.get(card.id)?.length ?? 0])),
    descendantCounts,
  }
}

function revealConversationThread(cards, threadId) {
  const byId = new Map(cards.map(card => [card.id, card]))
  let changed = false
  for (const target of cards.filter(card => card.dshThreadId === threadId)) {
    const visited = new Set([target.id])
    let parentId = target.parentId
    while (parentId !== null && !visited.has(parentId)) {
      visited.add(parentId)
      if (state.collapsedCardIds.delete(parentId)) changed = true
      parentId = byId.get(parentId)?.parentId ?? null
    }
  }
  if (changed) persistCollapsedCards()
}

// Derive the native route from the full graph once, never from persisted UI
// selection. Child lineage includes the exact inherited parent turn and every
// predecessor through the native conversation's latest turn.
function nativeCanvasRoute(cards) {
  const nativeThread = currentDshThread()
  const currentCard = nativeThread === undefined ? undefined : cards.filter(card => card.dshThreadId === nativeThread.id).at(-1)
  const lineage = new Set()
  const byId = new Map(cards.map(card => [card.id, card]))
  let card = currentCard
  while (card !== undefined && !lineage.has(card.id)) {
    lineage.add(card.id)
    card = card.parentId === null ? undefined : byId.get(card.parentId)
  }
  return { currentCardId: currentCard?.id ?? null, lineage }
}

function updateNativeCanvasRoute() {
  if (state.mode !== 'canvas' || state.canvasGraph === undefined || state.canvasCards === undefined) return
  const route = nativeCanvasRoute(state.canvasGraph.allCards ?? state.canvasCards)
  state.canvasGraph.nativeRoute = route
  for (const card of app.querySelectorAll('.thread-card')) {
    const current = card.dataset.cardId === route.currentCardId
    card.classList.toggle('current', current)
    if (current) card.setAttribute('aria-current', 'true')
    else card.removeAttribute('aria-current')
  }
  for (const connector of app.querySelectorAll('.connectors path')) {
    connector.classList.toggle('active-connector', route.lineage.has(connector.dataset.from) && route.lineage.has(connector.dataset.to))
  }
}

function canvasConnectors(cards, route) {
  const index = new Map(cards.map(card => [card.id, card]))
  const links = cards.map(card => {
    const parent = card.parentId === null ? null : index.get(card.parentId)
    if (parent === undefined || parent === null) return ''
    const active = route.lineage.has(card.id) && route.lineage.has(parent.id) ? ' active-connector' : ''
    return `<path class="${active.trim()}" data-from="${escapeHtml(parent.id)}" data-to="${escapeHtml(card.id)}" d="${connectorPath(parent.position, card.position)}"></path>`
  })
  return links.join('')
}

function conversationCard(card, graph) {
  const selected = card.id === state.selectedCardId ? 'selected' : ''
  const current = card.id === graph.nativeRoute?.currentCardId
  const source = card.parentId === null ? t('sourceSession') : card.turnIndex === 0 ? t('sourceBranch') : t('followup')
  const continueButton = card.canContinue === true
    ? `<button class="graph-continue-button" data-action="show-card-actions" data-thread="${card.dshThreadId}" data-card="${escapeHtml(card.id)}" aria-haspopup="dialog" aria-controls="card-action-menu" aria-expanded="${state.actionMenuCardId === card.id}" aria-label="${t('cardActions')}" title="${t('cardActions')}"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9"/></svg></button>`
    : ''
  const childCount = graph.childCounts.get(card.id) ?? 0
  const collapsed = state.collapsedCardIds.has(card.id)
  const foldLabel = collapsed ? t('expandChildren') : t('collapseChildren')
  const foldButton = childCount === 0 || card.canContinue === true ? '' : `<button class="graph-fold-button${collapsed ? ' collapsed' : ''}" data-action="toggle-card-children" data-card="${escapeHtml(card.id)}" aria-expanded="${collapsed ? 'false' : 'true'}" aria-label="${foldLabel}" title="${foldLabel}"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="${collapsed ? 'm6 3.5 4.5 4.5L6 12.5' : 'm3.5 6 4.5 4.5L12.5 6'}"/></svg></button>`
  const branchButton = childCount === 0 || card.canContinue === true || !Number.isInteger(card.answer?.sourceSeq) ? '' : `<button class="graph-branch-button" data-action="open-branch" data-thread="${card.dshThreadId}" data-card="${escapeHtml(card.id)}" data-seq="${card.answer.sourceSeq}" aria-label="${t('branchNew')}" title="${t('branchNew')}"><svg aria-hidden="true" viewBox="0 0 16 16"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.0762 1.37207C14.0846 1.37228 14.9021 2.19077 14.9023 3.19922C14.9022 4.20772 14.0847 5.02518 13.0762 5.02539C12.2967 5.02539 11.6325 4.53691 11.3701 3.84961H4.35547C4.79397 4.26458 5.15861 4.7644 5.41699 5.33496L7.10645 9.06738C7.88526 10.7875 9.55104 11.9228 11.4189 12.0371C11.7085 11.4109 12.3411 10.9756 13.0762 10.9756C14.0843 10.9759 14.9023 11.7936 14.9023 12.8018C14.9023 13.81 14.0843 14.6277 13.0762 14.6279C12.2534 14.6279 11.5574 14.0832 11.3291 13.335C8.9868 13.1879 6.89981 11.7612 5.92285 9.60352L4.23242 5.87109C3.67503 4.64033 2.44878 3.84961 1.09766 3.84961V2.54883C1.10665 2.54883 1.11601 2.54975 1.125 2.5498L11.3701 2.54883C11.6326 1.86151 12.2969 1.37207 13.0762 1.37207ZM13.0762 12.2764C12.7858 12.2764 12.5508 12.5114 12.5508 12.8018C12.5508 13.0921 12.7858 13.3281 13.0762 13.3281C13.3664 13.3279 13.6025 13.092 13.6025 12.8018C13.6025 12.5115 13.3664 12.2766 13.0762 12.2764ZM13.0762 2.67285C12.7855 2.67285 12.55 2.90861 12.5498 3.19922C12.5499 3.48987 12.7855 3.72559 13.0762 3.72559C13.3667 3.72538 13.6024 3.48975 13.6025 3.19922C13.6023 2.90874 13.3666 2.67306 13.0762 2.67285Z" fill="currentColor"/></svg></button>`
  return `<article class="thread-card ${selected}${current ? ' current' : ''}" ${current ? 'aria-current="true"' : ''} data-card-id="${escapeHtml(card.id)}" data-position-key="${escapeHtml(card.positionKey)}" data-thread="${card.dshThreadId}" style="left:${card.position.x}px;top:${card.position.y}px;--thread-color:#3478f6">
    <button class="node-handle" data-drag-card="${card.id}" aria-label="${t('drag')} ${escapeHtml(card.question)}" title="${t('dragCard')}"></button>
    ${continueButton}${foldButton}${branchButton}
    <div class="thread-card-head"><span class="topic-dot"></span><button class="thread-title" data-action="show-thread" data-thread="${card.dshThreadId}" data-card="${escapeHtml(card.id)}" title="${t('viewConversation')}：${escapeHtml(card.question)}">${escapeHtml(card.question)}</button></div>
    <div class="thread-meta"><span>${source}</span><span>${turnLabel(card.turnIndex + 1)}</span>${card.error === null ? '' : `<span class="card-error-status">${t('failed')}</span>`}${card.processCount > 0 ? `<span class="card-process-count">${t('tools')} ${card.processCount}</span>` : ''}</div>
    <div class="thread-answer">${card.answer === null ? (card.error === null ? `<p class="thread-answer-empty">${t('waiting')}</p>` : '') : card.answer.pending && card.answer.text === '' ? `<p class="thread-answer-pending">${t('replying')}</p>` : `${renderMarkdown(card.answer.text)}${card.answer.pending ? `<p class="thread-answer-pending">${t('replying')}</p>` : ''}`}${card.error === null ? '' : `<p class="thread-answer-error" title="${escapeHtml(card.error.text)}">${t('turnFailed')}: ${escapeHtml(card.error.text)}</p>`}</div>
    <footer><button class="compare-button${state.compareCardIds.includes(card.id) ? ' selected' : ''}" data-action="toggle-compare" data-card="${escapeHtml(card.id)}" aria-pressed="${state.compareCardIds.includes(card.id)}" title="${state.compareCardIds.includes(card.id) ? t('compareSelected') : t('compare')}">${t('compare')}</button><button data-action="show-thread" data-thread="${card.dshThreadId}" data-card="${escapeHtml(card.id)}" title="${t('viewConversation')}" aria-label="${t('viewConversation')}"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2 8.5 8 2.5l6 6V13.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5Z"/><path d="M6.2 14v-3.6a1.8 1.8 0 0 1 3.6 0V14" /></svg>${t('detail')}</button><button data-action="open-dsh" data-thread="${card.dshThreadId}" data-seq="${Number.isInteger(card.sourceSeq) ? card.sourceSeq : ''}" title="${t('openNative')}" aria-label="${t('openNative')}"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5H4.5A1.5 1.5 0 0 0 3 5v6.5A1.5 1.5 0 0 0 4.5 13H11a1.5 1.5 0 0 0 1.5-1.5V9"/><path d="M9.5 3.5h3v3M12.4 3.6 7.5 8.5"/></svg>DeepViewer</button><button data-action="archive-thread" data-thread="${card.dshThreadId}" title="${t('hideConversation')}" aria-label="${t('hideConversation')}"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5h11M5.5 7v5.5a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V7"/><path d="M4 5 5 2.8a.7.7 0 0 1 .6-.4h4.8a.7.7 0 0 1 .6.4L12 5M6 9.5h4"/></svg>${t('hide')}</button></footer>
  </article>`
}

function selectionFollowupButton() {
  return `<button class="selection-followup" type="button" data-action="follow-selection" hidden aria-label="${t('selectionFollowup')}" title="${t('selectionHint')}"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 3.5h10v6.25H7.2L4 12.5V9.75H3Z"/><path d="M8 4.9v3.4M6.3 6.6h3.4"/></svg><span>${t('followup')}</span></button>`
}

// Cards are mounted into the DOM only when they intersect the viewport
// (inflated by VIEWPORT_MARGIN) in world coordinates. The camera transform is
// translate(camera) scale(zoom), so screen = world * zoom + camera.
function visibleCardIds(cards) {
  const viewport = document.querySelector('.canvas-viewport')
  if (!(viewport instanceof HTMLElement)) return new Set(cards.map(card => card.id))
  const bounds = viewport.getBoundingClientRect()
  const left = (-state.canvasCamera.x - VIEWPORT_MARGIN) / state.zoom
  const right = (bounds.width - state.canvasCamera.x + VIEWPORT_MARGIN) / state.zoom
  const top = (-state.canvasCamera.y - VIEWPORT_MARGIN) / state.zoom
  const bottom = (bounds.height - state.canvasCamera.y + VIEWPORT_MARGIN) / state.zoom
  const visible = new Set()
  for (const card of cards) {
    const { x, y } = card.position
    if (x + CARD_WIDTH < left || x > right || y + CARD_HEIGHT < top || y > bottom) continue
    visible.add(card.id)
  }
  return visible
}

// Incrementally mount cards entering the viewport and unmount cards leaving
// it, without rebuilding the canvas. Called after pan/zoom/focus camera moves.
function syncCanvasViewport() {
  if (state.mode !== 'canvas' || state.canvasCards === undefined) return
  const layer = document.querySelector('.cards-layer')
  if (!(layer instanceof HTMLElement)) return
  const visible = visibleCardIds(state.canvasCards)
  for (const cardId of [...state.mountedCardIds]) {
    if (visible.has(cardId)) continue
    const element = layer.querySelector(`[data-card-id="${selectorValue(cardId)}"]`)
    if (element instanceof HTMLElement) element.remove()
    state.mountedCardIds.delete(cardId)
  }
  for (const card of state.canvasCards) {
    if (!visible.has(card.id) || state.mountedCardIds.has(card.id)) continue
    const wrapper = document.createElement('div')
    wrapper.innerHTML = conversationCard(card, state.canvasGraph)
    const element = wrapper.firstElementChild
    if (element instanceof HTMLElement) {
      layer.appendChild(element)
      const handle = element.querySelector('[data-drag-card]')
      if (handle instanceof HTMLElement) bindDragHandle(handle)
    }
    state.mountedCardIds.add(card.id)
  }
}

function renderCanvas() {
  const threads = state.workspace?.threads ?? []
  if (threads.length === 0) return `<section class="empty-canvas"><strong>${t('emptyMap')}</strong><p>${t('emptyMapHelp')}</p></section>`
  const allCards = conversationCards(threads)
  const graph = conversationGraphView(allCards)
  graph.allCards = allCards
  graph.nativeRoute = nativeCanvasRoute(allCards)
  const cards = graph.cards
  state.canvasCards = cards
  state.canvasCardsById = new Map(cards.map(card => [card.id, card]))
  state.canvasGraph = graph
  if (state.inspectorCardId !== null && !state.canvasCardsById.has(state.inspectorCardId)) {
    state.inspectorCardId = null
    state.inspectorOpening = false
  }
  if (!state.canvasViewInitialized) {
    state.canvasCamera = initialCanvasCamera(cards)
    state.canvasViewInitialized = true
    // The viewport is not laid out yet while renderCanvas builds its HTML;
    // center the focused card once the DOM is mounted (render tail).
    state.canvasNeedsCenter = true
  }
  const visible = visibleCardIds(cards)
  state.mountedCardIds = new Set(visible)
  const mounted = cards.filter(card => visible.has(card.id))
  const inspector = state.inspectorCardId === null ? '' : renderCardInspector(state.canvasCardsById.get(state.inspectorCardId))
  return `<section class="canvas-view"><div class="canvas-viewport"><div class="canvas-content" style="transform:translate(${state.canvasCamera.x}px, ${state.canvasCamera.y}px) scale(${state.zoom})"><svg class="connectors">${canvasConnectors(cards, graph.nativeRoute)}</svg><div class="cards-layer">${mounted.map(card => conversationCard(card, graph)).join('')}</div></div></div>${inspector}</section>`
}

function isProcessMessage(message) {
  if (message.kind === 'tool' || message.kind === 'tool-result') return true
  return message.kind === 'assistant' && /(?:^|\n)\s*(?:bash|pwsh|powershell|web_search|web_fetch|browser|read_file|write_file)\s*\n\s*\{/.test(message.text)
}

function processSummary(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 140) || t('processFallback')
}

function threadMessage(thread, message) {
  const isUser = message.kind === 'user'
  const label = isUser ? t('you') : message.kind === 'assistant' ? 'DeepViewer' : message.kind === 'error' ? t('error') : t('record')
  const branch = message.kind === 'assistant' && Number.isInteger(message.sourceSeq)
    ? `<button class="message-branch" data-action="open-branch" data-thread="${thread.id}" data-seq="${message.sourceSeq}" title="${t('branchAnswer')}"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M4.5 3v6a2.5 2.5 0 0 0 2.5 2.5H12"/><circle cx="4.5" cy="3" r="1.5"/><circle cx="11.5" cy="12" r="1.5"/></svg>${t('branch')}</button>`
    : ''
  const messageId = `${thread.id}:${message.sourceSeq ?? `${message.kind}:${message.at}`}`
  const collapsible = isProcessMessage(message)
  const expanded = state.expandedMessageIds.has(messageId)
  const fold = collapsible ? `<button class="message-fold" data-action="toggle-message" data-message="${escapeHtml(messageId)}" aria-label="${expanded ? t('collapseProcess') : t('expandProcess')}" title="${expanded ? t('collapse') : t('expand')}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg></button>` : ''
  const process = Array.isArray(message.process) && message.process.length > 0 ? message.process : null
  const body = message.pending && message.text === '' ? `<p class="message-streaming"><span class="streaming-dot"></span>${t('replying')}</p>`
    : `${collapsible && !expanded ? `<p class="message-summary">${escapeHtml(processSummary(message.text))}</p>` : renderMarkdown(messageText(message))}${message.pending ? `<p class="message-streaming"><span class="streaming-dot"></span>${t('replying')}</p>` : ''}${process === null ? '' : processRecords(process, messageId)}`
  const avatar = isUser ? '' : '<span class="message-avatar" aria-hidden="true"></span>'
  return `<article class="message message-${message.kind}${message.pending ? ' message-pending' : ''}${collapsible ? ' message-collapsible' : ''}${expanded ? ' expanded' : ''}" data-message-seq="${Number.isInteger(message.sourceSeq) ? message.sourceSeq : ''}"><header>${avatar}<span class="message-role">${label}</span><time>${formatTime(message.at)}</time>${branch}${fold}</header><div class="message-body">${body}</div></article>`
}

function processRecords(process, messageId) {
  const key = `${messageId}:process`
  const expanded = state.expandedMessageIds.has(key)
  const entries = process.map((entry, index) => {
    const entryKey = `${key}:${index}`
    const entryExpanded = state.expandedMessageIds.has(entryKey)
    const status = entry.error !== null ? t('failed') : entry.result === null ? t('waitingResult') : t('done')
    const argumentsHtml = entry.arguments === null || entry.arguments === '' ? '' : `<pre class="process-args">${escapeHtml(entry.arguments)}</pre>`
    const outcomeHtml = entry.error !== null ? `<pre class="process-error">${escapeHtml(entry.error)}</pre>` : entry.result === null ? '' : `<pre class="process-result">${escapeHtml(entry.result)}</pre>`
    return `<div class="process-entry${entryExpanded ? ' expanded' : ''}"><button class="process-entry-fold" data-action="toggle-message" data-message="${escapeHtml(entryKey)}"><span class="process-entry-name">${escapeHtml(entry.name)}</span><span class="process-status${entry.error !== null ? ' process-status-error' : entry.result === null ? ' process-status-pending' : ' process-status-done'}">${status}</span></button>${entryExpanded ? `<div class="process-entry-body">${argumentsHtml}${outcomeHtml}</div>` : ''}</div>`
  }).join('')
  return `<section class="process-records${expanded ? ' expanded' : ''}"><button class="process-records-fold" data-action="toggle-message" data-message="${escapeHtml(key)}"><span>${expanded ? t('collapseProcess') : t('process')}</span><span class="process-count">${process.length}</span></button>${expanded ? entries : ''}</section>`
}

function messagesForCard(card) {
  const thread = state.workspace?.threads.find(item => item.id === card.dshThreadId)
  if (thread === undefined) return { thread: null, messages: [] }
  const messages = messagesFor(thread)
  let turnIndex = -1
  let start = -1
  for (let index = 0; index < messages.length; index++) {
    if (messages[index].kind !== 'user') continue
    turnIndex += 1
    if (turnIndex === card.turnIndex) {
      start = index
      break
    }
  }
  if (start === -1) return { thread, messages: [] }
  const end = messages.findIndex((message, index) => index > start && message.kind === 'user')
  return { thread, messages: messages.slice(start, end === -1 ? undefined : end) }
}

function inspectorProcessEntries(messages) {
  const entries = []
  for (const message of messages) {
    if (Array.isArray(message.process)) {
      entries.push(...message.process.map(entry => ({ ...entry })))
      continue
    }
    if (message.kind === 'tool') {
      entries.push({ name: processSummary(message.text), arguments: message.text, result: null, error: null })
      continue
    }
    if (message.kind === 'tool-result') {
      const previous = entries.at(-1)
      if (previous !== undefined && previous.result === null && previous.error === null) previous.result = message.text
      else entries.push({ name: t('toolResult'), arguments: null, result: message.text, error: null })
    }
  }
  return entries
}

function renderCardInspector(card) {
  if (card === undefined) return ''
  const { thread, messages } = messagesForCard(card)
  if (thread === null) return ''
  const process = inspectorProcessEntries(messages)
  const answer = card.answer === null
    ? card.error === null ? `<p class="card-inspector-pending">${t('waiting')}</p>` : ''
    : `<article class="card-inspector-answer">${renderMarkdown(card.answer.text)}${card.answer.pending ? `<p class="card-inspector-pending">${t('replying')}</p>` : ''}</article>`
  const error = card.error === null ? '' : `<section class="card-inspector-error" role="alert"><strong>${t('incomplete')}</strong><p>${escapeHtml(card.error.text)}</p></section>`
  const processRecordsHtml = process.length === 0 ? '' : processRecords(process, `${thread.id}:${card.id}:inspector`)
  const continueAction = card.canContinue === true ? `<button type="button" data-action="open-continue" data-thread="${thread.id}" data-card="${escapeHtml(card.id)}"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2.5 3.5h11v7h-6l-3.5 2.5v-2.5h-1.5Z"/><path d="M8 5.5v3M6.5 7h3"/></svg>${t('continueFollowup')}</button>` : ''
  const branch = Number.isInteger(card.answer?.sourceSeq)
    ? `<button type="button" data-action="open-branch" data-thread="${thread.id}" data-card="${escapeHtml(card.id)}" data-seq="${card.answer.sourceSeq}"><svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="4" cy="3.5" r="1.5"/><circle cx="12" cy="3.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><path d="M5.5 3.5h2A2.5 2.5 0 0 1 10 6v5"/></svg>${t('createBranch')}</button>`
    : ''
  const openDshAction = `<button class="primary" type="button" data-action="open-dsh" data-thread="${thread.id}" data-seq="${Number.isInteger(card.answer?.sourceSeq) ? card.answer.sourceSeq : ''}"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M7 3.5H4.5A1.5 1.5 0 0 0 3 5v6.5A1.5 1.5 0 0 0 4.5 13H11a1.5 1.5 0 0 0 1.5-1.5V9"/><path d="M9.5 3.5h3v3M12.4 3.6 7.5 8.5"/></svg>${t('openNative')}</button>`
  return `<aside class="card-inspector${state.inspectorOpening ? ' is-opening' : ''}" aria-label="${t('cardDetails')}" data-inspector-card="${escapeHtml(card.id)}"><header class="card-inspector-head"><div><div class="card-inspector-meta"><span>${turnLabel(card.turnIndex + 1)}</span>${card.error === null ? '' : `<span class="card-inspector-error-status">${t('failed')}</span>`}${process.length > 0 ? `<span>${t('tools')} ${process.length}</span>` : ''}</div><h2>${escapeHtml(card.question)}</h2></div><button class="card-inspector-close" type="button" data-action="close-card-inspector" aria-label="${t('closeCardDetails')}" title="${t('close')}"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg></button></header><div class="card-inspector-scroll">${error}${answer}${processRecordsHtml}</div><footer class="card-inspector-actions">${continueAction}${branch}${openDshAction}</footer></aside>`
}

function renderThread() {
  const thread = currentThread()
  if (thread === null) return renderCanvas()
  const messages = messagesFor(thread)
  const latestAssistantSeq = [...messages].reverse().find(message => Number.isInteger(message.sourceSeq))?.sourceSeq
  return `<section class="detail-view"><header class="detail-head"><div class="detail-head-title"><div class="detail-head-meta"><span class="detail-badge">${thread.parentId === null ? t('session') : t('branch')}</span>${thread.dshSessionTitle ?? thread.title ? `<span class="detail-subtitle">${escapeHtml(thread.dshSessionTitle ?? thread.title)}</span>` : ''}</div><h1>${escapeHtml(questionFor(thread))}</h1></div><div class="detail-head-actions"><button data-action="open-dsh" data-thread="${thread.id}" data-seq="${Number.isInteger(latestAssistantSeq) ? latestAssistantSeq : ''}" title="${t('openNativeHint')}">${t('openNative')}</button><button data-action="open-branch" data-thread="${thread.id}" title="${t('branchLatest')}">${t('createBranch')}</button></div></header><div class="detail-scroll">${messages.map(message => threadMessage(thread, message)).join('') || `<div class="note-empty">${t('emptyDetail')}</div>`}</div></section>`
}

function renderCompare() {
  const cards = conversationCards(state.workspace?.threads ?? [])
  const selected = state.compareCardIds.map(id => cards.find(card => card.id === id)).filter(Boolean)
  if (selected.length < 2) return `<section class="compare-empty"><strong>${t('compareEmpty')}</strong><p>${t('compareHelp')}</p></section>`
  return `<section class="compare-view"><div class="compare-columns">${selected.map(card => `<article><header class="compare-title"><h2>${escapeHtml(card.question)}</h2><button data-action="show-thread" data-thread="${card.dshThreadId}" data-card="${escapeHtml(card.id)}">${t('detail')}</button></header><p class="compare-meta">${turnLabel(card.turnIndex + 1)}</p><div class="compare-answer">${card.answer === null ? `<p>${t('waiting')}</p>` : renderMarkdown(card.answer.text)}${card.error === null ? '' : `<p class="thread-answer-error">${escapeHtml(card.error.text)}</p>`}</div></article>`).join('')}</div></section>`
}

function render() {
  // Keep the actual pressed DOM node mounted until the browser dispatches click.
  // Native subscriptions may arrive between pointerdown and pointerup.
  if (state.pointerPressed) { state.renderDeferred = true; return }
  state.renderDeferred = false
  // Remember the departing thread's scroll position per thread id, so
  // switching sessions restores each conversation's own place instead of
  // smearing one session's position onto another.
  if (state.mode === 'thread' && state.detailThreadId !== null) {
    const detail = document.querySelector('.detail-scroll')
    if (detail instanceof HTMLElement) state.detailScrollByThread.set(state.detailThreadId, detail.scrollTop)
  }
  if (state.mode === 'canvas' && state.inspectorCardId !== null) {
    const inspector = document.querySelector('.card-inspector-scroll')
    if (inspector instanceof HTMLElement) state.inspectorScrollByCard.set(state.inspectorCardId, inspector.scrollTop)
  }
  state.detailThreadId = state.mode === 'thread' ? state.activeId : null
  const detailScrollTop = state.detailThreadId === null ? null : state.detailScrollByThread.get(state.detailThreadId) ?? null
  const inspectorScrollTop = state.mode === 'canvas' && state.inspectorCardId !== null ? state.inspectorScrollByCard.get(state.inspectorCardId) ?? null : null
  const cardScrollTops = new Map()
  if (state.mode === 'canvas') {
    // Key by the unique card id: every card of a session shares data-thread,
    // so keying on it would clobber sibling cards' scroll positions. Only
    // scrollable answers have a position worth preserving; reading the two
    // height properties shares the same forced layout as the scrollTop read.
    for (const answer of document.querySelectorAll('.thread-card[data-thread] .thread-answer')) {
      if (answer.scrollHeight <= answer.clientHeight) continue
      const card = answer.closest('.thread-card')
      if (card instanceof HTMLElement && typeof card.dataset.cardId === 'string') cardScrollTops.set(card.dataset.cardId, answer.scrollTop)
    }
  }
  const workspace = state.workspace
  const threads = workspace?.threads ?? []
  const view = state.mode === 'thread' ? renderThread() : state.mode === 'compare' ? renderCompare() : renderCanvas()
  const canvasControls = state.mode === 'canvas' && threads.length > 0 ? `<div class="canvas-controls"><button data-action="layout" title="${t('arrangeHint')}" aria-label="${t('arrangeHint')}"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>${t('arrange')}</button><button data-action="focus-active" title="${t('locateHint')}" aria-label="${t('locateHint')}"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3.2"/><path d="M8 1.5v2.6M8 11.9v2.6M1.5 8h2.6M11.9 8h2.6"/></svg>${t('locate')}</button><button data-action="zoom-out" aria-label="${t('zoomOut')}" title="${t('zoomOut')}"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3.5 8h9"/></svg></button><span>${Math.round(state.zoom * 100)}%</span><button data-action="zoom-in" aria-label="${t('zoomIn')}" title="${t('zoomIn')}"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg></button></div>` : ''
  const detailAvailable = currentThread() !== null
  const canvasTabs = `<nav class="canvas-tabs" aria-label="${t('mapViews')}"><button class="${state.mode === 'canvas' ? 'active' : ''}" data-action="show-canvas" aria-pressed="${state.mode === 'canvas'}">${t('map')}</button><button class="${state.mode === 'thread' ? 'active' : ''}" data-action="show-thread" data-thread="${state.activeId ?? ''}" ${detailAvailable ? '' : 'disabled'} aria-pressed="${state.mode === 'thread'}">${t('detail')}</button><button class="${state.mode === 'compare' ? 'active' : ''}" data-action="show-compare" aria-pressed="${state.mode === 'compare'}">${t('compare')}${state.compareCardIds.length === 0 ? '' : ` (${state.compareCardIds.length}/2)`}</button>${state.mode === 'compare' && state.compareCardIds.length > 0 ? `<button data-action="clear-compare">${t('clearCompare')}</button>` : ''}</nav>`
  app.innerHTML = `<main class="synapse-shell"><header class="map-toolbar">${canvasTabs}${canvasControls}</header><section class="main-stage">${state.error ? `<div class="status-message" role="alert"><span>${escapeHtml(state.error)}</span><button data-action="dismiss-error" aria-label="${t('close')}" title="${t('close')}">×</button></div>` : ''}${view}${selectionFollowupButton()}${renderCardActionMenu()}${renderComposeNotice()}</section></main>`
  persistViewState()
  installDragging()
  updateComposeControls()
  positionCardActionMenu()
  queueLayoutReport()
  cacheCardConnectors()
  // The initial camera from renderCanvas is inset (viewport not laid out yet);
  // center it on the focused card once the canvas DOM is mounted.
  if (state.canvasNeedsCenter) {
    state.canvasNeedsCenter = false
    window.requestAnimationFrame(() => { if (state.mode === 'canvas') focusActiveCard() })
  }
  for (const [cardId, scrollTop] of cardScrollTops) {
    const answer = app.querySelector(`.thread-card[data-card-id="${CSS.escape(cardId)}"] .thread-answer`)
    if (answer instanceof HTMLElement) answer.scrollTop = scrollTop
  }
  if (detailScrollTop !== null) window.requestAnimationFrame(() => {
    const nextDetail = document.querySelector('.detail-scroll')
    if (nextDetail instanceof HTMLElement) nextDetail.scrollTop = detailScrollTop
  })
  if (inspectorScrollTop !== null) window.requestAnimationFrame(() => {
    const inspector = document.querySelector('.card-inspector-scroll')
    if (inspector instanceof HTMLElement) inspector.scrollTop = inspectorScrollTop
  })
  if (state.inspectorOpening) window.requestAnimationFrame(() => {
    document.querySelector('.card-inspector')?.classList.remove('is-opening')
    state.inspectorOpening = false
  })
  // Jump the detail view to the card the user clicked: card ids carry the
  // source sequence (`<thread>:turn:<seq>`), which matches data-message-seq
  // anchors on the rendered messages.
  const targetCardId = state.detailTargetCardId
  state.detailTargetCardId = null
  if (targetCardId !== null) {
    const match = /:turn:(\d+)$/.exec(targetCardId)
    const seq = match === null ? null : match[1]
    if (seq !== null) window.requestAnimationFrame(() => {
      const target = app.querySelector(`[data-message-seq="${CSS.escape(seq)}"]`)
      if (target instanceof HTMLElement) target.scrollIntoView({ block: 'start' })
    })
  }
}

function renderPreservingDetailScroll() {
  render()
}

let inspectorCloseTimer = 0
function openCardInspector(cardId) {
  if (inspectorCloseTimer !== 0) {
    window.clearTimeout(inspectorCloseTimer)
    inspectorCloseTimer = 0
  }
  state.inspectorOpening = state.inspectorCardId === null
  state.inspectorCardId = cardId
}

function closeCardInspector({ animate = true } = {}) {
  if (state.inspectorCardId === null) return
  if (inspectorCloseTimer !== 0) window.clearTimeout(inspectorCloseTimer)
  const cardId = state.inspectorCardId
  const inspector = document.querySelector('.card-inspector')
  if (!animate || !(inspector instanceof HTMLElement)) {
    state.inspectorCardId = null
    state.inspectorOpening = false
    inspector?.remove()
    persistViewState()
    queueLayoutReport()
    return
  }
  inspector.classList.add('is-closing')
  inspectorCloseTimer = window.setTimeout(() => {
    inspectorCloseTimer = 0
    if (state.inspectorCardId !== cardId) return
    state.inspectorCardId = null
    state.inspectorOpening = false
    document.querySelector('.card-inspector')?.remove()
    persistViewState()
    queueLayoutReport()
  }, 180)
}

// Card inspection is local browsing. Native session navigation occurs only
// after an explicit Continue, Branch, or Open in DeepViewer action.
function selectCanvasCard(cardId) {
  const card = state.canvasCardsById?.get(cardId)
  if (card === undefined) return
  const previousInspector = app.querySelector('.card-inspector-scroll')
  if (previousInspector instanceof HTMLElement && state.inspectorCardId !== null) state.inspectorScrollByCard.set(state.inspectorCardId, previousInspector.scrollTop)
  const unchanged = state.inspectorCardId === cardId
  state.activeId = card.dshThreadId
  state.selectedCardId = cardId
  state.error = ''
  app.querySelector('.status-message')?.remove()
  for (const element of app.querySelectorAll('.thread-card')) element.classList.toggle('selected', element.dataset.cardId === cardId)
  const detailTab = app.querySelector('.canvas-tabs [data-action="show-thread"]')
  if (detailTab instanceof HTMLElement) detailTab.dataset.thread = card.dshThreadId
  openCardInspector(cardId)
  if (!unchanged || !app.querySelector('.card-inspector')) {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = renderCardInspector(card)
    const next = wrapper.firstElementChild
    const previous = app.querySelector('.card-inspector')
    if (previous) previous.replaceWith(next)
    else app.querySelector('.canvas-view')?.append(next)
    const scroll = next.querySelector('.card-inspector-scroll')
    if (scroll instanceof HTMLElement) scroll.scrollTop = state.inspectorScrollByCard.get(cardId) ?? 0
    window.requestAnimationFrame(() => { next.classList.remove('is-opening'); state.inspectorOpening = false })
  }
  persistViewState()
  queueLayoutReport()
}

function renderCardActionMenu() {
  const card = state.canvasCardsById?.get(state.actionMenuCardId)
  if (card === undefined || state.mode !== 'canvas') return ''
  const canBranch = Number.isInteger(card.answer?.sourceSeq) && card.answer?.pending !== true
  return `<section id="card-action-menu" class="card-action-menu" role="dialog" aria-label="${t('cardActions')}" data-menu-card="${escapeHtml(card.id)}"><strong>${t('cardActions')}</strong><button type="button" data-action="open-continue" data-thread="${card.dshThreadId}" data-card="${escapeHtml(card.id)}">${t('continueSession')}</button><p class="card-action-menu-hint">${t('continueHint')}</p><button type="button" data-action="open-branch" data-thread="${card.dshThreadId}" data-card="${escapeHtml(card.id)}" data-seq="${canBranch ? card.answer.sourceSeq : ''}" ${canBranch ? '' : 'disabled'}>${t('branchFromReply')}</button><p class="card-action-menu-hint">${canBranch ? t('branchHint') : t('waitBranch')}</p></section>`
}
function positionCardActionMenu() {
  const menu = app.querySelector('.card-action-menu')
  if (!(menu instanceof HTMLElement)) return
  const anchor = app.querySelector(`[data-action="show-card-actions"][data-card="${CSS.escape(state.actionMenuCardId)}"]`)
  if (!(anchor instanceof HTMLElement)) return closeCardActionMenu()
  const rect = anchor.getBoundingClientRect()
  const left = Math.min(window.innerWidth - menu.offsetWidth - 8, rect.right + 8)
  const top = Math.min(window.innerHeight - menu.offsetHeight - 8, rect.top)
  menu.style.left = `${Math.max(8, left)}px`
  menu.style.top = `${Math.max(8, top)}px`
}
function closeCardActionMenu() {
  state.actionMenuCardId = null
  app.querySelector('.card-action-menu')?.remove()
  for (const button of app.querySelectorAll('[data-action="show-card-actions"]')) button.setAttribute('aria-expanded', 'false')
}
function openCardActionMenu(cardId) {
  if (state.composePending) return
  if (state.actionMenuCardId === cardId) return closeCardActionMenu()
  closeCardActionMenu()
  state.actionMenuCardId = cardId
  app.querySelector('.main-stage')?.insertAdjacentHTML('beforeend', renderCardActionMenu())
  const anchor = app.querySelector(`[data-action="show-card-actions"][data-card="${CSS.escape(cardId)}"]`)
  anchor?.setAttribute('aria-expanded', 'true')
  positionCardActionMenu()
  app.querySelector('.card-action-menu button:not(:disabled)')?.focus({ preventScroll: true })
}
function updateComposeControls() {
  for (const button of app.querySelectorAll('[data-action="open-continue"], [data-action="open-branch"], [data-action="show-card-actions"], [data-action="follow-selection"]')) {
    button.disabled = state.composePending || button.dataset.action === 'open-branch' && button.dataset.card !== undefined && !Number.isInteger(Number(button.dataset.seq || NaN))
  }
  const menu = app.querySelector('.card-action-menu')
  if (menu instanceof HTMLElement) menu.setAttribute('aria-busy', String(state.composePending))
}
function renderComposeNotice() {
  return state.notice ? `<div class="compose-notice" role="status"><span>${escapeHtml(state.notice)}</span><button type="button" data-action="dismiss-notice" aria-label="${t('close')}">×</button></div>` : ''
}
function updateComposeNotice() {
  app.querySelector('.compose-notice')?.remove()
  app.querySelector('.main-stage')?.insertAdjacentHTML('beforeend', renderComposeNotice())
}
let layoutReportFrame = 0
let previousInspectorWidth = -1
function queueLayoutReport() {
  if (layoutReportFrame !== 0) return
  layoutReportFrame = window.requestAnimationFrame(() => {
    layoutReportFrame = 0
    const inspector = app.querySelector('.card-inspector')
    const inspectorWidth = window.innerWidth > 640 && inspector instanceof HTMLElement ? inspector.offsetWidth : 0
    if (inspectorWidth === previousInspectorWidth) return
    previousInspectorWidth = inspectorWidth
    post('synapse:layout', { inspectorWidth })
  })
}
window.addEventListener('resize', () => { queueLayoutReport(); positionCardActionMenu() })

function applyCanvasTransform() {
  const content = document.querySelector('.canvas-content')
  if (content instanceof HTMLElement) content.style.transform = `translate(${state.canvasCamera.x}px, ${state.canvasCamera.y}px) scale(${state.zoom})`
  persistViewState()
  positionCardActionMenu()
}

function bindDragHandle(handle) {
  handle.addEventListener('pointerdown', event => {
    const cardId = event.currentTarget.dataset.dragCard
    const card = event.currentTarget.closest('.thread-card')
    if (cardId === undefined || !(card instanceof HTMLElement)) return
    event.preventDefault()
    const origin = { x: event.clientX, y: event.clientY, position: { x: Number.parseFloat(card.style.left), y: Number.parseFloat(card.style.top) } }
    const aliases = card.dataset.positionKey === undefined ? [] : [card.dataset.positionKey]
    let position = origin.position
    let stopped = false
    let frame = 0
    state.dragging = true
    // Coalesce pointermove updates to one DOM pass per animation frame so a
    // high report-rate pointer cannot queue a reflow per event.
    const apply = () => {
      frame = 0
      state.cardPositions.set(cardId, { x: Math.round(position.x), y: Math.round(position.y) })
      for (const alias of aliases) state.cardPositions.set(alias, { x: Math.round(position.x), y: Math.round(position.y) })
      // Keep the virtualized data object in sync so viewport visibility and
      // connector paths track the live drag position.
      const dataCard = state.canvasCardsById?.get(cardId)
      if (dataCard !== undefined) dataCard.position = { x: position.x, y: position.y }
      card.style.left = `${position.x}px`
      card.style.top = `${position.y}px`
      refreshCardConnectors(cardId)
    }
    const move = moveEvent => {
      position = { x: origin.position.x + (moveEvent.clientX - origin.x) / state.zoom, y: origin.position.y + (moveEvent.clientY - origin.y) / state.zoom }
      if (frame === 0) frame = window.requestAnimationFrame(apply)
    }
    const stop = () => {
      if (stopped) return
      stopped = true
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', stop)
      document.removeEventListener('pointercancel', stop)
      if (frame !== 0) { window.cancelAnimationFrame(frame); frame = 0 }
      apply()
      rememberCardPosition(cardId, position, aliases)
      state.dragging = false
      deferCanvasRefresh(120)
      // No full render: only the dragged card's inline position and its
      // connectors changed; rebuilding the whole canvas on drop is the jank.
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', stop)
    document.addEventListener('pointercancel', stop)
  })
}

function installDragging() {
  for (const handle of document.querySelectorAll('[data-drag-card]')) bindDragHandle(handle)
}

function canvasViewport(target) {
  return target instanceof Element ? target.closest('.canvas-viewport') : null
}

function zoomCanvas(viewport, nextZoom, clientX, clientY) {
  const zoom = Math.min(4, Math.max(.6, Math.round(nextZoom * 100) / 100))
  if (zoom === state.zoom) return
  const bounds = viewport.getBoundingClientRect()
  const localX = clientX - bounds.left
  const localY = clientY - bounds.top
  const worldX = (localX - state.canvasCamera.x) / state.zoom
  const worldY = (localY - state.canvasCamera.y) / state.zoom
  state.zoom = zoom
  state.canvasCamera = { x: localX - worldX * zoom, y: localY - worldY * zoom }
  const content = viewport.querySelector('.canvas-content')
  if (content instanceof HTMLElement) {
    // Drop the composited layer before zooming: a cached will-change raster
    // would be upscaled instead of re-rasterized, which was the original
    // zoom-blur bug. will-change re-applies via .is-panning on the next pan.
    content.style.willChange = 'auto'
    applyCanvasTransform()
    syncCanvasViewport()
    window.requestAnimationFrame(() => { content.style.willChange = '' })
  } else {
    applyCanvasTransform()
    syncCanvasViewport()
  }
  const label = document.querySelector('.canvas-controls span')
  if (label !== null) label.textContent = `${Math.round(state.zoom * 100)}%`
}

function zoomCanvasAtCenter(delta) {
  const viewport = document.querySelector('.canvas-viewport')
  if (!(viewport instanceof HTMLElement)) return
  const bounds = viewport.getBoundingClientRect()
  zoomCanvas(viewport, state.zoom + delta, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
}

function focusActiveCard() {
  const viewport = document.querySelector('.canvas-viewport')
  if (!(viewport instanceof HTMLElement)) return
  const cards = state.canvasCards
  if (cards === undefined || cards.length === 0) return
  const route = state.canvasGraph?.nativeRoute ?? nativeCanvasRoute(cards)
  const card = cards.find(card => card.id === route.currentCardId) ?? cards[0]
  const { x: left, y: top } = card.position
  const bounds = viewport.getBoundingClientRect()
  state.canvasCamera = {
    x: bounds.width / 2 - (left + CARD_WIDTH / 2) * state.zoom,
    y: bounds.height / 2 - (top + CARD_HEIGHT / 2) * state.zoom,
  }
  applyCanvasTransform()
  syncCanvasViewport()
}

let selectionFollowup = null
let selectionFollowupFrame = 0

function hideSelectionFollowup() {
  if (selectionFollowupFrame !== 0) {
    window.cancelAnimationFrame(selectionFollowupFrame)
    selectionFollowupFrame = 0
  }
  selectionFollowup = null
  const button = app.querySelector('.selection-followup')
  if (button instanceof HTMLButtonElement) button.hidden = true
}

function selectionFollowupTarget(range) {
  const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
  const end = range.endContainer instanceof Element ? range.endContainer : range.endContainer.parentElement
  if (!(start instanceof Element) || !(end instanceof Element)) return null
  const answer = start.closest('.thread-answer')
  if (answer instanceof HTMLElement && answer.contains(end)) {
    const card = answer.closest('.thread-card[data-thread]')
    if (card instanceof HTMLElement && card.dataset.thread !== undefined) return { threadId: card.dataset.thread }
  }
  const messageBody = start.closest('.message-assistant .message-body')
  const thread = currentThread()
  if (messageBody instanceof HTMLElement && messageBody.contains(end) && thread !== null) return { threadId: thread.id }
  return null
}

function updateSelectionFollowup() {
  selectionFollowupFrame = 0
  const button = app.querySelector('.selection-followup')
  const selection = window.getSelection()
  if (!(button instanceof HTMLButtonElement) || selection === null || selection.rangeCount !== 1 || selection.isCollapsed) return hideSelectionFollowup()
  const text = selection.toString().trim()
  const range = selection.getRangeAt(0)
  const target = text === '' || text.length > 4000 ? null : selectionFollowupTarget(range)
  const rect = range.getBoundingClientRect()
  if (target === null || rect.width === 0 || rect.height === 0) return hideSelectionFollowup()
  selectionFollowup = { ...target, text }
  button.dataset.thread = target.threadId
  button.style.left = `${Math.min(window.innerWidth - 12, Math.max(76, rect.right))}px`
  button.style.top = `${Math.min(window.innerHeight - 38, Math.max(8, rect.bottom + 8))}px`
  button.hidden = false
}

function queueSelectionFollowup() {
  if (selectionFollowupFrame !== 0) return
  selectionFollowupFrame = window.requestAnimationFrame(updateSelectionFollowup)
}

app.addEventListener('pointerdown', event => {
  const viewport = canvasViewport(event.target)
  if (!(viewport instanceof HTMLElement) || event.target instanceof Element && event.target.closest('.thread-card, button, textarea, select')) return
  event.preventDefault()
  const origin = { x: event.clientX, y: event.clientY, camera: { ...state.canvasCamera } }
  let pendingCamera = null
  let frame = 0
  state.canvasGesture = true
  viewport.classList.add('is-panning')
  viewport.setPointerCapture(event.pointerId)
  const apply = () => {
    frame = 0
    if (pendingCamera === null) return
    state.canvasCamera = pendingCamera
    pendingCamera = null
    applyCanvasTransform()
    syncCanvasViewport()
  }
  const move = moveEvent => {
    pendingCamera = {
      x: origin.camera.x + moveEvent.clientX - origin.x,
      y: origin.camera.y + moveEvent.clientY - origin.y,
    }
    if (frame === 0) frame = window.requestAnimationFrame(apply)
  }
  const stop = () => {
    viewport.classList.remove('is-panning')
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', stop)
    document.removeEventListener('pointercancel', stop)
    if (frame !== 0) { window.cancelAnimationFrame(frame); frame = 0 }
    apply()
    state.canvasGesture = false
    deferCanvasRefresh(120)
  }
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', stop)
  document.addEventListener('pointercancel', stop)
})

app.addEventListener('wheel', event => {
  const viewport = canvasViewport(event.target)
  if (!(viewport instanceof HTMLElement)) return
  const card = event.target instanceof Element ? event.target.closest('.thread-card') : null
  if (card instanceof HTMLElement) {
    // Over a card the wheel scrolls that card's own answer with the browser's
    // native wheel (OS-smooth, never a page jump per notch); the answer's
    // overscroll-behavior: contain stops the scroll chaining into the canvas.
    const answer = card.querySelector('.thread-answer')
    if (answer instanceof HTMLElement && answer.scrollHeight > answer.clientHeight) {
      deferCanvasRefresh()
      return
    }
    // A card with no scrollable answer swallows the wheel instead of zooming.
    event.preventDefault()
    deferCanvasRefresh()
    return
  }
  event.preventDefault()
  zoomCanvas(viewport, state.zoom + (event.deltaY < 0 ? .05 : -.05), event.clientX, event.clientY)
}, { passive: false })

// Track pointer-down so the card click handler can tell a plain click from a
// text-selection or drag gesture; acting on the latter would re-render and
// wipe the user's selection.
let pointerDownPosition = null
app.addEventListener('pointerdown', event => {
  pointerDownPosition = { x: event.clientX, y: event.clientY }
  if (event.button !== 0) return
  state.pointerPressed = true
  if (event.target instanceof Element && !event.target.closest('.card-action-menu, [data-action="show-card-actions"]')) closeCardActionMenu()
})
// The browser fires click immediately after pointerup. Release on the next task
// so incoming subscriptions cannot replace its target during that event chain.
const releasePointer = () => window.setTimeout(() => {
  state.pointerPressed = false
  if (state.renderDeferred && canReplaceView()) render()
}, 0)
document.addEventListener('pointerup', releasePointer, true)
document.addEventListener('pointercancel', releasePointer, true)
app.addEventListener('pointerdown', event => {
  const button = event.target instanceof Element ? event.target.closest('.selection-followup') : null
  if (button instanceof HTMLButtonElement) event.preventDefault()
  else hideSelectionFollowup()
})
app.addEventListener('pointerup', queueSelectionFollowup)
app.addEventListener('scroll', hideSelectionFollowup, true)
document.addEventListener('selectionchange', queueSelectionFollowup)
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  if (state.actionMenuCardId !== null) { event.preventDefault(); closeCardActionMenu(); return }
  if (state.mode !== 'canvas' || state.inspectorCardId === null) return
  event.preventDefault()
  closeCardInspector({ animate: false })
})

app.addEventListener('click', async event => {
  state.pointerPressed = false
  const button = event.target instanceof Element ? event.target.closest('[data-action]') : null
  if (!(button instanceof HTMLElement)) {
    const card = event.target instanceof Element ? event.target.closest('.thread-card[data-thread]') : null
    if (!(card instanceof HTMLElement) || event.target instanceof Element && event.target.closest('.node-handle, textarea, select, form')) return
    // A double-click selects a word and a drag selects a range; neither is a
    // select-click, so leave the selection intact instead of re-rendering.
    if (event.detail > 1) return
    if (event.detail > 0 && pointerDownPosition !== null
      && Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y) > 4) return
    const thread = state.workspace?.threads.find(item => item.id === card.dataset.thread)
    if (thread === undefined) return
    const cardId = card.dataset.cardId
    if (cardId === undefined) return
    selectCanvasCard(cardId)
    return
  }
  const thread = state.workspace?.threads.find(item => item.id === button.dataset.thread)
  try {
    if (button.dataset.action === 'follow-selection') {
      const followup = selectionFollowup
      hideSelectionFollowup()
      if (followup !== null && thread !== undefined && thread.id === followup.threadId) await openContinue(thread, undefined, followup.text)
      return
    }
    if (button.dataset.action === 'show-card-actions' && button.dataset.card !== undefined) { openCardActionMenu(button.dataset.card); return }
    if (button.dataset.action === 'dismiss-notice') { state.notice = ''; updateComposeNotice(); return }
    if (button.dataset.action === 'close-card-inspector') { closeCardInspector(); return }
    if (button.dataset.action === 'show-thread' && thread !== undefined) {
      state.activeId = thread.id; state.mode = 'thread'; state.detailTargetCardId = button.dataset.card ?? null
      if (button.dataset.card !== undefined) { state.selectedCardId = button.dataset.card; state.inspectorCardId = button.dataset.card; state.inspectorOpening = false }
      render(); void loadThreadHistory(thread)
    }
    if (button.dataset.action === 'show-compare') { state.mode = 'compare'; render() }
    if (button.dataset.action === 'clear-compare') { state.compareCardIds = []; render() }
    if (button.dataset.action === 'toggle-compare' && button.dataset.card !== undefined) {
      const id = button.dataset.card
      state.compareCardIds = state.compareCardIds.includes(id) ? state.compareCardIds.filter(item => item !== id) : [...state.compareCardIds.slice(-1), id]
      render()
    }
    if (button.dataset.action === 'show-canvas') { state.mode = 'canvas'; render() }
    if (button.dataset.action === 'toggle-card-children' && button.dataset.card !== undefined) {
      const cardId = button.dataset.card
      const collapsing = !state.collapsedCardIds.has(cardId)
      if (collapsing && state.workspace !== null) {
        const allCards = conversationCards(state.workspace.threads)
        const nextCollapsed = new Set(state.collapsedCardIds).add(cardId)
        const visibleCards = conversationGraphView(allCards, nextCollapsed).cards
        const visibleIds = new Set(visibleCards.map(card => card.id))
        const nativeRoute = nativeCanvasRoute(allCards)
        if (nativeRoute.currentCardId !== null && !visibleIds.has(nativeRoute.currentCardId)
          || state.activeId !== null && !visibleCards.some(card => card.dshThreadId === state.activeId)) return setError(t('activeCollapsed'))
      }
      collapsing ? state.collapsedCardIds.add(cardId) : state.collapsedCardIds.delete(cardId)
      persistCollapsedCards()
      render()
      window.setTimeout(() => document.querySelector(`[data-action="toggle-card-children"][data-card="${selectorValue(cardId)}"]`)?.focus(), 0)
    }
    if (button.dataset.action === 'open-continue' && thread !== undefined) await openContinue(thread, button.dataset.card)
    if (button.dataset.action === 'open-branch' && thread !== undefined) {
      const requestedSeq = button.dataset.seq === undefined || button.dataset.seq === '' ? NaN : Number(button.dataset.seq)
      if (button.dataset.card !== undefined && !Number.isInteger(requestedSeq)) return setError(t('waitBranch'))
      const fallbackSeq = latestMessage(thread, 'assistant')?.sourceSeq
      await openBranch(thread, Number.isInteger(requestedSeq) ? requestedSeq : fallbackSeq, button.dataset.card)
    }
    if (button.dataset.action === 'toggle-message' && button.dataset.message !== undefined) { state.expandedMessageIds.has(button.dataset.message) ? state.expandedMessageIds.delete(button.dataset.message) : state.expandedMessageIds.add(button.dataset.message); renderPreservingDetailScroll() }
    if (button.dataset.action === 'open-dsh' && typeof thread?.dshSessionId === 'string') post('synapse:open-session', { sessionId: thread.dshSessionId, seq: button.dataset.seq !== undefined && button.dataset.seq !== '' && Number.isInteger(Number(button.dataset.seq)) ? Number(button.dataset.seq) : undefined })
    if (button.dataset.action === 'archive-thread' && thread !== undefined) await archiveThread(thread)
    if (button.dataset.action === 'zoom-in') zoomCanvasAtCenter(.1)
    if (button.dataset.action === 'zoom-out') zoomCanvasAtCenter(-.1)
    if (button.dataset.action === 'focus-active') focusActiveCard()
    if (button.dataset.action === 'dismiss-error') { state.error = ''; render() }
    if (button.dataset.action === 'layout' && state.workspace !== null) {
      resetCardPositions()
      resetCanvasCamera()
      render()
    }
  } catch (error) { setError(error) }
})

window.addEventListener('message', event => {
  if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.source !== 'dsh-synapse') return
  const data = event.data
  if (data.type === 'synapse:map-opened') {
    // Do NOT reset the camera here: toggling dialog<->map for the same
    // session must keep the user's viewport. A fresh canvas (canvasView
    // not initialized) still centers via renderCanvas; a real session switch
    // re-centers in the current-session handler below.
    render()
    window.requestAnimationFrame(() => post('synapse:map-ready'))
  }
  if (data.type === 'synapse:layout') {
    if (Number.isFinite(data.composerHeight) && data.composerHeight >= 0) {
      document.documentElement.style.setProperty('--map-composer-height', `${Math.min(window.innerHeight, data.composerHeight)}px`)
      queueLayoutReport()
      positionCardActionMenu()
    }
  }
  if (data.type === 'synapse:presentation') {
    const before = `${locale}|${document.documentElement.style.cssText}`
    locale = data.locale === 'en-US' ? 'en-US' : 'zh-CN'
    document.documentElement.lang = locale
    document.title = locale === 'en-US' ? 'DeepViewer Conversation Map' : 'DeepViewer 会话地图'
    const size = Number.isFinite(data.fontSize) ? Math.min(32, Math.max(10, data.fontSize)) : 14
    document.documentElement.style.setProperty('--map-font-size', `${size}px`)
    if (typeof data.fontFamily === 'string' && data.fontFamily.length < 500) document.documentElement.style.setProperty('--map-font-family', data.fontFamily)
    const tokens = data.tokens ?? {}
    for (const name of ['background', 'surface', 'text', 'muted', 'border', 'accent', 'hover', 'subtle', 'error']) {
      if (typeof tokens[name] === 'string' && CSS.supports('color', tokens[name])) document.documentElement.style.setProperty(`--map-${name}`, tokens[name])
    }
    if (before !== `${locale}|${document.documentElement.style.cssText}`) render()
  }
  if (data.type === 'synapse:theme') {
    document.documentElement.dataset.theme = data.dark === true ? 'dark' : 'light'
  }
  if (data.type === 'synapse:workspaces') {
    const previousWorkspaces = JSON.stringify(state.dshWorkspaces)
    state.dshWorkspaces = Array.isArray(data.workspaces) ? data.workspaces.filter(workspace => typeof workspace?.id === 'string' && typeof workspace.title === 'string' && Array.isArray(workspace.sessionIds)) : []
    if (previousWorkspaces === JSON.stringify(state.dshWorkspaces) && state.workspace !== null) return
    const current = currentDshWorkspace()
    if (current !== undefined && current.id !== state.selectedDshWorkspaceId) void openDshWorkspace(current.id).catch(setError)
    else if (state.selectedDshWorkspaceId !== null) void openDshWorkspace(state.selectedDshWorkspaceId).catch(setError)
    else if (canReplaceView()) render()
  }
  if (data.type === 'synapse:current-session') {
    const previousId = state.currentDsh?.id
    if (previousId === data.session?.id) { state.currentDsh = data.session; updateNativeCanvasRoute(); return }
    closeCardActionMenu()
    if (previousId !== undefined) persistViewState(previousId)
    const restored = restoreViewState(data.session?.id)
    state.currentDsh = data.session
    updateNativeCanvasRoute()
    if (typeof data.session?.id !== 'string') { state.workspace = null; state.activeId = null; state.selectedDshWorkspaceId = null; render(); return }
    const preserveCanvasCamera = restored
    const thread = currentDshThread()
    if (thread !== undefined) {
      const preserveSelectedCard = state.activeId === thread.id
      if (!restored) state.activeId = thread.id
      if (!preserveSelectedCard && !restored) {
        state.selectedCardId = null
        state.inspectorCardId = null
        state.inspectorOpening = false
      }
      if (state.workspace !== null) revealConversationThread(conversationCards(state.workspace.threads), thread.id)
    }
    if (previousId !== data.session?.id) {
      // A real session switch: re-center on the new session's latest turn,
      // whether it lives in the same workspace (openCurrentWorkspace returns
      // false) or a different one (it resets the camera itself).
      void openCurrentWorkspace({ preserveCanvasCamera }).then(async opened => {
        if (!opened && currentDshThread() === undefined) await refreshProjection({ force: true })
        if (!opened && canReplaceView()) {
          render()
          if (!preserveCanvasCamera) focusActiveCard()
        }
      }).catch(setError)
    }
    else if (canReplaceView()) render()
  }
  if (data.type === 'synapse:live-reply' && typeof data.sessionId === 'string') {
    const thread = state.workspace?.threads.find(item => item.dshSessionId === data.sessionId)
    if (thread !== undefined) {
      if (data.running === true) {
        state.liveReplies.set(data.sessionId, { running: true, text: typeof data.text === 'string' ? data.text : '', userSeq: Number.isSafeInteger(data.userSeq) ? data.userSeq : undefined })
        if (Number.isSafeInteger(data.userSeq) && !persistedMessagesFor(thread).some(message => message.kind === 'user' && message.sourceSeq === data.userSeq)) void refreshProjection({ force: true }).catch(setError)
        // Streaming: patch the live card's answer in place instead of
        // rebuilding the whole canvas on every chunk; a full render reconciles
        // at stream end. The detail view is single-thread, so keep its cheap
        // throttled full render.
        if (state.mode === 'canvas') scheduleLiveCardUpdate(data.sessionId)
        else if (canReplaceView()) scheduleLiveRender()
      } else {
        state.liveReplies.delete(data.sessionId)
        if (canReplaceView()) renderPreservingDetailScroll()
        void refreshProjection({ force: true }).catch(setError)
      }
    }
  }
  if (data.type === 'synapse:composed') settleRpc(data.requestId, data.session ?? data)
  if (data.type === 'synapse:api-result') settleRpc(data.requestId, data.value)
  if (data.type === 'synapse:bridge-error') { settleRpc(data.requestId, undefined, new Error(data.message)); if (data.requestId === undefined) setError(data.message) }
})

post('synapse:request-current')
refreshSummaries().catch(setError)
let polling = false
let liveRenderTimer = 0
let liveCardFrame = 0
let liveCardSessionId = null
function scheduleLiveCardUpdate(sessionId) {
  // Coalesce streaming chunks to one DOM patch per animation frame.
  liveCardSessionId = sessionId
  if (liveCardFrame !== 0) return
  liveCardFrame = window.requestAnimationFrame(() => {
    liveCardFrame = 0
    if (liveCardSessionId === null) return
    const id = liveCardSessionId
    liveCardSessionId = null
    applyLiveReplyToCard(id)
  })
}
function applyLiveReplyToCard(sessionId) {
  if (state.mode !== 'canvas' || state.dragging || state.canvasGesture) return
  const thread = state.workspace?.threads.find(item => item.dshSessionId === sessionId)
  const live = state.liveReplies.get(sessionId)
  if (thread === undefined || live?.running !== true || !Number.isSafeInteger(live.userSeq)) return
  updateNativeCanvasRoute()
  const dataCard = state.canvasCards?.find(card => card.dshThreadId === thread.id && card.sourceSeq === live.userSeq)
  if (dataCard === undefined) return
  const card = app.querySelector(`.thread-card[data-card-id="${CSS.escape(dataCard.id)}"]`)
  const answer = card?.querySelector('.thread-answer')
  const markup = `${live.text.trim() === '' ? '' : renderMarkdown(live.text)}<p class="thread-answer-pending">${t('replying')}</p>`
  if (answer instanceof HTMLElement) answer.innerHTML = markup
  // Details follows only its selected turn; a later turn must not replace an older answer.
  if (state.inspectorCardId === dataCard.id) {
    const inspector = app.querySelector('.card-inspector-scroll')
    const current = inspector?.querySelector('.card-inspector-answer, .card-inspector-pending')
    if (current instanceof HTMLElement) {
      const scroll = inspector.scrollTop
      current.outerHTML = `<article class="card-inspector-answer">${markup}</article>`
      inspector.scrollTop = scroll
    }
  }
}
function scheduleLiveRender() {
  if (liveRenderTimer !== 0 || !canReplaceView()) return
  liveRenderTimer = window.setTimeout(() => {
    liveRenderTimer = 0
    if (canReplaceView()) renderPreservingDetailScroll()
  }, 120)
}
async function pollProjection() {
  if (polling || document.hidden || !canReplaceView()) return
  polling = true
  try {
    await refreshProjection()
  } finally { polling = false }
}
window.setInterval(() => { void pollProjection() }, 1_000)
