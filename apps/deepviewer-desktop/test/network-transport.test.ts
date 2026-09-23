import { it, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as createTlsServer } from 'node:tls'
import { createServer, type AddressInfo, type Socket } from 'node:net'
import { connectRoute, secureSocket } from '../src/main/network/transport.js'

it('keeps TLS certificate verification enabled after opening a route', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'deepviewer-tls-'))
  const key = join(directory, 'key.pem'), cert = join(directory, 'cert.pem')
  execFileSync('/usr/bin/openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' })
  const sockets = new Set<Socket>()
  const server = createTlsServer({ key: readFileSync(key), cert: readFileSync(cert) })
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  server.on('tlsClientError', () => {})
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  try {
    const url = new URL(`https://localhost:${(server.address() as AddressInfo).port}`), signal = new AbortController().signal
    const socket = await connectRoute(url, { kind: 'direct' }, [{ address: '127.0.0.1', family: 4 }], signal)
    try { await expect(secureSocket(socket, url, signal)).rejects.toMatchObject({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }) }
    finally { socket.destroy() }
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise<void>(done => server.close(() => done()))
    rmSync(directory, { recursive: true, force: true })
  }
})

it('passes the original hostname to a SOCKS5 proxy for remote DNS', async () => {
  const sockets = new Set<Socket>(), names: string[] = []
  const server = createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket))
    let pending = Buffer.alloc(0), state = 'greeting'
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk])
      if (state === 'greeting' && pending.length >= 2 + pending[1]!) {
        pending = pending.subarray(2 + pending[1]!); socket.write(Buffer.from([5, 0])); state = 'request'
      }
      if (state === 'request' && pending.length >= 5 && pending.length >= 7 + pending[4]!) {
        expect([...pending.subarray(0, 4)]).toEqual([5, 1, 0, 3])
        names.push(pending.subarray(5, 5 + pending[4]!).toString())
        socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 1, 187])); state = 'connected'
      }
    })
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  try {
    const socket = await connectRoute(new URL('https://remote-dns.invalid'), { kind: 'socks5', host: '127.0.0.1', port: (server.address() as AddressInfo).port }, undefined, new AbortController().signal)
    expect(names).toEqual(['remote-dns.invalid']); socket.destroy()
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise<void>(done => server.close(() => done()))
  }
})
