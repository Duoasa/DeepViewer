import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  CodeBlock,
  IconChevronDownOutline14,
  IconChevronLeftOutline14,
  IconChevronRightOutline14,
  IconCodeOutline16,
  IconFolderClose16,
  IconFolderOpenOutline16,
  IconGlobeOutline14,
  IconPanelLeftOutline16,
  IconRefreshOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ExternalLinkIcon } from './ExternalLinkIcon.tsx'
import { NS } from './locales.ts'
import {
  previewOpenRequests,
  previewParentDirectories,
  workspaceRelativePreviewPath,
} from './preview-open.ts'
import { clampPreviewTreeHeight } from './preview-layout.ts'
import {
  externalPreviewUrl,
  parsePreviewBrowserLocation,
  PREVIEW_BROWSER_MESSAGE_SOURCE,
  previewDisplayAddress,
  previewSiteRoot,
  resolvePreviewAddress,
  updatePreviewBrowserState,
} from './preview-browser.ts'
import type { PreviewBrowserState } from './preview-browser.ts'
import css from './PreviewPanel.module.css'

export type PreviewRequest = (
  endpoint: 'list' | 'read' | 'site',
  payload: { workspaceId: string; path: string },
  signal?: AbortSignal,
) => Promise<unknown>

interface PreviewEntry {
  readonly name: string
  readonly path: string
  readonly kind: 'file' | 'directory'
}

interface PreviewFile {
  readonly path: string
  readonly content: string
  readonly size: number
  readonly mtimeMs: number
  readonly language: string
}

interface TreeResizeDrag {
  readonly pointerId: number
  readonly startY: number
  readonly startHeight: number
  readonly availableHeight: number
}

interface PreviewPanelInjected {
  readonly request: PreviewRequest
}

interface PreviewActionInjected {
  readonly togglePreview: () => void
}

export type PreviewPanelProps = PropsRuntime<'conversation.details.view'>
  & PropsLocale<typeof NS> & PreviewPanelInjected

export type PreviewActionProps = PropsRuntime<'shell.overlay'>
  & PropsLocale<typeof NS> & PreviewActionInjected

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isHtml(path: string | null): boolean {
  return path !== null && /\.html?$/iu.test(path)
}

function deliverablesRevision(snapshot: ConversationSnapshot): number {
  let revision = 0
  for (const turn of snapshot.chat.timeline.turnOrder) {
    const location = snapshot.chat.timeline.turns.get(turn)
    const data = (location?.data as unknown as { get(key: string): unknown } | undefined)?.get('deliverables')
    const produced = (data as { produced?: readonly { seq?: unknown }[] } | undefined)?.produced ?? []
    for (const item of produced) {
      if (typeof item.seq === 'number') revision = Math.max(revision, item.seq)
    }
  }
  return revision
}

export function PreviewAction({ togglePreview, t, useSessions }: PreviewActionProps) {
  const hasSession = useSessions(state => {
    const current = state.current
    return current !== undefined && state.byId[current]?.blank === false
  })
  return (
    <button
      type="button"
      className={css.headerAction}
      disabled={!hasSession}
      onClick={togglePreview}
      aria-label={t('toggle')}
      title={t('toggle')}
    >
      <IconPanelLeftOutline16 className={css.previewPanelIcon} size={16} />
    </button>
  )
}

interface TreeRowsProps {
  readonly parent: string
  readonly depth: number
  readonly entries: ReadonlyMap<string, readonly PreviewEntry[]>
  readonly expanded: ReadonlySet<string>
  readonly selected: string | null
  readonly onDirectory: (path: string) => void
  readonly onFile: (path: string) => void
}

function TreeRows({ parent, depth, entries, expanded, selected, onDirectory, onFile }: TreeRowsProps) {
  const children = entries.get(parent) ?? []
  return children.map(entry => {
    const open = entry.kind === 'directory' && expanded.has(entry.path)
    return (
      <div key={entry.path}>
        <button
          type="button"
          className={entry.path === selected ? `${css.fileRow} ${css.fileRowSelected}` : css.fileRow}
          style={{ paddingInlineStart: 10 + depth * 14 }}
          onClick={() => { entry.kind === 'directory' ? onDirectory(entry.path) : onFile(entry.path) }}
          title={entry.path}
        >
          {entry.kind === 'directory'
            ? open ? <IconChevronDownOutline14 size={12} /> : <IconChevronRightOutline14 size={12} />
            : <span className={css.fileSpacer} />}
          {entry.kind === 'directory'
            ? open ? <IconFolderOpenOutline16 size={14} /> : <IconFolderClose16 size={14} />
            : <IconCodeOutline16 size={14} />}
          <span className={css.fileName}>{entry.name}</span>
        </button>
        {open && (
          <TreeRows
            parent={entry.path}
            depth={depth + 1}
            entries={entries}
            expanded={expanded}
            selected={selected}
            onDirectory={onDirectory}
            onFile={onFile}
          />
        )}
      </div>
    )
  })
}

export function PreviewPanel({
  sessionId, useSession, useSessions, useWorkspaces, request, t,
}: PreviewPanelProps) {
  const cwd = useSessions(state => state.byId[sessionId]?.cwd)
  const workspace = useWorkspaces(state => state.items.find(item =>
    item.sessionIds.includes(sessionId) || (cwd !== undefined && item.path === cwd)))
  const workspaceId = workspace === undefined ? undefined : String(workspace.workspaceId)
  const revision = useSession(deliverablesRevision)
  const openRequest = useSyncExternalStore(
    previewOpenRequests.subscribe,
    previewOpenRequests.getSnapshot,
    previewOpenRequests.getSnapshot,
  )

  const [entries, setEntries] = useState<ReadonlyMap<string, readonly PreviewEntry[]>>(() => new Map())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [file, setFile] = useState<PreviewFile | null>(null)
  const [mode, setMode] = useState<'code' | 'web'>('code')
  const [siteUrl, setSiteUrl] = useState<string | null>(null)
  const [siteRootUrl, setSiteRootUrl] = useState<string | null>(null)
  const [browserAddress, setBrowserAddress] = useState('')
  const [browserState, setBrowserState] = useState<PreviewBrowserState>({ entries: [], index: -1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filesCollapsed, setFilesCollapsed] = useState(false)
  const [treeHeight, setTreeHeight] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const lastRevision = useRef(revision)
  const handledOpenRequest = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const fileHeaderRef = useRef<HTMLButtonElement>(null)
  const filePathRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const resizeDrag = useRef<TreeResizeDrag | null>(null)
  const pendingBrowserIndex = useRef<number | null>(null)

  const availableSectionHeight = useCallback((): number => {
    const panel = panelRef.current
    const toolbar = toolbarRef.current
    const fileHeader = fileHeaderRef.current
    const filePath = filePathRef.current
    if (panel === null || toolbar === null || fileHeader === null || filePath === null) return 0
    return Math.max(
      0,
      panel.getBoundingClientRect().height
        - toolbar.getBoundingClientRect().height
        - fileHeader.getBoundingClientRect().height
        - filePath.getBoundingClientRect().height,
    )
  }, [])

  const beginTreeResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || filesCollapsed || treeRef.current === null) return
    resizeDrag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: treeRef.current.getBoundingClientRect().height,
      availableHeight: availableSectionHeight(),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    setResizing(true)
  }, [availableSectionHeight, filesCollapsed])

  const moveTreeResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = resizeDrag.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    setTreeHeight(clampPreviewTreeHeight(
      drag.startHeight + event.clientY - drag.startY,
      drag.availableHeight,
    ))
  }, [])

  const endTreeResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (resizeDrag.current?.pointerId !== event.pointerId) return
    resizeDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setResizing(false)
  }, [])

  const resizeTreeWithKeyboard = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (filesCollapsed || treeRef.current === null) return
    const availableHeight = availableSectionHeight()
    const currentHeight = treeRef.current.getBoundingClientRect().height
    let nextHeight: number | undefined
    if (event.key === 'ArrowUp') nextHeight = currentHeight - 16
    if (event.key === 'ArrowDown') nextHeight = currentHeight + 16
    if (event.key === 'Home') nextHeight = 0
    if (event.key === 'End') nextHeight = availableHeight
    if (nextHeight === undefined) return
    event.preventDefault()
    setTreeHeight(clampPreviewTreeHeight(nextHeight, availableHeight))
  }, [availableSectionHeight, filesCollapsed])

  useEffect(() => {
    const panel = panelRef.current
    if (panel === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (filesCollapsed) return
      setTreeHeight(current => current === null
        ? null
        : clampPreviewTreeHeight(current, availableSectionHeight()))
    })
    observer.observe(panel)
    return () => { observer.disconnect() }
  }, [availableSectionHeight, filesCollapsed, workspaceId])

  const listDirectory = useCallback(async (path: string, force = false): Promise<readonly PreviewEntry[]> => {
    if (workspaceId === undefined) return []
    if (!force) {
      const cached = entries.get(path)
      if (cached !== undefined) return cached
    }
    const value = await request('list', { workspaceId, path }) as { entries: PreviewEntry[] }
    setEntries(current => {
      const next = new Map(current)
      next.set(path, value.entries)
      return next
    })
    return value.entries
  }, [entries, request, workspaceId])

  const readSelected = useCallback(async (): Promise<void> => {
    if (workspaceId === undefined || selected === null) return
    setLoading(true)
    try {
      const value = await request('read', { workspaceId, path: selected }) as PreviewFile
      setFile(value)
      setError(null)
    } catch (nextError) {
      setFile(null)
      setError(errorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }, [request, selected, workspaceId])

  const loadSite = useCallback(async (): Promise<void> => {
    if (workspaceId === undefined || !isHtml(selected)) return
    setLoading(true)
    try {
      const value = await request('site', { workspaceId, path: selected ?? '' }) as { url: string }
      const nextUrl = `${value.url}${value.url.includes('?') ? '&' : '?'}refresh=${Date.now()}`
      setSiteUrl(nextUrl)
      setSiteRootUrl(previewSiteRoot(nextUrl, window.location.href) ?? null)
      setBrowserAddress(selected ?? '')
      setBrowserState({ entries: [], index: -1 })
      pendingBrowserIndex.current = null
      setError(null)
    } catch (nextError) {
      setSiteUrl(null)
      setError(errorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }, [request, selected, workspaceId])

  useEffect(() => {
    setEntries(new Map())
    setExpanded(new Set())
    setSelected(null)
    setFile(null)
    setSiteUrl(null)
    setSiteRootUrl(null)
    setBrowserAddress('')
    setBrowserState({ entries: [], index: -1 })
    pendingBrowserIndex.current = null
    setMode('code')
    setError(null)
    if (workspaceId === undefined) return
    let active = true
    setLoading(true)
    void request('list', { workspaceId, path: '' })
      .then((raw) => {
        if (!active) return
        const root = (raw as { entries: PreviewEntry[] }).entries
        setEntries(new Map([['', root]]))
        const first = root.find(entry => entry.kind === 'file' && /^index\.html?$/iu.test(entry.name))
          ?? root.find(entry => entry.kind === 'file')
        if (first !== undefined) setSelected(current => current ?? first.path)
        setError(null)
      })
      .catch(nextError => { if (active) setError(errorMessage(nextError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request, workspaceId])

  useEffect(() => {
    if (openRequest.revision === 0 || handledOpenRequest.current === openRequest.revision) return
    const path = workspaceRelativePreviewPath(cwd, openRequest.absolutePath)
    if (path === undefined) return
    handledOpenRequest.current = openRequest.revision
    const directories = previewParentDirectories(path)
    setExpanded(current => {
      const next = new Set(current)
      for (const directory of directories) if (directory !== '') next.add(directory)
      return next
    })
    setSelected(path)
    setMode(isHtml(path) ? 'web' : 'code')
    void Promise.all(directories.map(directory => listDirectory(directory).catch(() => [])))
  }, [cwd, listDirectory, openRequest])

  useEffect(() => {
    if (selected === null) return
    if (mode === 'code') void readSelected()
    else if (isHtml(selected)) void loadSite()
  }, [loadSite, mode, readSelected, selected])

  const refresh = useCallback(async (): Promise<void> => {
    if (workspaceId === undefined) return
    const directories = ['', ...expanded]
    await Promise.all(directories.map(path => listDirectory(path, true).catch(() => [])))
    if (mode === 'web' && isHtml(selected)) await loadSite()
    else await readSelected()
  }, [expanded, listDirectory, loadSite, mode, readSelected, selected, workspaceId])

  useEffect(() => {
    if (revision === lastRevision.current) return
    lastRevision.current = revision
    const timer = window.setTimeout(() => { void refresh() }, 250)
    return () => { window.clearTimeout(timer) }
  }, [refresh, revision])

  useEffect(() => {
    const receiveLocation = (event: MessageEvent<unknown>): void => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const location = parsePreviewBrowserLocation(event.data)
      if (location === undefined) return
      const pendingIndex = pendingBrowserIndex.current
      pendingBrowserIndex.current = null
      setBrowserState(current => updatePreviewBrowserState(current, location, pendingIndex))
      setBrowserAddress(previewDisplayAddress(location.href))
    }
    window.addEventListener('message', receiveLocation)
    return () => { window.removeEventListener('message', receiveLocation) }
  }, [])

  const sendBrowserCommand = useCallback((command: 'back' | 'forward' | 'reload'): void => {
    iframeRef.current?.contentWindow?.postMessage({
      source: PREVIEW_BROWSER_MESSAGE_SOURCE,
      type: 'command',
      command,
    }, '*')
  }, [])

  const navigateBrowserHistory = useCallback((delta: -1 | 1): void => {
    const nextIndex = browserState.index + delta
    if (nextIndex < 0 || nextIndex >= browserState.entries.length) return
    pendingBrowserIndex.current = nextIndex
    sendBrowserCommand(delta === -1 ? 'back' : 'forward')
  }, [browserState, sendBrowserCommand])

  const navigateBrowserAddress = useCallback((): void => {
    if (siteRootUrl === null) return
    const target = resolvePreviewAddress(siteRootUrl, browserAddress, window.location.href)
    if (target === undefined) {
      const current = browserState.entries[browserState.index]
      setBrowserAddress(current === undefined ? selected ?? '' : previewDisplayAddress(current.href))
      return
    }
    setSiteUrl(target)
  }, [browserAddress, browserState, selected, siteRootUrl])

  const openBrowserPreview = useCallback((): void => {
    const current = browserState.entries[browserState.index]?.href ?? siteUrl
    if (current === null) return
    const target = externalPreviewUrl(current, window.location.href)
    if (target !== undefined) window.open(target, '_blank', 'noopener,noreferrer')
  }, [browserState, siteUrl])

  const toggleDirectory = useCallback((path: string) => {
    if (expanded.has(path)) {
      setExpanded(current => {
        const next = new Set(current)
        next.delete(path)
        return next
      })
      return
    }
    setExpanded(current => new Set(current).add(path))
    void listDirectory(path).catch(nextError => { setError(errorMessage(nextError)) })
  }, [expanded, listDirectory])

  const rootEntries = entries.get('') ?? []
  const hasWeb = isHtml(selected)
  const fileTitle = useMemo(() => selected ?? t('empty'), [selected, t])
  const browserLocation = browserState.entries[browserState.index]
  const browserTitle = browserLocation?.title.trim() || selected?.split('/').at(-1) || t('webPreview')
  const canGoBack = browserState.index > 0
  const canGoForward = browserState.index >= 0 && browserState.index < browserState.entries.length - 1
  const panelStyle = treeHeight === null
    ? undefined
    : { '--deepviewer-preview-tree-height': `${treeHeight}px` } as CSSProperties

  if (workspaceId === undefined) return <div className={css.centerMessage}>{t('noWorkspace')}</div>

  return (
    <div
      ref={panelRef}
      className={css.panel}
      data-files-collapsed={filesCollapsed || undefined}
      data-resizing={resizing || undefined}
      style={panelStyle}
    >
      <div ref={toolbarRef} className={css.toolbar}>
        <div className={css.modeSwitch}>
          <button
            type="button"
            className={mode === 'code' ? `${css.modeButton} ${css.modeButtonActive}` : css.modeButton}
            onClick={() => { setMode('code') }}
          >
            <IconCodeOutline16 size={14} />{t('code')}
          </button>
          <button
            type="button"
            className={mode === 'web' ? `${css.modeButton} ${css.modeButtonActive}` : css.modeButton}
            disabled={!hasWeb}
            onClick={() => { setMode('web') }}
          >
            <IconGlobeOutline14 size={14} />{t('web')}
          </button>
        </div>
        <button type="button" className={css.iconButton} onClick={() => { void refresh() }} title={t('refresh')}>
          <IconRefreshOutline16 size={15} />
        </button>
      </div>

      <button
        ref={fileHeaderRef}
        type="button"
        className={css.sectionHeader}
        aria-expanded={!filesCollapsed}
        aria-label={filesCollapsed ? t('expandFiles') : t('collapseFiles')}
        title={filesCollapsed ? t('expandFiles') : t('collapseFiles')}
        onClick={() => { setFilesCollapsed(current => !current) }}
      >
        <span className={css.sectionTitle}>{t('files')}</span>
        <span className={css.sectionToggle} aria-hidden="true">
          {filesCollapsed
            ? <IconChevronRightOutline14 size={14} />
            : <IconChevronDownOutline14 size={14} />}
        </span>
      </button>
      <div
        ref={filePathRef}
        className={filesCollapsed ? `${css.filePath} ${css.filePathCollapsed}` : css.filePath}
        aria-hidden={filesCollapsed || undefined}
        title={fileTitle}
      >
        {!filesCollapsed && fileTitle}
      </div>
      <div
        ref={treeRef}
        className={filesCollapsed ? `${css.tree} ${css.treeCollapsed}` : css.tree}
        aria-hidden={filesCollapsed || undefined}
      >
        {!filesCollapsed && (rootEntries.length === 0 && !loading
          ? <div className={css.treeEmpty}>{t('noFiles')}</div>
          : (
            <TreeRows
              parent=""
              depth={0}
              entries={entries}
              expanded={expanded}
              selected={selected}
              onDirectory={toggleDirectory}
              onFile={(path) => { setSelected(path); if (!isHtml(path)) setMode('code') }}
            />
          ))}
      </div>

      <div className={css.previewBody}>
        {error !== null && <div className={css.error}>{t('error', { message: error })}</div>}
        {loading && file === null && siteUrl === null && <div className={css.centerMessage}>{t('loading')}</div>}
        {!loading && error === null && selected === null && <div className={css.centerMessage}>{t('empty')}</div>}
        {mode === 'code' && file !== null && (
          <>
            {!filesCollapsed && (
              <div
                className={css.codeHeaderResize}
                data-deepviewer-preview-resize
                role="separator"
                aria-label={t('resizeSections')}
                aria-orientation="horizontal"
                tabIndex={0}
                title={t('resizeSections')}
                onDoubleClick={() => { setTreeHeight(null) }}
                onKeyDown={resizeTreeWithKeyboard}
                onPointerDown={beginTreeResize}
                onPointerMove={moveTreeResize}
                onPointerUp={endTreeResize}
                onPointerCancel={endTreeResize}
                onLostPointerCapture={endTreeResize}
              />
            )}
            <CodeBlock
              className={css.code}
              code={file.content}
              lang={file.language}
              copyLabel={t('copy')}
              copiedLabel={t('copied')}
            />
          </>
        )}
        {mode === 'web' && !hasWeb && <div className={css.centerMessage}>{t('webHint')}</div>}
        {mode === 'web' && hasWeb && siteUrl !== null && (
          <div className={css.webSurface}>
            <div
              className={css.webTitleResize}
              data-deepviewer-preview-resize
              role="separator"
              aria-label={t('resizeSections')}
              aria-orientation="horizontal"
              aria-disabled={filesCollapsed || undefined}
              tabIndex={filesCollapsed ? -1 : 0}
              title={filesCollapsed ? browserTitle : t('resizeSections')}
              onDoubleClick={() => { if (!filesCollapsed) setTreeHeight(null) }}
              onKeyDown={resizeTreeWithKeyboard}
              onPointerDown={beginTreeResize}
              onPointerMove={moveTreeResize}
              onPointerUp={endTreeResize}
              onPointerCancel={endTreeResize}
              onLostPointerCapture={endTreeResize}
            >
              <IconGlobeOutline14 size={14} />
              <span>{browserTitle}</span>
            </div>
            <form
              className={css.browserToolbar}
              onSubmit={(event) => { event.preventDefault(); navigateBrowserAddress() }}
            >
              <button
                type="button"
                className={css.browserButton}
                disabled={!canGoBack}
                title={t('back')}
                aria-label={t('back')}
                onClick={() => { navigateBrowserHistory(-1) }}
              >
                <IconChevronLeftOutline14 size={15} />
              </button>
              <button
                type="button"
                className={css.browserButton}
                disabled={!canGoForward}
                title={t('forward')}
                aria-label={t('forward')}
                onClick={() => { navigateBrowserHistory(1) }}
              >
                <IconChevronRightOutline14 size={15} />
              </button>
              <button
                type="button"
                className={css.browserButton}
                title={t('reloadPage')}
                aria-label={t('reloadPage')}
                onClick={() => { sendBrowserCommand('reload') }}
              >
                <IconRefreshOutline16 size={15} />
              </button>
              <input
                className={css.browserAddress}
                value={browserAddress}
                aria-label={t('address')}
                title={t('addressHint')}
                spellCheck={false}
                onChange={(event) => { setBrowserAddress(event.target.value) }}
              />
              <button
                type="button"
                className={css.browserButton}
                title={t('openExternal')}
                aria-label={t('openExternal')}
                onClick={openBrowserPreview}
              >
                <ExternalLinkIcon size={20} />
              </button>
            </form>
            <iframe
              ref={iframeRef}
              key={siteRootUrl}
              className={css.iframe}
              src={siteUrl}
              title={t('iframeTitle')}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>
    </div>
  )
}
