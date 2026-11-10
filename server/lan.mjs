import { networkInterfaces } from 'node:os'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createSyncServer } from './sync.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
export function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
}
export function lanAddresses(interfaces = networkInterfaces()) {
  const addresses = []
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal && isPrivateIPv4(entry.address) && !addresses.some(a => a.address === entry.address)) {
        addresses.push({ name, address: entry.address })
      }
    }
  }
  return addresses
}
const isLoopback = ip => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
const isLanPeer = ip => isLoopback(ip) || isPrivateIPv4((ip || '').replace(/^::ffff:/, ''))

export function createLanServer({ port = 8789, root = resolve(projectRoot, 'dist-lan'), addresses = lanAddresses() } = {}) {
  if (!existsSync(resolve(root, 'index.html'))) throw new Error('LAN assets not found. Run npm run build:lan first.')
  root = resolve(root)
  const key = randomBytes(24).toString('base64url')
  const origins = []
  let localOrigin = ''
  let viewerBases = []
  function allowedHost(req) {
    return origins.includes(`http://${req.headers.host}`) && isLanPeer(req.socket.remoteAddress)
  }
  const service = createSyncServer({ port, host: '0.0.0.0', origins, createKey: key,
    allowRequest: allowedHost,
    handleRequest: async (req, res) => {
      const reply = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text) }
      if (!allowedHost(req)) return reply(403, 'Only local and private LAN connections are allowed')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Referrer-Policy', 'no-referrer')
      res.setHeader('X-Frame-Options', 'DENY')
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405, 'Method not allowed')
      if (req.url === '/health') return reply(200, 'ShowTimer LAN ready')
      if (req.url === '/lan-config.json') {
        // Only the host computer can obtain the create key; never included in a QR code.
        if (!isLoopback(req.socket.remoteAddress) || ![localOrigin, localOrigin.replace('127.0.0.1', 'localhost')].includes(`http://${req.headers.host}`) ||
            (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) return reply(403, 'Open the local URL on the controller computer')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ mode: 'lan', key, serviceUrl: localOrigin.replace('http:', 'ws:'), viewerBases }))
      }
      try {
        const pathname = decodeURIComponent(new URL(req.url, localOrigin).pathname)
        // Serve only the built entry point and its bundled assets, never project/config files.
        if (pathname !== '/' && pathname !== '/index.html' && !pathname.startsWith('/assets/')) return reply(404, 'Not found')
        const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
        if (!file.startsWith(root + sep)) return reply(403, 'Forbidden')
        const body = await readFile(file)
        res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream' })
        res.end(req.method === 'HEAD' ? undefined : body)
      } catch { reply(404, 'Not found') }
    },
  })
  service.http.on('listening', () => {
    const actualPort = service.http.address().port
    localOrigin = `http://127.0.0.1:${actualPort}`
    viewerBases = addresses.map(a => ({ ...a, url: `http://${a.address}:${actualPort}/` }))
    origins.push(localOrigin, `http://localhost:${actualPort}`, ...viewerBases.map(a => a.url.slice(0, -1)))
  })
  return service
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const addresses = lanAddresses()
    const service = createLanServer({ port: Number(process.env.LAN_PORT || 8789), addresses })
    service.http.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? 'LAN port is in use. Close the other ShowTimer LAN service first.' : error.message)
      process.exitCode = 1
      void service.close()
    })
    service.http.on('listening', () => {
      const port = service.http.address().port
      console.log(`\nShowTimer LAN is ready\n\n1. Open on the controller: http://127.0.0.1:${port}/\n2. Tools → LAN broadcast → Start LAN broadcast\n3. Connect viewers to the same Wi-Fi and scan the viewer QR code\n`)
      for (const a of addresses) console.log(`Available interface: ${a.name} → http://${a.address}:${port}/`)
      if (!addresses.length) console.log('No private IPv4 address found. Connect to Wi-Fi or Ethernet, then restart.')
      console.log('\nKeep this window open. Press Ctrl+C to stop. If Windows Firewall asks, allow trusted private networks only.\n')
    })
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void service.close().then(() => process.exit(0)) })
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
