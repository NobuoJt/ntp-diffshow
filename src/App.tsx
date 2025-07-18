import { useEffect, useRef, useState } from 'react'
import './App.css'

// NTPサーバーリスト型
interface NtpServer {
  name: string
  host: string
}

// NTP応答データ型
interface NtpResult {
  name: string
  host: string
  time: Date | null
  diffMs: number | null
  meta: Record<string, unknown>
  error?: string
}

// 統計データ型
interface Stats {
  avg: number
  sigma: number
  filteredAvg: number
  filteredSigma: number
}

// NTP over HTTP API (ローカルExpressサーバー経由)
async function fetchNtpTime(host: string): Promise<{ time: Date; meta: Record<string, unknown> }> {
  const res = await fetch(`https://ogaserve.pgw.jp:3001/api/ntp?host=${encodeURIComponent(host)}`)
  if (!res.ok) throw new Error('API error')
  const data = await res.json()
  return { time: new Date(data.time), meta: { host } }
}

function calcStats(results: NtpResult[]): Stats {
  const diffs = results.map(r => r.diffMs).filter((v): v is number => v !== null)
  if (diffs.length === 0) return { avg: 0, sigma: 0, filteredAvg: 0, filteredSigma: 0 }
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const sigma = Math.sqrt(diffs.reduce((a, b) => a + (b - avg) ** 2, 0) / diffs.length)
  // 1σ外を除外
  const filtered = diffs.filter(d => Math.abs(d - avg) <= sigma)
  const filteredAvg = filtered.length ? filtered.reduce((a, b) => a + b, 0) / filtered.length : 0
  const filteredSigma = filtered.length ? Math.sqrt(filtered.reduce((a, b) => a + (b - filteredAvg) ** 2, 0) / filtered.length) : 0
  return { avg, sigma, filteredAvg, filteredSigma }
}

function toColorSigma(sigma: number) {
  if (sigma >= 2) return '#f00'
  if (sigma >= 1) return '#e80'
  return '#090'
}

function toColorPogNeg(pogneg: number) {
  if (pogneg === 0) return '#000'
  if (pogneg > 0) return '#090'
  if (pogneg < 0) return '#f00'
  return '#f00'
}

// プラス記号付きで数値を表示する関数
function withSign(val: number | string | null, digits = 1) {
  if (val === null || val === undefined || val === '-') return '-'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return val
  return (num > 0 ? '+' : '') + num.toFixed(digits)
}

// 100msまで表示するtoLocaleTimeStringラッパー
function toTimeStringWithMs(date: Date | null,digits: number = 3): string {
  if (!date) return '-'
  // 一部環境でfractionalSecondDigits未対応のため手動で整形
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  const ms = (Math.floor(date.getMilliseconds() / 10 ** (digits-1))).toString().padStart(4-digits, '0')
  return `${h}:${m}:${s}.${ms}`
}

function App() {
  const [servers, setServers] = useState<NtpServer[]>([])
  const [results, setResults] = useState<NtpResult[]>([])
  const [stats, setStats] = useState<Stats>({ avg: 0, sigma: 0, filteredAvg: 0, filteredSigma: 0 })
  const [now, setNow] = useState<Date>(new Date())
  const [csv, setCsv] = useState('')
  const [meta, setMeta] = useState<Record<string, unknown>[]>([])
  const timerRef = useRef<number | null>(null)

  // サーバーリスト取得
  useEffect(() => {
    fetch('ntp_servers.json')
      .then(res => res.json())
      .then(setServers)
  }, [])

  // NTP時刻取得（初回のみ）
  useEffect(() => {
    if (servers.length === 0) return
    Promise.all(
      servers.map(async (s) => {
        try {
          const { time, meta } = await fetchNtpTime(s.host)
          return {
            name: s.name,
            host: s.host,
            time,
            diffMs: time.getTime() - Date.now(),
            meta,
          } as NtpResult
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e))
          return {
            name: s.name,
            host: s.host,
            time: null,
            diffMs: null,
            meta: {},
            error: err.message,
          } as NtpResult
        }
      })
    ).then(res => {
      setResults(res)
      setMeta(res.map(r => ({ name: r.name, ...r.meta })))
      console.log('NTP results:', res)
    })
  }, [servers])

  // 統計計算
  useEffect(() => {
    setStats(calcStats(results))
  }, [results])

  // ローカル時刻を毎秒更新
  useEffect(() => {
    timerRef.current = window.setInterval(() => setNow(new Date()), 1)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // CSV出力
  useEffect(() => {
    const header = ['name', 'host', 'ntp_time', 'diff_ms', 'dev.', 'sigma', 'filtered_dev.', 'filtered_sigma', 'error']

    const rows = results.map(r => [
      r.name,
      r.host,
      r.time ? r.time.toISOString() : '',
      r.diffMs ?? '',
      (r.diffMs ?? 0) - stats.avg,
      stats.sigma ? (((r.diffMs ?? 0) - stats.avg) / stats.sigma) : 0,
      (r.diffMs ?? 0) - stats.filteredAvg,
      stats.filteredSigma ? (((r.diffMs ?? 0) - stats.filteredAvg) / stats.filteredSigma) : 0,
      r.error ?? '',
    ])
    setCsv([header, ...rows].map(row => row.join(',')).join('\n'))
  }, [results, stats])
/*
                  <td>{(r.diffMs) ?? '-'}</td>
                  <td style={{ color: toColorPogNeg((r.diffMs ?? 0) - stats.avg) }}>
                    {r.diffMs !== null ? withSign(r.diffMs - stats.avg, 1) : '-'}
                  </td>
                  <td style={{ color: toColorSigma(Math.abs(sigmaVal)) }}>{withSign(sigmaVal, 2)}</td>
                  <td style={{ color: toColorPogNeg((r.diffMs ?? 0) - stats.filteredAvg) }}>
                    {r.diffMs !== null ? withSign(r.diffMs - stats.filteredAvg, 1) : '-'}
                  </td>
                  <td style={{ color: toColorSigma(Math.abs(filteredSigmaVal)) }}>{withSign(filteredSigmaVal, 2)}</td>
*/
  // グラフ用データ
  const graphData = results.map(r => ({
    name: r.name,
    diff: r.diffMs ?? 0,
    sigma: stats.sigma ? ((r.diffMs ?? 0 - stats.avg) / stats.sigma) : 0,
  }))

  return (
    <div>
      <h1>NTP Diff Show</h1>
      <h2 style={{ fontSize: '3em', margin: '0.5em 0', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
        {toTimeStringWithMs(new Date(now.getTime() + stats.filteredAvg),1)}<br />
        <span style={{ fontSize: '0.5em', color: '#888', fontFamily: 'sans-serif' }}>
          (推定現在時刻: ローカル+フィルタ後平均diff)
        </span>
      </h2>
      <div style={{ fontSize: '1.5em', marginBottom: 16, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr>
              <td>ローカル時刻: </td>
              <td>{toTimeStringWithMs(now,1)}</td>
            </tr>
            <tr>
              <td>平均diff: </td>
              <td>{stats.avg.toFixed(1)}ms</td>
              <td>  (σ: {stats.sigma.toFixed(1)}ms)</td>
            </tr>
            <tr>
              <td>フィルタ後平均diff: </td>
              <td>{stats.filteredAvg.toFixed(1)}ms</td>
              <td> (σ: {stats.filteredSigma.toFixed(1)}ms)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>サーバー名</th>
            <th>時刻</th>
            <th>diff(ms)</th>
            <th>偏差</th>
            <th>σ</th>
            <th>1σ/内偏差</th>
            <th>1σ内σ</th>
            <th>エラー</th>
          </tr>
        </thead>
        <tbody>
          {results
            .slice()
            .sort((a, b) => (a.diffMs ?? 0) - (b.diffMs ?? 0))
            .map((r) => {
              const sigmaVal = stats.sigma ? (((r.diffMs ?? 0) - stats.avg) / stats.sigma) : 0

              const filteredSigmaVal = stats.filteredSigma ? (((r.diffMs ?? 0) - stats.filteredAvg) / stats.filteredSigma) : 0
              return (
                <tr key={r.name} style={{ background: r.error ? '#fee' : '' }}>
                  <td>{r.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '1.1em', letterSpacing: '0.05em' }}>{r.diffMs ? toTimeStringWithMs(new Date(now.getTime() + r.diffMs)) : '-'}</td>
                  <td>{(r.diffMs) ?? '-'}</td>
                  <td style={{ color: toColorPogNeg((r.diffMs ?? 0) - stats.avg) }}>
                    {r.diffMs !== null ? withSign(r.diffMs - stats.avg, 1) : '-'}
                  </td>
                  <td style={{ color: toColorSigma(Math.abs(sigmaVal)) }}>{withSign(sigmaVal, 2)}</td>
                  <td style={{ color: toColorPogNeg((r.diffMs ?? 0) - stats.filteredAvg) }}>
                    {r.diffMs !== null ? withSign(r.diffMs - stats.filteredAvg, 1) : '-'}
                  </td>
                  <td style={{ color: toColorSigma(Math.abs(filteredSigmaVal)) }}>{withSign(filteredSigmaVal, 2)}</td>
                  <td>{r.error ?? ''}</td>
                </tr>
              )
            })}
        </tbody>
      </table>
      <h3>ばらつきグラフ</h3>
      <div style={{ height: 120, width: '100%', marginBottom: 24, display: 'flex', alignItems: 'flex-end', gap: 8, position: 'relative', zIndex: 1 }}>
        {graphData.sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0)).map((d) => (
          <div key={d.name} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', height: '100%' }}>
            <div style={{
              height: Math.abs(d.diff - stats.avg) / 2 + 10,
              background: toColorSigma(Math.abs(d.diff- stats.avg)/ stats.sigma),
              marginBottom: 0,
              borderRadius: 0,
              transition: 'height 0.5s',
              zIndex: 2,
              position: 'relative',
              width: '100%',
              minHeight: 0,
            }} />
            <div style={{ fontSize: 12, marginTop: 4 }}>{d.name}</div>
            <div style={{ fontSize: 10, color: toColorPogNeg(d.diff) }}>{withSign(d.diff, 0)}ms</div>
            <div style={{ fontSize: 10 ,color: toColorPogNeg((d.diff - stats.avg)) }}>{withSign(d.diff - stats.avg, 0)}ms</div>
          </div>
        ))}
      </div>
      <div style={{ height: 32 }} />
      <h3>取得時メタデータ</h3>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: '0.9em' }}>
        <thead>
          <tr>
            {meta[0] && Object.keys(meta[0]).map(k => <th key={k}>{k}</th>)}
            <th>取得時刻</th>
          </tr>
        </thead>
        <tbody>
          {meta.map((m, i) => (
            <tr key={i}>
              {Object.values(m).map((v, j) => <td key={j}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>)}
              <td style={{ fontFamily: 'monospace', fontSize: '1.1em', letterSpacing: '0.05em' }}>{results[i].time ? toTimeStringWithMs(results[i].time,1) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>CSV出力</h3>
      <textarea style={{ width: '100%', height: 120, fontFamily: 'monospace', fontSize: '1.1em', letterSpacing: '0.05em' }} value={csv} readOnly />
    </div>
  )
}

export default App
