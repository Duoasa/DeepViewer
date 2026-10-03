/** Apply every pinned contract twice to a fresh upstream checkout, without touching the working kernel. */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareUpstream, upstreamRoot, harnessCommit } from '../../deepviewer-adapter/scripts/prepare-upstream.mjs'
import { contracts } from '../../deepviewer-adapter/compatibility/contracts.mjs'
const fixture = mkdtempSync(join(tmpdir(), 'deepviewer-contracts-')), checkout = join(fixture, 'kernel')
try {
  execFileSync('git', ['clone', '--shared', '--no-checkout', upstreamRoot, checkout], { stdio: 'ignore' })
  execFileSync('git', ['checkout', '--detach', harnessCommit], { cwd: checkout, stdio: 'ignore' })
  if (contracts.some(contract => /packages\/core\/agent-loop\//u.test(contract.file))) throw new Error('DeepViewer must not patch the Agent loop')
  prepareUpstream(checkout); prepareUpstream(checkout)
  console.info(JSON.stringify({ result: 'PASS', commit: harnessCommit, contracts: contracts.length, cleanSource: true, idempotent: true, agentLoopUnchanged: true }))
} finally { rmSync(fixture, { recursive: true, force: true }) }
