import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, rmSync, watch } from 'node:fs'
import { createConnection, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, normalize, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const require = createRequire(import.meta.url)
const electronExecutable = require('electron')
const watchedRootEntries = new Set([
  'package.json',
  'tsconfig.json',
  'vite.main.config.ts',
  'vite.preload.config.ts',
  'vite.renderer.config.ts',
])

export function shouldRestartForDevelopmentPath(path) {
  if (typeof path !== 'string' || path === '') return false
  const normalized = normalize(path).replaceAll('\\', '/')
  return normalized === 'src' || normalized.startsWith('src/') || watchedRootEntries.has(normalized)
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
        process.stdout.write(`DeepViewer Dev build: ${currentReason}\n`)
        try {
          await run('pnpm', ['build'], { cwd: appRoot })
        } catch (error) {
          process.stderr.write(`DeepViewer Dev build failed: ${error instanceof Error ? error.message : String(error)}\n`)
          continue
        }
        if (pendingReason !== undefined || shuttingDown) continue
        const launchedChild = spawn(electronExecutable, ['.'], {
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

  const sourceWatcher = watch(appRoot, { recursive: true }, (_eventType, filename) => {
    if (!shouldRestartForDevelopmentPath(filename)) return
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void requestRestart(`changed ${filename}`)
    }, 200)
  })

  const shutdown = async signal => {
    if (shuttingDown) return
    shuttingDown = true
    process.stdout.write(`DeepViewer Dev stopping (${signal}).\n`)
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    sourceWatcher.close()
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
