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
  if (!existsSync(resolve(root, 'index.html'))) throw new Error('找不到區網版網頁，請先執行 npm run build:lan')
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
      if (!allowedHost(req)) return reply(403, '僅允許本機與區域網路連線')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Referrer-Policy', 'no-referrer')
      res.setHeader('X-Frame-Options', 'DENY')
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405, 'Method not allowed')
      if (req.url === '/health') return reply(200, 'ShowTimer LAN ready')
      if (req.url === '/lan-config.json') {
        // Only the host computer can obtain the create key; never included in a QR code.
        if (!isLoopback(req.socket.remoteAddress) || ![localOrigin, localOrigin.replace('127.0.0.1', 'localhost')].includes(`http://${req.headers.host}`) ||
            (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) return reply(403, '請在主控電腦開啟本機網址')
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
      console.error(error.code === 'EADDRINUSE' ? '區網連接埠已被使用，請先關閉另一個 ShowTimer 區網服務。' : error.message)
      process.exitCode = 1
      void service.close()
    })
    service.http.on('listening', () => {
      const port = service.http.address().port
      console.log(`\nShowTimer 區網模式已啟動\n\n1. 主控電腦開啟：http://127.0.0.1:${port}/\n2. Tools → 區網廣播 → 開啟區網廣播\n3. 手機連同一個 Wi-Fi，掃描畫面上的觀看 QR Code\n`)
      for (const a of addresses) console.log(`可分享的介面：${a.name} → http://${a.address}:${port}/`)
      if (!addresses.length) console.log('尚未找到區網 IPv4 位址，請連接 Wi-Fi／網路線後重新啟動。')
      console.log('\n請保持此視窗開啟。按 Ctrl+C 停止。Windows 防火牆如詢問，僅允許信任的私人網路。\n')
    })
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void service.close().then(() => process.exit(0)) })
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
