import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

const mode = process.argv[2] ?? 'ready'
if (mode === 'exit') process.exit(7)
if (mode === 'secret') {
  process.stdout.write('authorization=Bearer sample-access-token\n')
  process.stderr.write('callback?code=sample-oauth-code&state=ok refresh_token=sample-refresh-token\n')
}

const child = mode === 'child'
  ? spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  : undefined

const authenticated = mode.startsWith('auth-')
const server = createServer((request, response) => {
  if (authenticated) {
    if (request.url === '/?token=fixture-launch-token') {
      const location = mode === 'auth-external' ? 'https://untrusted.example/' : mode === 'auth-legacy' ? '/' : './'
      response.writeHead(303, {
        location,
        ...(mode === 'auth-no-cookie' ? {} : { 'set-cookie': 'fixture-session=accepted; HttpOnly; SameSite=Strict; Path=/' }),
      })
      response.end()
      return
    }
    if (request.url !== '/' || request.headers.cookie !== 'fixture-session=accepted') {
      response.writeHead(401)
      response.end('Unauthorized')
      return
    }
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end('<!doctype html><title>Fake Harness</title>READY')
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fake harness did not bind a TCP port')
  process.stdout.write(`dsh web: http://127.0.0.1:${String(address.port)}${authenticated ? '/?token=fixture-launch-token' : ''}\n`)
})

const shutdown = () => {
  child?.kill('SIGTERM')
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
