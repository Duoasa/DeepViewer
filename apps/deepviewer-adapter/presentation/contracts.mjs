import { readFileSync } from 'node:fs'
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8')
// Presentation only. Native controllers, owner stores and modal lifetimes stay upstream.
export const presentationContracts = JSON.parse(read('contracts.json')).map(({ beforeFile, afterFile, ...contract }) => ({
  ...contract,
  before: beforeFile ? read(beforeFile) : contract.before,
  after: afterFile ? read(afterFile) : contract.after,
}))
export const presentationStyles = JSON.parse(read('styles.json')).map(style => ({ ...style, content: read(style.source) }))
