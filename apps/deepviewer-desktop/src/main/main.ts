// DeepViewer supplies product/data policy; the pinned official shell owns windows, Host and updates.
import { app, dialog } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { initializeDeepViewer } from '../../../deepviewer-adapter/desktop/bootstrap.ts'

try {
  if (initializeDeepViewer()) await import(/* @vite-ignore */ pathToFileURL(join(app.getAppPath(), 'lib', 'official', 'main.js')).href)
} catch (error) {
  console.error(error)
  dialog.showErrorBox('DeepViewer 启动失败', `${error instanceof Error ? error.message : String(error)}\n原有文件已保留。`)
  app.exit(1)
}
