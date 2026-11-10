import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useConnections } from '../stores/ConnectionsContext'
import { viewerUrl } from '../services/Broadcast'

interface LanConfig {
  mode: 'lan'
  key: string
  serviceUrl: string
  viewerBases: { name: string; address: string; url: string }[]
}

export default function ConnectionsPanel() {
  const { attentionStatus, room, broadcastStatus, startBroadcast, stopBroadcast, oscStatus, connectOsc, disconnectOsc } = useConnections()
  const defaultSyncUrl = import.meta.env.VITE_SYNC_URL || 'wss://sync.bearwowo.party'
  const [url, setUrl] = useState(() => {
    const saved = localStorage.getItem('showtimer-service')
    // Replace the retired trial endpoint while preserving custom servers.
    return !saved || saved === 'wss://original-trackback-relate-screensaver.trycloudflare.com'
      ? defaultSyncUrl : saved
  })
  const [key, setKey] = useState('')
  const [lan, setLan] = useState<LanConfig | null>(null)
  const [viewerBase, setViewerBase] = useState('')
  useEffect(() => {
    if (location.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(location.hostname)) return
    const controller = new AbortController()
    fetch('/lan-config.json', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) return
      const config = await response.json() as LanConfig
      if (config.mode === 'lan' && Array.isArray(config.viewerBases)) {
        setLan(config); setViewerBase(config.viewerBases[0]?.url || '')
      }
    }).catch(() => {})
    return () => controller.abort()
  }, [])
  const [oscUrl, setOscUrl] = useState('ws://127.0.0.1:8788')
  const [token, setToken] = useState('')
  const [qr, setQr] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const link = room ? viewerUrl(room) : ''
  useEffect(() => {
    let cancelled = false
    if (link) QRCode.toDataURL(link, { width: 240, margin: 2 }).then(value => { if (!cancelled) setQr(value) }).catch(() => {})
    return () => { cancelled = true }
  }, [link])
  return <>
    <section className="tool-section connection-panel">
      <h2>{lan ? 'LAN broadcast' : 'Broadcast'}</h2>
      <p role="status">{broadcastStatus}</p>
      <p className="section-note" role="status">{attentionStatus}</p>
      <p className="section-note">Broadcast timers, Q Marks and notes to read-only viewers.</p>
      {lan ? <>
        <p>Connect viewers to the same Wi-Fi, start broadcasting, then scan the QR code.</p>
        {lan.viewerBases.length > 0 ? <label className="field"><span>LAN address for viewers</span>
          <select value={room?.viewerBaseUrl || viewerBase} disabled={!!room} onChange={e => setViewerBase(e.target.value)}>
            {lan.viewerBases.map(a => <option key={a.url} value={a.url}>{a.address}（{a.name}）</option>)}
          </select>
        </label> : <p role="alert">No LAN address found. Connect to Wi-Fi or Ethernet, then restart the LAN service.</p>}
        <div className="button-row">
          <button disabled={!viewerBase || !!room || broadcastStatus === 'Connecting…'} onClick={() => startBroadcast(lan.serviceUrl, lan.key, viewerBase)}>Start LAN broadcast</button>
          <button onClick={stopBroadcast}>Stop broadcast</button>
        </div>
        <p className="section-note">Keep the controller and host running. After changing Wi-Fi or IP, restart and share a new QR code. Choose an address on the viewers network.</p>
      </> : <>
      <label className="field"><span>Room creation key</span><input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
      <p className="section-note">Enter the key to start broadcasting, then share the QR code with viewers.</p>
      <details><summary>Advanced connection settings</summary>
        <label className="field"><span>Sync service URL</span><input disabled={!!room} placeholder={defaultSyncUrl} value={url} onChange={e => setUrl(e.target.value)} /></label>
        <button disabled={!!room} onClick={() => { setUrl(defaultSyncUrl); localStorage.removeItem('showtimer-service') }}>Restore default service</button>
      </details>
      <div className="button-row">
        <button disabled={!url || !!room || broadcastStatus === 'Connecting…'} onClick={() => { localStorage.setItem('showtimer-service', url); startBroadcast(url, key) }}>Start broadcast</button>
        <button onClick={stopBroadcast}>Stop broadcast</button>
      </div>
      <details className="lan-help"><summary>Broadcast on the same Wi-Fi?</summary>
        <p>Install <a href="https://nodejs.org/download/release/latest-v24.x/" target="_blank" rel="noopener noreferrer">Node.js 24</a>, run Start-LAN-Windows.cmd or npm run lan on the host, then open the displayed local URL. The host serves the app and broadcast without a fixed IP or cloud service.</p>
      </details>
      </>}
      {link && <div className="broadcast-share">
        {qr && <img width="240" height="240" src={qr} alt="Broadcast viewer QR code" />}
        <input className="share-link" aria-label="Viewer link" readOnly value={link} onFocus={e => e.target.select()} />
        <a href={link} target="_blank" rel="noreferrer">Open read-only viewer</a>
        <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopyStatus('Copied') } catch { setCopyStatus('Select and copy the link above') } }}>Copy viewer link</button>
        <span role="status">{copyStatus}</span>
      </div>}
    </section>
    <section className="tool-section connection-panel">
      <h2>OSC Control · TouchOSC / QLab</h2>
      <p role="status">{oscStatus}</p>
      <label className="field"><span>Local bridge URL</span><input value={oscUrl} onChange={e => setOscUrl(e.target.value)} /></label>
      <label className="field"><span>Pairing code from the bridge</span><input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
      <div className="button-row"><button disabled={!token} onClick={() => connectOsc(oscUrl, token)}>Connect OSC</button><button onClick={disconnectOsc}>Disconnect OSC</button></div>
      <p className="section-note">Run Start-OSC-Windows.cmd on Windows or Start-OSC-Mac.command on Mac. Paste the pairing code above and keep the controller in the foreground. Connect TouchOSC to the same LAN and send to the host IP on UDP 53001.</p>
      <details><summary>TouchOSC / QLab commands</summary><p>Use 127.0.0.1:53001 for QLab on this computer, or the host LAN IP:53001 for a phone. Send 1 on press; release value 0 is ignored. Messages without arguments are supported.</p>
        <code>/showtimer/start<br />/showtimer/pause<br />/showtimer/resume<br />/showtimer/next<br />/showtimer/mark</code>
        <p className="section-note">Next is ignored while paused. Duplicate commands within 0.5 seconds are ignored. Viewers cannot control the show.</p>
      </details>
    </section>
  </>
}
