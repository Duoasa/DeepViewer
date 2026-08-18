import { fileURLToPath } from 'node:url'
import { isAbsolute } from 'node:path'
import { getExternalWebUrl } from './external-navigation.js'

export interface DesktopContextMenuOptions {
  logDirectory: string
  locale: string
}

export interface DesktopContextMenuLabels {
  previewFile: string
  openWebLink: string
  copyLinkAddress: string
  revealFile: string
  copyFilePath: string
  openLogs: string
}

export type ContextLinkTarget =
  | { kind: 'web', url: string }
  | { kind: 'file', path: string }

export const NATIVE_FILE_PATH_ATTRIBUTE = 'data-deepviewer-native-file-path'
export const DEEPVIEWER_PREVIEW_FILE_EVENT = 'deepviewer:preview-file'

/**
 * Read the nearest explicit native-file target at a Chromium context-menu point.
 * Button `title` values are not included in Electron's ContextMenuParams, so the
 * main process evaluates this small lookup in the originating frame.
 */
export function createNativeFilePathLookupScript(x: number, y: number): string {
  const safeX = Number.isFinite(x) ? x : 0
  const safeY = Number.isFinite(y) ? y : 0
  return `(() => {
    const element = document.elementFromPoint(${String(safeX)}, ${String(safeY)});
    const target = element?.closest?.('[${NATIVE_FILE_PATH_ATTRIBUTE}]');
    return target?.getAttribute?.('${NATIVE_FILE_PATH_ATTRIBUTE}') ?? '';
  })()`
}

export function getNativeFileTarget(value: unknown): ContextLinkTarget | undefined {
  if (typeof value !== 'string') return undefined
  const path = value.trim()
  if (path === '' || path.includes('\0') || !isAbsolute(path)) return undefined
  return { kind: 'file', path }
}

export function createPreviewFileDispatchScript(path: string): string {
  return `window.dispatchEvent(new CustomEvent('${DEEPVIEWER_PREVIEW_FILE_EVENT}', { detail: ${JSON.stringify(path)} }))`
}

export function getContextLinkTarget(
  linkUrl: string,
  titleText = '',
): ContextLinkTarget | undefined {
  const webUrl = getExternalWebUrl(linkUrl)
  if (webUrl !== undefined) return { kind: 'web', url: webUrl }

  try {
    const url = new URL(linkUrl)
    if (url.protocol === 'file:') return { kind: 'file', path: fileURLToPath(url) }
  } catch {
    // Harness file affordances are buttons, not anchors, so linkUrl is empty.
  }

  return getNativeFileTarget(titleText)
}

export function getDesktopContextMenuLabels(locale: string): DesktopContextMenuLabels {
  if (locale.toLowerCase().startsWith('zh')) {
    return {
      previewFile: '在 DeepViewer 中预览',
      openWebLink: '在默认浏览器中打开',
      copyLinkAddress: '复制链接地址',
      revealFile: '在 Finder 中显示',
      copyFilePath: '复制文件路径',
      openLogs: '打开日志目录',
    }
  }
  return {
    previewFile: 'Preview in DeepViewer',
    openWebLink: 'Open in Default Browser',
    copyLinkAddress: 'Copy Link Address',
    revealFile: 'Show in Finder',
    copyFilePath: 'Copy File Path',
    openLogs: 'Open Logs Folder',
  }
}
