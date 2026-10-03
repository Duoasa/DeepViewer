import './styles.css'
import type { RuntimeStatusView } from '../shared/runtime-status.js'
import lightIcon from '../../assets/deepviewer-icon-macos26-1024.png'
import darkIcon from '../../assets/deepviewer-icon-dark-1024.png'
import { DEEPVIEWER_LAUNCH_LOCKUP_HTML } from '../shared/launch-brand.js'

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) throw new Error(`DeepViewer launch surface is missing ${selector}`)
  return element
}

const launch = requiredElement<HTMLElement>('#launch')
const label = requiredElement<HTMLElement>('#status-label')
const detail = requiredElement<HTMLElement>('#status-detail')
const failurePanel = requiredElement<HTMLElement>('#failure-panel')
const actions = requiredElement<HTMLElement>('#actions')
const retry = requiredElement<HTMLButtonElement>('#retry')
const logs = requiredElement<HTMLButtonElement>('#logs')

requiredElement<HTMLElement>('#brand-lockup').innerHTML = DEEPVIEWER_LAUNCH_LOCKUP_HTML
  .replace('__DEEPVIEWER_ICON_LIGHT__', lightIcon)
  .replace('__DEEPVIEWER_ICON_DARK__', darkIcon)

function render(status: RuntimeStatusView): void {
  launch.dataset.phase = status.phase
  launch.setAttribute('aria-busy', String(status.phase !== 'failed' && status.phase !== 'stopped'))
  failurePanel.hidden = true
  actions.hidden = true

  switch (status.phase) {
    case 'stopped':
      label.textContent = '工作区已关闭'
      detail.textContent = ''
      break
    case 'starting':
      label.textContent = status.attempt > 1 ? '正在重新打开工作区' : '正在打开你的工作区'
      detail.textContent = ''
      break
    case 'ready':
      label.textContent = '准备好了，即将进入'
      detail.textContent = ''
      break
    case 'stopping':
      label.textContent = '正在安全退出'
      detail.textContent = ''
      break
    case 'failed':
      label.textContent = '启动未完成'
      detail.textContent = status.userMessage ?? '请重新打开。如果仍然无法进入，可以查看日志了解原因。'
      failurePanel.hidden = false
      actions.hidden = false
      break
  }

}

retry.addEventListener('click', () => {
  retry.disabled = true
  void window.deepviewerDesktop.retryRuntime().catch(() => {
    render({ phase: 'failed', attempt: 0, changedAt: new Date().toISOString(),
      userMessage: '重新打开未成功，请稍后再试或查看日志。' })
  }).finally(() => {
    retry.disabled = false
  })
})
logs.addEventListener('click', () => {
  void window.deepviewerDesktop.openLogDirectory().catch(() => {
    detail.textContent = '暂时无法打开日志目录，请稍后再试。'
  })
})

window.deepviewerDesktop.onRuntimeStatus(render)
void window.deepviewerDesktop.getRuntimeStatus().then(render).catch(() => {
  render({ phase: 'failed', attempt: 0, changedAt: new Date().toISOString(),
    userMessage: '未能获取启动状态，请重新打开工作区。' })
})
