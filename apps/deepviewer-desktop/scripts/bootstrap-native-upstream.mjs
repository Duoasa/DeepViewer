import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { upstreamRoot, harnessCommit, prepareUpstream } from '../../deepviewer-adapter/scripts/prepare-upstream.mjs'
if (!existsSync(upstreamRoot)) execFileSync('git', ['clone', '--depth', '1', '--branch', 'dsh-v0.2.0-rc.2', 'https://github.com/deepseek-ai/deepseek-harness.git', upstreamRoot], { stdio: 'inherit' })
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstreamRoot, encoding: 'utf8' }).trim() !== harnessCommit) throw new Error('Existing upstream checkout has a different identity; it was not modified')
prepareUpstream()
console.info('DeepViewer pinned DSH 0.2.0-rc.2 adapter contracts prepared')
