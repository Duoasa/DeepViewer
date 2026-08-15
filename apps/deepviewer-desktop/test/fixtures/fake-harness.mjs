import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

const mode = process.argv[2] ?? 'ready'
if (mode === 'exit') process.exit(7)

const child = mode === 'child'
  ? spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  : undefined

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end('<!doctype html><title>Fake Harness</title>READY')
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fake harness did not bind a TCP port')
  process.stdout.write(`dsh web: http://127.0.0.1:${String(address.port)}\n`)
})

const shutdown = () => {
  child?.kill('SIGTERM')
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
