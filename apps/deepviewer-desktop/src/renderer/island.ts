import './island.css'
import type {
  ActivityIslandRenderState,
  ActivityIslandState,
} from '../shared/activity-island.js'
import { QuotaViewActivityOrbRenderer } from './island-orb.js'

interface ActivityCopy {
  readonly status: string
  readonly operation: string
}

const copy: Record<'zh' | 'en', Record<ActivityIslandState, ActivityCopy>> = {
  zh: {
    standby: {
      status: '空闲',
      operation: 'DeepViewer 会话已就绪',
    },
    thinking: {
      status: '思考中',
      operation: '正在分析新的任务',
    },
    working: {
      status: '工作中',
      operation: '正在执行工具操作',
    },
    awaitingConfirmation: {
      status: '待确认',
      operation: '有一项操作需要你的批准',
    },
    completed: {
      status: '已完成',
      operation: '当前任务已完成',
    },
    error: {
      status: '失败',
      operation: '当前任务遇到问题',
    },
    unavailable: {
      status: '未载入',
      operation: 'DeepViewer Runtime 不可用',
    },
  },
  en: {
    standby: {
      status: 'Idle',
      operation: 'The DeepViewer session is ready',
    },
    thinking: {
      status: 'Thinking',
      operation: 'Analyzing the new task',
    },
    working: {
      status: 'Working',
      operation: 'Running a tool',
    },
    awaitingConfirmation: {
      status: 'Awaiting Confirmation',
      operation: 'An operation needs your approval',
    },
    completed: {
      status: 'Completed',
      operation: 'The current task is complete',
    },
    error: {
      status: 'Failed',
      operation: 'The current task encountered a problem',
    },
    unavailable: {
      status: 'Not Loaded',
      operation: 'The DeepViewer Runtime is unavailable',
    },
  },
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) throw new Error('Activity island is missing ' + selector)
  return element
}

const root = requiredElement<HTMLElement>('#island')
const surface = requiredElement<HTMLElement>('.surface')
const kicker = requiredElement<HTMLElement>('#kicker')
const statusTitle = requiredElement<HTMLElement>('#status-title')
const compactTitle = requiredElement<HTMLElement>('#compact-title')
const detail = requiredElement<HTMLElement>('#operation')
const canvas = requiredElement<HTMLCanvasElement>('#orb-canvas')
const language: 'zh' | 'en' = navigator.language.toLowerCase().startsWith('zh')
  ? 'zh'
  : 'en'
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const orb = new QuotaViewActivityOrbRenderer(canvas)
let renderState: ActivityIslandRenderState | undefined
let frame: number | undefined

function shouldAnimate(): boolean {
  return renderState?.presentation !== 'hidden'
    && document.visibilityState === 'visible'
    && !reducedMotion.matches
}

function draw(time: number): void {
  orb.draw(time, reducedMotion.matches)
}

function animate(time: number): void {
  draw(time)
  if (shouldAnimate()) frame = requestAnimationFrame(animate)
  else frame = undefined
}

function restartAnimation(): void {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
  draw(performance.now())
  if (shouldAnimate()) frame = requestAnimationFrame(animate)
}

function render(state: ActivityIslandRenderState): void {
  renderState = state
  root.dataset.presentation = state.presentation
  root.dataset.animation = state.preferences.orbAnimation
  const activity = state.activity
  if (activity !== null) {
    const text = copy[language][activity.state]
    root.dataset.state = activity.state
    kicker.textContent = activity.title
    statusTitle.textContent = text.status
    compactTitle.textContent = text.status
    detail.textContent = text.operation
    surface.setAttribute(
      'aria-label',
      language === 'zh'
        ? activity.title + '，状态：' + text.status + '，当前操作：' + text.operation
        : activity.title + ', status: ' + text.status + ', current operation: ' + text.operation,
    )
    orb.setState(activity.state)
  }
  orb.setMode(state.preferences.orbAnimation)
  restartAnimation()
}

document.addEventListener('visibilitychange', restartAnimation)
reducedMotion.addEventListener('change', restartAnimation)
new ResizeObserver(restartAnimation).observe(canvas)
window.deepviewerIsland.onRenderState(render)
