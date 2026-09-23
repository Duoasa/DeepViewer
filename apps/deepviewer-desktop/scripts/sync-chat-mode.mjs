import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
export const chatModePatchPath = resolve(dirname(fileURLToPath(import.meta.url)), '../upstream-overrides/chat-mode/patches.json')

/** Validate every anchor before touching the checkout; repeat calls are idempotent. */
export function syncChatModeOverrides(upstreamRoot) {
  const patches = JSON.parse(readFileSync(chatModePatchPath, 'utf8'))
  const pending = []
  for (const patch of patches) {
    const path = resolve(upstreamRoot, patch.file)
    if (!path.startsWith(resolve(upstreamRoot) + '/')) throw new Error('Chat patch escapes upstream root')
    const current = existsSync(path) ? readFileSync(path, 'utf8') : undefined
    let next = current
    if ('content' in patch) {
      if (current !== undefined && current !== patch.content) throw new Error(`Chat file differs: ${patch.file}`)
      next = patch.content
    } else {
      if (next === undefined) throw new Error(`Missing Chat patch target: ${patch.file}`)
      for (const change of patch.changes) {
        if (next.includes(change.after)) continue
        if (next.split(change.before).length !== 2) throw new Error(`Chat patch anchor mismatch: ${patch.file}`)
        next = next.replace(change.before, change.after)
      }
    }
    if (next !== current) pending.push({ path, next })
  }
  for (const { path, next } of pending) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, next)
  }
  return pending.length > 0
}
