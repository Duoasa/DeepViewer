import { fileURLToPath } from 'node:url'
import { isAbsolute } from 'node:path'
import { getExternalWebUrl } from './external-navigation.js'

export interface DesktopContextMenuOptions {
  logDirectory: string
  locale: string
}

export interface DesktopContextMenuLabels {
  openWebLink: string
  copyLinkAddress: string
  revealFile: string
  copyFilePath: string
  openLogs: string
}

export type ContextLinkTarget =
  | { kind: 'web', url: string }
  | { kind: 'file', path: string }

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

  const titledPath = titleText.trim()
  if (titledPath !== '' && !titledPath.includes('\0') && isAbsolute(titledPath)) {
    return { kind: 'file', path: titledPath }
  }
  return undefined
}

export function getDesktopContextMenuLabels(locale: string): DesktopContextMenuLabels {
  if (locale.toLowerCase().startsWith('zh')) {
    return {
      openWebLink: '在默认浏览器中打开',
      copyLinkAddress: '复制链接地址',
      revealFile: 'finder中显示',
      copyFilePath: '复制文件路径',
      openLogs: '打开日志目录',
    }
  }
  return {
    openWebLink: 'Open in Default Browser',
    copyLinkAddress: 'Copy Link Address',
    revealFile: 'Show in Finder',
    copyFilePath: 'Copy File Path',
    openLogs: 'Open Logs Folder',
  }
}
