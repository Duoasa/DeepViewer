import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
const BACKUP = '.deepviewer-web-state-v1.json'
const MARKER = '.deepviewer-web-state-imported-v1.json'
const MAX_BYTES = 8 * 1024 * 1024
const exact = new Set(['dsh.workspace.view.v5', 'dsh.sessions.current', 'dsh.open-in-app.choice', 'dsh.conversation.contentWidth'])
export function allowedStateKey(key: string): boolean {
  return exact.has(key) || /^dsh\.conversation\.[a-zA-Z0-9_-]{1,256}$/u.test(key) && key !== 'dsh.conversation.contentWidth'
}
export function filterWebState(entries: unknown): Record<string, string> {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Invalid frontend state')
  const result: Record<string, string> = {}; let bytes = 0
  for (const [key, value] of Object.entries(entries)) {
    if (!allowedStateKey(key)) continue
    if (typeof value !== 'string' || value.length > 2 * 1024 * 1024) throw new Error('Invalid frontend state value')
    const decoded: unknown = JSON.parse(value)
    if (key.startsWith('dsh.conversation.') && key !== 'dsh.conversation.contentWidth' && (!decoded || typeof decoded !== 'object' || !('draft' in decoded) || typeof decoded.draft !== 'string')) throw new Error('Invalid conversation draft')
    bytes += Buffer.byteLength(value); if (bytes > MAX_BYTES) throw new Error('Frontend migration exceeds 8 MiB')
    result[key] = value
  }
  return result
}
/** Only metadata produced by DeepViewer's previous runtime logger is used; no tokens or URLs with queries. */
export function legacyOrigins(log: string): string[] {
  return [...new Set([...log.matchAll(/runtime ready origin=(http:\/\/127\.0\.0\.1:[0-9]{1,5})(?:\s|$)/gu)].map(match => match[1]!).reverse())].filter(origin => { const port = Number(new URL(origin).port); return port >= 1024 && port <= 65535 }).slice(0, 8)
}
function atomic(path: string, value: unknown): void { const temporary = `${path}.${randomUUID()}.tmp`; writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 }); renameSync(temporary, path) }
async function readOrigin(origin: string): Promise<Record<string, string>> {
  const url = new URL(origin), nonce = randomUUID(), path = `/deepviewer-migration-${nonce}`
  const server = createServer((request, response) => { if (request.url !== path) { response.writeHead(404); response.end(); return }; response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Cache-Control': 'no-store' }); response.end('<!doctype html><title>DeepViewer migration</title>') })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(Number(url.port), '127.0.0.1', resolve) })
  const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, destination) => { if (destination !== origin + path) event.preventDefault() })
  try {
    await window.loadURL(origin + path)
    const entries = await window.webContents.executeJavaScript(`Object.fromEntries(Object.keys(localStorage).filter(key => ${JSON.stringify([...exact])}.includes(key) || /^dsh\\.conversation\\.[a-zA-Z0-9_-]{1,256}$/.test(key)).map(key => [key, localStorage.getItem(key)]))`)
    return filterWebState(entries)
  } finally { window.destroy(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}
/** Runs after Electron ready, before official main creates any renderer. Source storage stays untouched. */
export async function prepareWebState(userData: string): Promise<void> {
  const backup = join(userData, BACKUP), marker = join(userData, MARKER)
  let values: Record<string, string> = {}
  if (existsSync(marker)) {
    // Completed migrations still install IPC listeners for the immutable preload contract.
  } else if (existsSync(backup)) {
    const saved = JSON.parse(readFileSync(backup, 'utf8'))
    if (saved.schemaVersion !== 1) throw new Error('Unsupported frontend migration schema')
    values = filterWebState(saved.values)
  } else {
    const logPath = join(userData, 'logs/deepviewer.log')
    const origins = existsSync(logPath) ? legacyOrigins(readFileSync(logPath, 'utf8').slice(-4 * 1024 * 1024)) : []
    if (origins.length === 0 && existsSync(join(userData, 'Local Storage/leveldb'))) throw new Error('DeepViewer 旧版前端状态缺少来源记录，迁移未完成；原数据已保留。')
    // Old runtime changes port between launches. Newest value for each key wins.
    for (const origin of origins) for (const [key, value] of Object.entries(await readOrigin(origin))) if (!(key in values)) values[key] = value
    mkdirSync(userData, { recursive: true, mode: 0o700 })
    atomic(backup, { schemaVersion: 1, backedUpAt: new Date().toISOString(), origins, values: filterWebState(values) })
  }
  const ownsFrame = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => event.senderFrame === event.sender.mainFrame && event.senderFrame?.url.startsWith('dsh-app://app/')
  ipcMain.on('deepviewer-state-bootstrap', event => { event.returnValue = ownsFrame(event) ? values : {} })
  ipcMain.handle('deepviewer-state-imported', event => { if (!ownsFrame(event)) throw new Error('Unowned migration frame'); atomic(marker, { schemaVersion: 1, importedAt: new Date().toISOString(), keys: Object.keys(values) }); return true })
  // Keep state listeners for renderer reloads; the preload does not overwrite any new-origin value.
}
