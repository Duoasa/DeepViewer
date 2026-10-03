import { registerSynapseView } from './SynapseView.tsx'
import typographyCss from './typography.css?inline'
import synapseLayoutCss from './synapse-layout.css?inline'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-settings-general/client'
import aboutCss from './about.module.css'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { PropsRuntime, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { EditorPanel, GitPanel, WorkspacePanelTitle } from './WorkspacePanels.tsx'
import { createEditorStore } from './editor-store.ts'
import { buildInfo } from './build-info.ts'
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' { interface SidebarRightTabParamsMap { 'deepviewer-editor': { path: string } } }
import { zh, en } from './locales.ts'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { ModeSwitch } from './ModeSwitch.tsx'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { Context } from '@deepseek-ai/cordis'
import { DeepViewerMascot } from './DeepViewerMascot.tsx'
import css from './welcome.module.css'
import cssText from './welcome.module.css?inline'

export const inject = ['slots', 'locale', 'theme', 'uiWorkspace', 'sessions', 'workspaces', 'sidebarRight', 'sidebarRightTabs', 'connection', 'conversation', 'uiConversation']

export function apply(ctx: Context): void {
  registerSynapseView(ctx)
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.deepviewer = 'adapter'
    style.textContent = typographyCss + '\n' + cssText + '\n' + synapseLayoutCss
    document.head.append(style)
    return () => style.remove()
  })
  const themeSource: ObservableSnapshot<ThemeSnapshot> = {
    getSnapshot: () => ctx.theme.getTheme(),
    subscribe: listener => { const off = ctx.on('theme/change', listener); return () => { off() } },
  }
  type ThemeInjected = { hooks: { deepviewerTheme: ObservableSnapshot<ThemeSnapshot> } }
  function BrandMark({ useDeepviewerTheme }: InjectFace<ThemeInjected>) {
    const theme = useDeepviewerTheme(snapshot => snapshot)
    return <img className={css.brandMark} src={`/assets/deepviewer/icon-${theme.active.colorScheme}.png`} alt="" />
  }
  function BrandName() { return <span className={css.brandName}>DeepViewer</span> }
  ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({ name: 'sidebar.brand.mark', inject: () => ({ hooks: { deepviewerTheme: themeSource } }) }, BrandMark))
  ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({ name: 'sidebar.brand.name' }, BrandName))
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({ name: 'conversation.hero.brand.mark' }, DeepViewerMascot))
  function About({ useDeepviewerTheme, t }: InjectFace<ThemeInjected> & PropsLocale<'deepviewer'>) {
    const theme = useDeepviewerTheme(snapshot => snapshot)
    return <div className={aboutCss.root} data-deepviewer-about="">
      <img className={aboutCss.icon} alt="" src={`/assets/deepviewer/icon-${theme.active.colorScheme}.png`} />
      <div className={aboutCss.identity}><h2 className={aboutCss.name}>DeepViewer</h2><p className={aboutCss.version}>{t('version', { version: `${buildInfo.version} (${buildInfo.build})` })}</p></div>
      <div className={aboutCss.coreSection}><div className={aboutCss.coreRow}><div className={aboutCss.coreCopy}><p className={aboutCss.coreName}>DeepSeek Harness</p><p className={aboutCss.coreDescription}>{t('coreDescription')}</p></div><span className={aboutCss.coreVersion}>{buildInfo.kernel}</span></div></div>
    </div>
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'about', order: 100, label: () => ctx.locale.bind('deepviewer')('about'), locale: 'deepviewer', inject: () => ({ hooks: { deepviewerTheme: themeSource } }) }, About))
  ctx.effect(() => ctx.locale.register('deepviewer', { zh, en }))
  const sessions = ctx.get('sessions') as ISessions
  const workspaces = ctx.get('workspaces') as IWorkspaces
  const change = async (mode: 'work' | 'chat') => {
    if (mode === 'chat') ctx.uiWorkspace.openSession(await sessions.create({ agentPreset: 'deepviewer-chat' }))
    else {
      const workspace = workspaces.list.getSnapshot().items[0]
      if (workspace) await ctx.uiWorkspace.openWorkspace(workspace.workspaceId)
      else ctx.uiWorkspace.openSession(await sessions.create({ agentPreset: 'standard' }))
    }
  }
  ctx.slots.inject('sidebar.mode', () => ctx.slots.register({ name: 'sidebar.mode', locale: 'deepviewer', inject: () => ({ change }) }, ModeSwitch))
  const connection = ctx.get('connection') as ConnectionHandle
  const call = async (sessionId: string, method: string, payload: Record<string, unknown> = {}) => {
    const result = await connection.rpc.call('/deepviewer-workspace', method, { ...payload, sessionId })
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const text = ctx.locale.bind('deepviewer'), editorStore = createEditorStore()
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: '@deepviewer/editor', kind: 'deepviewer-editor', keepMounted: true, title: () => text('editor') }))
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: '@deepviewer/git', kind: 'deepviewer-git', keepMounted: true, title: () => 'Git', guide: [{ id: 'deepviewer-git', order: 20, title: () => 'Git', description: () => text('gitDescription') }] }))
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: '@deepviewer/editor', store: editorStore, locale: 'deepviewer', inject: () => ({ call }) }, EditorPanel))
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: '@deepviewer/git', locale: 'deepviewer', inject: () => ({ call }) }, GitPanel))
  for (const key of ['@deepviewer/editor', '@deepviewer/git']) ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key }, WorkspacePanelTitle))
  function EditAction({ absolutePath, t }: PropsRuntime<'sidebar.right.tab.document.actions'> & PropsLocale<'deepviewer'>) { return <Button size="sm" variant="ghost" className={css.editAction} onClick={event => {
    const target = ctx.sidebarRight.commandTarget(event.currentTarget)
    if (target && ctx.sidebarRight.isTargetCurrent(target)) ctx.sidebarRight.openTab('deepviewer-editor', { paneId: target.paneId, params: { path: absolutePath } })
  }}>{t('editor')}</Button> }
  ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({ name: 'sidebar.right.tab.document.actions', id: 'deepviewer-edit', locale: 'deepviewer' }, EditAction))
}
