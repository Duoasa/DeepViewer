import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, watch } from 'node:fs'
import { createConnection, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createDevelopmentChangeDetector, shouldRestartForDevelopmentPath } from './development-inputs.mjs'
import { prepareDevelopmentShell } from './development-shell.mjs'

export { shouldRestartForDevelopmentPath } from './development-inputs.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const require = createRequire(import.meta.url)
const electronExecutable = require('electron')

function manifestWithoutBuildNumber() {
  try {
    const manifest = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))
    delete manifest.buildNumber
    return JSON.stringify(manifest)
  } catch {
    return undefined
  }
}

export function createManifestChangeDetector(readFingerprint = manifestWithoutBuildNumber) {
  let previous = readFingerprint()
  return () => {
    const current = readFingerprint()
    if (current === undefined || current === previous) return false
    previous = current
    return true
  }
}

export function developmentControlSocketPath(root = projectRoot) {
  const owner = typeof process.getuid === 'function' ? process.getuid() : 'unknown'
  const projectHash = createHash('sha256').update(resolve(root)).digest('hex').slice(0, 12)
  return join(tmpdir(), `deepviewer-dev-${String(owner)}-${projectHash}.sock`)
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} failed with code=${String(code)} signal=${String(signal)}`))
    })
  })
}

function sendControl(socketPath, command) {
  return new Promise((resolvePromise, reject) => {
    const client = createConnection(socketPath)
    let response = ''
    client.setEncoding('utf8')
    client.once('connect', () => client.end(`${command}\n`))
    client.on('data', chunk => { response += chunk })
    client.once('error', reject)
    client.once('close', () => resolvePromise(response.trim()))
  })
}

async function requestActiveRunnerRestart(socketPath) {
  let response
  try {
    response = await sendControl(socketPath, 'restart')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`No active DeepViewer Dev runner for this project. Run pnpm desktop:dev first. (${detail})`)
  }
  if (response !== 'queued') throw new Error(`DeepViewer Dev runner rejected restart: ${response || 'no response'}`)
  process.stdout.write('DeepViewer Dev rebuild and restart queued.\n')
}

async function stopElectron(child) {
  if (child === undefined || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolvePromise => child.once('exit', resolvePromise))
  child.kill('SIGTERM')
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise(resolvePromise => setTimeout(() => resolvePromise(false), 5_000)),
  ])
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exited
  }
}

async function runDevelopmentRunner() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error('DeepViewer development supports macOS arm64 only')
  }
  const socketPath = developmentControlSocketPath()
  if (existsSync(socketPath)) {
    try {
      const response = await sendControl(socketPath, 'ping')
      if (response === 'active') {
        throw new Error('DeepViewer Dev runner is already active; use pnpm desktop:dev:restart')
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already active')) throw error
      rmSync(socketPath, { force: true })
    }
  }

  let electronChild
  let pendingReason
  let restartLoop
  let shuttingDown = false
  let debounceTimer

  const requestRestart = reason => {
    pendingReason = reason
    if (restartLoop !== undefined) return restartLoop
    restartLoop = (async () => {
      while (pendingReason !== undefined && !shuttingDown) {
        const currentReason = pendingReason
        pendingReason = undefined
        await stopElectron(electronChild)
        electronChild = undefined
        process.stdout.write(`${new Date().toISOString()} DeepViewer Dev build: ${currentReason}\n`)
        let developmentExecutable
        try {
          await run('pnpm', ['build:dev'], { cwd: appRoot })
          developmentExecutable = await prepareDevelopmentShell(electronExecutable, appRoot)
        } catch (error) {
          process.stderr.write(`DeepViewer Dev build failed: ${error instanceof Error ? error.message : String(error)}\n`)
          continue
        }
        if (pendingReason !== undefined || shuttingDown) continue
        const launchedChild = spawn(developmentExecutable, ['.'], {
          cwd: appRoot,
          env: {
            ...process.env,
            DEEPVIEWER_PROFILE: 'development',
          },
          stdio: 'inherit',
        })
        electronChild = launchedChild
        process.stdout.write(`DeepViewer Dev started (pid ${String(launchedChild.pid)}).\n`)
        launchedChild.once('exit', (code, signal) => {
          if (electronChild === launchedChild) electronChild = undefined
          if (!shuttingDown) {
            process.stdout.write(`DeepViewer Dev exited (code=${String(code)}, signal=${String(signal)}); watcher remains active.\n`)
          }
        })
      }
    })().finally(() => { restartLoop = undefined })
    return restartLoop
  }

  const server = createServer(socket => {
    socket.setEncoding('utf8')
    let request = ''
    socket.on('data', chunk => { request += chunk })
    socket.on('end', () => {
      const command = request.trim()
      if (command === 'ping') {
        socket.end('active\n')
      } else if (command === 'restart') {
        void requestRestart('manual restart')
        socket.end('queued\n')
      } else {
        socket.end('ignored\n')
      }
    })
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(socketPath, resolvePromise)
  })

  const inputsChanged = createDevelopmentChangeDetector(appRoot)
  const externalInputs = [
    { path: 'apps/deepviewer-adapter', directories: ['client', 'desktop', 'migrations', 'workflows', 'compatibility', 'scripts', 'assets'], files: ['package.json', 'cordis.patch.yml', 'native-modules.patch.yml'] },
    { path: 'apps/dsh-plugin-model-capabilities', directories: ['src'], files: ['package.json', 'cordis.patch.yml', 'tsconfig.json', 'LICENSE', 'UPSTREAM.md'] },
  ].map(input => ({ ...input, changed: createDevelopmentChangeDetector(resolve(projectRoot, input.path), input) }))
  const pendingInputChanges = new Set()
  let inputReadRetries = 0
  const checkInputs = () => {
    debounceTimer = undefined
    if (shuttingDown) return
    let changed
    try {
      for (const path of inputsChanged()) pendingInputChanges.add(path)
      for (const input of externalInputs) for (const path of input.changed()) pendingInputChanges.add(`${input.path}/${path}`)
      changed = [...pendingInputChanges]
      pendingInputChanges.clear()
    } catch (error) {
      // Editors may briefly remove a source or leave partial JSON during a save.
      if (inputReadRetries++ < 3) debounceTimer = setTimeout(checkInputs, 300)
      else process.stderr.write(`DeepViewer Dev could not read inputs: ${error.message}; waiting for the next file event.\n`)
      return
    }
    inputReadRetries = 0
    if (changed.length > 0) void requestRestart(`content changed: ${changed.join(', ')}`)
  }
  const sourceWatcher = watch(appRoot, { recursive: true }, (_eventType, filename) => {
    if (!shouldRestartForDevelopmentPath(filename)) return
    inputReadRetries = 0
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(checkInputs, 300)
  })
  const externalWatchers = externalInputs.map(input => watch(resolve(projectRoot, input.path), { recursive: true }, () => {
    inputReadRetries = 0
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(checkInputs, 300)
  }))

  const shutdown = async signal => {
    if (shuttingDown) return
    shuttingDown = true
    process.stdout.write(`DeepViewer Dev stopping (${signal}).\n`)
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    sourceWatcher.close()
    for (const watcher of externalWatchers) watcher.close()
    await stopElectron(electronChild)
    await new Promise(resolvePromise => server.close(resolvePromise))
    rmSync(socketPath, { force: true })
  }

  process.once('SIGINT', () => { void shutdown('SIGINT').then(() => process.exit(0)) })
  process.once('SIGTERM', () => { void shutdown('SIGTERM').then(() => process.exit(0)) })
  process.once('exit', () => rmSync(socketPath, { force: true }))

  process.stdout.write('DeepViewer Dev watcher active. Use pnpm desktop:dev:restart for a manual restart.\n')
  await requestRestart('initial start')
}

async function main() {
  const socketPath = developmentControlSocketPath()
  if (process.argv.includes('--restart')) {
    await requestActiveRunnerRestart(socketPath)
    return
  }
  await runDevelopmentRunner()
}

const isEntrypoint = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntrypoint) {
  await main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
