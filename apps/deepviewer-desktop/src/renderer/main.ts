import './styles.css'
import type { RuntimeStatusView } from '../shared/runtime-status.js'
import deepViewerLoadingLogo from './assets/deepviewer-loading-logo.svg?raw'

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) throw new Error(`DeepViewer launch surface is missing ${selector}`)
  return element
}

function installLogo(): void {
  const parsed = new DOMParser().parseFromString(deepViewerLoadingLogo, 'image/svg+xml')
  const source = parsed.documentElement
  if (source.localName !== 'svg' || parsed.querySelector('parsererror') !== null) {
    throw new Error('DeepViewer loading logo is not valid SVG')
  }

  const logo = document.importNode(source, true)
  logo.removeAttribute('style')
  logo.setAttribute('aria-hidden', 'true')
  logo.setAttribute('focusable', 'false')
  const cursorLine = logo.querySelector('#Vector_2')
  if (cursorLine === null) throw new Error('DeepViewer loading logo is missing its cursor line')
  cursorLine.setAttribute('data-deepviewer-cursor-line', '')
  requiredElement<HTMLElement>('#brand-logo').append(logo)
}

const launch = requiredElement<HTMLElement>('#launch')
const label = requiredElement<HTMLElement>('#status-label')
const detail = requiredElement<HTMLElement>('#status-detail')
const accessibleStatus = requiredElement<HTMLElement>('#accessible-status')
const failurePanel = requiredElement<HTMLElement>('#failure-panel')
const actions = requiredElement<HTMLElement>('#actions')
const retry = requiredElement<HTMLButtonElement>('#retry')
const logs = requiredElement<HTMLButtonElement>('#logs')

installLogo()

function render(status: RuntimeStatusView): void {
  launch.dataset.phase = status.phase
  launch.setAttribute('aria-busy', String(status.phase !== 'failed' && status.phase !== 'stopped'))
  failurePanel.hidden = true
  actions.hidden = true

  switch (status.phase) {
    case 'stopped':
      label.textContent = '本地 Runtime 已停止'
      detail.textContent = '正在等待下一次启动。'
      break
    case 'starting':
      label.textContent = '正在启动 Harness'
      detail.textContent = `启动尝试 ${String(status.attempt)}，完成后将自动进入工作区。`
      break
    case 'ready':
      label.textContent = 'Harness 已就绪'
      detail.textContent = '正在打开 DeepViewer 工作区。'
      break
    case 'stopping':
      label.textContent = '正在安全退出'
      detail.textContent = '正在回收 Harness 和它启动的子进程。'
      break
    case 'failed':
      label.textContent = '本地 Runtime 启动失败'
      detail.textContent = status.userMessage ?? '请重试；如果问题持续，请打开日志查看诊断。'
      failurePanel.hidden = false
      actions.hidden = false
      break
  }

  accessibleStatus.textContent = `${label.textContent ?? ''} ${detail.textContent ?? ''}`
}

retry.addEventListener('click', () => {
  retry.disabled = true
  void window.deepviewerDesktop.retryRuntime().finally(() => {
    retry.disabled = false
  })
})
logs.addEventListener('click', () => void window.deepviewerDesktop.openLogDirectory())

window.deepviewerDesktop.onRuntimeStatus(render)
void window.deepviewerDesktop.getRuntimeStatus().then(render)
