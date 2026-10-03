/** Remove build-only source-location comments before materializing public assets. */
import { globSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
export function sanitizeNativeBuildMetadata(directory, { projectRoot }) {
  const privateRoots = [homedir(), resolve(projectRoot)]
  let changedFiles = 0, removedComments = 0
  for (const name of globSync('**/*.{js,cjs,mjs}', { cwd: directory, dot: true })) {
    const path = join(directory, name)
    if (!statSync(path).isFile()) continue
    const before = readFileSync(path, 'utf8')
    const after = before.replace(/^[\t ]*\/\/#(?:end)?region[^\r\n]*$/gmu, line => {
      if (!privateRoots.some(root => line.includes(root))) return line
      removedComments += 1
      return ''
    })
    if (after !== before) { writeFileSync(path, after); changedFiles += 1 }
  }
  return { changedFiles, removedComments }
}
