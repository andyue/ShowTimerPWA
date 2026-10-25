import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useConnections } from '../stores/ConnectionsContext'
import { viewerUrl } from '../services/Broadcast'

export default function ConnectionsPanel() {
  const { room, broadcastStatus, startBroadcast, stopBroadcast, oscStatus, connectOsc, disconnectOsc } = useConnections()
  const [url, setUrl] = useState(() => localStorage.getItem('showtimer-service') || import.meta.env.VITE_SYNC_URL || '')
  const [key, setKey] = useState('')
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
      <h2>計時畫面廣播</h2>
      <p role="status">{broadcastStatus}</p>
      <label className="field"><span>同步服務位址</span><input placeholder="wss://your-service.example.com" value={url} onChange={e => setUrl(e.target.value)} /></label>
      <label className="field"><span>建立房間金鑰</span><input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
      <p className="section-note">需先部署同步服務。未設定時，本機計時仍可正常使用。</p>
      <div className="button-row">
        <button disabled={!url || !!room || broadcastStatus === '連線中…'} onClick={() => { localStorage.setItem('showtimer-service', url); startBroadcast(url, key) }}>開啟廣播</button>
        <button onClick={stopBroadcast}>停止廣播</button>
      </div>
      {link && <div className="broadcast-share">
        {qr && <img width="240" height="240" src={qr} alt="觀看廣播 QR Code" />}
        <a href={link} target="_blank" rel="noreferrer">開啟唯讀觀看畫面</a>
        <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopyStatus('已複製') } catch { setCopyStatus('請長按上方連結複製') } }}>複製觀看連結</button>
        <span role="status">{copyStatus}</span>
      </div>}
    </section>
    <section className="tool-section connection-panel">
      <h2>OSC Control · QLab</h2>
      <p role="status">{oscStatus}</p>
      <label className="field"><span>本機橋接位址</span><input value={oscUrl} onChange={e => setOscUrl(e.target.value)} /></label>
      <label className="field"><span>橋接程式顯示的配對碼</span><input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
      <div className="button-row"><button disabled={!token} onClick={() => connectOsc(oscUrl, token)}>連接 OSC</button><button onClick={disconnectOsc}>中斷 OSC</button></div>
      <p className="section-note">主控與 QLab 使用同一台 Mac，執行 npm run osc:bridge，並保持主控畫面在前景。若瀏覽器詢問區域網路權限，請允許。</p>
      <details><summary>QLab 指令</summary><p>UDP 127.0.0.1:53001；不帶參數，或傳送數值 1。</p>
        <code>/showtimer/start<br />/showtimer/pause<br />/showtimer/resume<br />/showtimer/next<br />/showtimer/mark</code>
        <p className="section-note">暫停中忽略 next；相同指令在 0.5 秒內去重。廣播觀看端不接收控制。</p>
      </details>
    </section>
  </>
}
