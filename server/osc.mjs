import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { createSocket } from 'node:dgram'
import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

export const commands = new Set(['start', 'pause', 'resume', 'next', 'mark'])
// Accept standard OSC messages and immediate bundles. Scheduled bundles are rejected.
export function decodeOsc(buffer, depth = 0) {
  if (depth > 4 || buffer.length > 8192 || buffer.length % 4) return []
  if (buffer.subarray(0, 8).equals(Buffer.from('#bundle\0'))) {
    if (buffer.length < 16 || buffer.readBigUInt64BE(8) !== 1n) return []
    let at = 16; const result = []
    while (at < buffer.length) {
      if (at + 4 > buffer.length) return []
      const size = buffer.readInt32BE(at); at += 4
      if (size <= 0 || at + size > buffer.length) return []
      result.push(...decodeOsc(buffer.subarray(at, at + size), depth + 1)); at += size
    }
    return result
  }
  let at = 0
  function string() {
    const end = buffer.indexOf(0, at)
    if (end < 0) throw new Error('unterminated string')
    const value = buffer.toString('utf8', at, end)
    const next = Math.ceil((end + 1) / 4) * 4
    if (next > buffer.length || buffer.subarray(end, next).some(v => v !== 0)) throw new Error('padding')
    at = next; return value
  }
  try {
    const address = string()
    if (!address.startsWith('/showtimer/')) return []
    const command = address.slice('/showtimer/'.length)
    if (!commands.has(command)) return []
    const tag = at === buffer.length ? ',' : string()
    if (tag === ',i' || tag === ',f') {
      if (at + 4 !== buffer.length) return []
      const value = tag === ',i' ? buffer.readInt32BE(at) : buffer.readFloatBE(at)
      if (!Number.isFinite(value) || value <= 0) return []
    } else if ((tag !== ',' && tag !== ',T') || at !== buffer.length) return []
    return [command]
  } catch { return [] }
}

export function createOscBridge({ wsPort = 8788, udpPort = 53001, udpHost = '127.0.0.1', pairingToken = randomBytes(24).toString('base64url'),
  origins = ['https://andyue.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:8788'] } = {}) {
  const root = resolve('dist')
  const http = createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200); res.end('ShowTimer OSC bridge'); return }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/ShowTimerPWA(?=\/|$)/, '')
      const file = resolve(root, '.' + (pathname === '/' || !pathname ? '/index.html' : pathname))
      if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return }
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream' })
      res.end(body)
    } catch { res.writeHead(404); res.end('Run npm run build first, then open http://127.0.0.1:8788/') }
  })
  const wss = new WebSocketServer({ server: http, maxPayload: 4096, verifyClient: ({ origin }) => origins.includes(origin) })
  const udp = createSocket('udp4'); let controller = null
  const lastCommand = new Map()
  wss.on('connection', ws => {
    const timeout = setTimeout(() => ws.close(1008, 'Pairing timeout'), 5000)
    ws.on('message', raw => {
      let message
      try { message = JSON.parse(raw.toString()) } catch { return ws.close(1008, 'Invalid JSON') }
      if (message?.type === 'pair' && message.token === pairingToken && (!controller || controller === ws)) {
        controller = ws; clearTimeout(timeout); ws.send(JSON.stringify({ type: 'paired' }))
      } else if (controller === ws && message?.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
      else if (controller !== ws) ws.close(1008, 'Invalid pairing or another controller is connected')
    })
    ws.on('close', () => { clearTimeout(timeout); if (controller === ws) controller = null })
    ws.on('error', () => {})
  })
  udp.on('message', buffer => {
    if (!controller || controller.readyState !== WebSocket.OPEN) return
    for (const command of decodeOsc(buffer)) {
      const now = Date.now()
      if (now - (lastCommand.get(command) ?? 0) < 500) continue
      lastCommand.set(command, now)
      controller.send(JSON.stringify({ type: 'command', command, id: randomUUID(), sentAt: now }))
    }
  })
  udp.on('error', error => console.error('OSC UDP error:', error.message))
  udp.bind(udpPort, udpHost); http.listen(wsPort, '127.0.0.1')
  return { http, udp, pairingToken, close: () => {
    for (const ws of wss.clients) ws.terminate()
    wss.close(); udp.close(); return new Promise(resolve => http.close(resolve))
  } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bridge = createOscBridge({ wsPort: Number(process.env.OSC_WS_PORT || 8788), udpPort: Number(process.env.OSC_PORT || 53001),
    udpHost: process.env.OSC_HOST || '127.0.0.1', pairingToken: process.env.OSC_TOKEN,
    origins: (process.env.ALLOWED_ORIGINS || 'https://andyue.github.io,http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8788').split(',') })
  console.log('QLab OSC destination:', process.env.OSC_HOST || '127.0.0.1', process.env.OSC_PORT || 53001)
  console.log('Bridge URL: ws://127.0.0.1:' + (process.env.OSC_WS_PORT || 8788))
  console.log('Pairing token (paste into ShowTimer Tools):', bridge.pairingToken)
}
