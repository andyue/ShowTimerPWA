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
  const { room, broadcastStatus, startBroadcast, stopBroadcast, oscStatus, connectOsc, disconnectOsc } = useConnections()
  const [url, setUrl] = useState(() => localStorage.getItem('showtimer-service') || import.meta.env.VITE_SYNC_URL || '')
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
      <h2>{lan ? '區網廣播' : '計時畫面廣播'}</h2>
      <p role="status">{broadcastStatus}</p>
      <p className="section-note">計時、Q Marks 與備註會一起廣播，接收端為唯讀。</p>
      {lan ? <>
        <p>讓手機連同一個 Wi-Fi，開啟廣播後掃碼觀看計時與 Q Marks。</p>
        {lan.viewerBases.length > 0 ? <label className="field"><span>手機使用的區網位址</span>
          <select value={room?.viewerBaseUrl || viewerBase} disabled={!!room} onChange={e => setViewerBase(e.target.value)}>
            {lan.viewerBases.map(a => <option key={a.url} value={a.url}>{a.address}（{a.name}）</option>)}
          </select>
        </label> : <p role="alert">尚未找到區網位址。請連接 Wi-Fi 或網路線，再重新啟動區網服務。</p>}
        <div className="button-row">
          <button disabled={!viewerBase || !!room || broadcastStatus === '連線中…'} onClick={() => startBroadcast(lan.serviceUrl, lan.key, viewerBase)}>開啟區網廣播</button>
          <button onClick={stopBroadcast}>停止廣播</button>
        </div>
        <p className="section-note">請保持主控與啟動視窗開啟。更換 Wi-Fi／IP 後，重新啟動並分享新的 QR Code。多個位址時，選擇與手機同一個網路的位址。</p>
      </> : <>
      <label className="field"><span>同步服務位址</span><input placeholder="wss://your-service.example.com" value={url} onChange={e => setUrl(e.target.value)} /></label>
      <label className="field"><span>建立房間金鑰</span><input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
      <p className="section-note">需先部署同步服務。未設定時，本機計時仍可正常使用。</p>
      <div className="button-row">
        <button disabled={!url || !!room || broadcastStatus === '連線中…'} onClick={() => { localStorage.setItem('showtimer-service', url); startBroadcast(url, key) }}>開啟廣播</button>
        <button onClick={stopBroadcast}>停止廣播</button>
      </div>
      <details className="lan-help"><summary>只想在同一個 Wi-Fi 廣播？</summary>
        <p>先安裝 <a href="https://nodejs.org/download/release/latest-v24.x/" target="_blank" rel="noopener noreferrer">Node.js 24</a>，在現場電腦啟動「Start-LAN-Windows.cmd」或執行 npm run lan，再開啟終端機顯示的本機網址。網頁與廣播都由該電腦提供，不需固定 IP 或雲端服務。</p>
      </details>
      </>}
      {link && <div className="broadcast-share">
        {qr && <img width="240" height="240" src={qr} alt="觀看廣播 QR Code" />}
        <input className="share-link" aria-label="觀看連結" readOnly value={link} onFocus={e => e.target.select()} />
        <a href={link} target="_blank" rel="noreferrer">開啟唯讀觀看畫面</a>
        <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopyStatus('已複製') } catch { setCopyStatus('請長按上方連結複製') } }}>複製觀看連結</button>
        <span role="status">{copyStatus}</span>
      </div>}
    </section>
    <section className="tool-section connection-panel">
      <h2>OSC Control · TouchOSC / QLab</h2>
      <p role="status">{oscStatus}</p>
      <label className="field"><span>本機橋接位址</span><input value={oscUrl} onChange={e => setOscUrl(e.target.value)} /></label>
      <label className="field"><span>橋接程式顯示的配對碼</span><input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
      <div className="button-row"><button disabled={!token} onClick={() => connectOsc(oscUrl, token)}>連接 OSC</button><button onClick={disconnectOsc}>中斷 OSC</button></div>
      <p className="section-note">Windows 開啟 Start-OSC-Windows.cmd；Mac 開啟 Start-OSC-Mac.command。把終端機配對碼貼到上方，並保持主控畫面在前景。TouchOSC／OSC 遙控器請連同一區網，發送到終端機顯示的電腦 IP，UDP 53001。</p>
      <details><summary>TouchOSC／QLab 指令</summary><p>同機 QLab 使用 127.0.0.1:53001；手機使用電腦的區網 IP:53001。按下傳送數值 1，放開的 0 會忽略，也支援不帶參數。</p>
        <code>/showtimer/start<br />/showtimer/pause<br />/showtimer/resume<br />/showtimer/next<br />/showtimer/mark</code>
        <p className="section-note">暫停中忽略 next；相同指令在 0.5 秒內去重。廣播觀看端不接收控制。</p>
      </details>
    </section>
  </>
}
