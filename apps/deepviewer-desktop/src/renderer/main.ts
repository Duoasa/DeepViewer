import './styles.css'
import type { RuntimeStatusView } from '../shared/runtime-status.js'

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) throw new Error(`DeepViewer launch surface is missing ${selector}`)
  return element
}

const label = requiredElement<HTMLElement>('#status-label')
const detail = requiredElement<HTMLElement>('#status-detail')
const indicator = requiredElement<HTMLElement>('#indicator')
const actions = requiredElement<HTMLElement>('#actions')
const retry = requiredElement<HTMLButtonElement>('#retry')
const logs = requiredElement<HTMLButtonElement>('#logs')

function render(status: RuntimeStatusView): void {
  indicator.className = 'indicator'
  actions.hidden = true
  switch (status.phase) {
    case 'stopped':
      label.textContent = '本地 Runtime 已停止'
      detail.textContent = '正在等待下一次启动。'
      break
    case 'starting':
      indicator.classList.add('is-active')
      label.textContent = '正在启动 Harness'
      detail.textContent = `启动尝试 ${String(status.attempt)}，完成后将自动进入工作区。`
      break
    case 'ready':
      indicator.classList.add('is-ready')
      label.textContent = 'Harness 已就绪'
      detail.textContent = '正在打开 DeepViewer 工作区。'
      break
    case 'stopping':
      indicator.classList.add('is-active')
      label.textContent = '正在安全退出'
      detail.textContent = '正在回收 Harness 和它启动的子进程。'
      break
    case 'failed':
      indicator.classList.add('is-error')
      label.textContent = '本地 Runtime 启动失败'
      detail.textContent = status.userMessage ?? '请重试；如果问题持续，请打开日志查看诊断。'
      actions.hidden = false
      break
  }
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
