import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { ReasoningEditor, type ReasoningEditorProps } from './ReasoningEditor.tsx'
import styles from './ReasoningEditor.module.css'
type ScanRow = { id: string; availability: string; efforts: string[]; note: string; imageInput?: { status: string; note: string }; compat?: { supportsDeveloperRole?: boolean } }
export type ScanState = { status: string; id?: string; progress?: number; total?: number; discovered?: number; results?: ScanRow[]; startedAt?: string; stale?: boolean; truncated?: boolean; appliedAt?: string; canRestore?: boolean; error?: string }
type Props = ProviderCardExtrasOwnerProps & ReasoningEditorProps & { scan: (method: string, payload: object) => Promise<ScanState> }
const labels: Record<string, string> = { available: '可用', permission_denied: '权限受限（模型保留）', model_not_found: '模型不存在', unavailable: '不可用', 'non-text': '非文本候选', uncertain: '待确认' }
export function ProviderScan({ provider, configured, keyConfigured, mirror, write, t, scan }: Props) {
  const route = provider.provider
  const snapshot = useSyncExternalStore(callback => mirror.subscribe(callback), () => mirror.getSnapshot())
  const namespace = snapshot.view?.namespaces.find(view => view.ns === 'llm-pi-ai')
  const profile = ((namespace?.value ?? namespace?.user) as { providers?: Record<string, { api?: string; baseURL?: string }> })?.providers?.[route]
  const [state, setState] = useState<ScanState>({ status: 'loading' })
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [exclude, setExclude] = useState(false)
  useEffect(() => {
    let alive = true
    void scan('status', { route }).then(value => { if (alive) { setState(value); setError('') } }, () => { if (alive) setError('扫描服务暂不可用') })
    return () => { alive = false }
  }, [route, namespace?.revision, scan])
  useEffect(() => {
    if (state.status !== 'running') return
    let alive = true
    const timer = setInterval(() => { void scan('status', { route }).then(value => { if (alive) setState(value) }, () => { if (alive) setError('连接中断，扫描状态待确认；请勿重复启动') }) }, 1500)
    return () => { alive = false; clearInterval(timer) }
  }, [route, scan, state.status])
  const action = async (method: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { setState(await scan(method, { route, id: state.id, exclude })) }
    catch (error) { setError(error instanceof Error ? error.message : '扫描操作失败') }
    finally { setBusy(false) }
  }
  // This native keyed slot also renders the unsaved add-provider card.
  if (!configured || !profile) return <div className={styles.scan}><strong>模型能力扫描</strong><p>保存此 API 的地址和密钥后，可在这里扫描模型。</p></div>
  if (profile.api && !['openai-completions', 'openai-responses'].includes(profile.api)) return <div className={styles.scan}><p>{t('scanProtocols')}</p></div>
  const running = state.status === 'running', rows = state.results ?? []
  const pending = state.status === 'new' || state.stale
  const counts = Object.fromEntries(Object.keys(labels).map(key => [key, rows.filter(row => row.availability === key).length]))
  return <section className={styles.scan} aria-label={provider.displayName + ' 模型扫描'}>
    <div className={styles.scanHeader}><strong>模型能力扫描</strong><button type="button" disabled={busy || !keyConfigured || running || state.status === 'loading'} onClick={() => void action('start')}>{state.status === 'new' ? '扫描此 API' : '重新扫描'}</button></div>
    {pending && <p role="status">{state.stale ? '扫描规则或此 API 配置已变化，建议重新扫描。' : '此 API 尚未扫描。添加后扫描一次，可检查模型可用性、可选思考档位与图片输入。'}</p>}
    <p className={styles.hint}>检查模型可用性、思考档位和图片输入。仅访问此 API，不发送个人图片；可能产生 API 费用，可随时停止。</p>
    {!keyConfigured && <p>请先保存此 API 的密钥。</p>}
    {running && <div className={styles.scanHeader}><span role="status">{state.total ? `已扫描 ${state.progress ?? 0} / ${state.total}` : '读取模型目录…'}</span><button type="button" disabled={busy} onClick={() => void action('stop')}>停止扫描</button></div>}
    {state.startedAt && <p>最近扫描：{new Date(state.startedAt).toLocaleString()} · {({running:'进行中',complete:'完成',failed:'失败',cancelled:'已停止',interrupted:'已中断'} as Record<string,string>)[state.status] ?? state.status}</p>}
    {state.truncated && <p>目录共有 {state.discovered} 项，本次只扫描前 200 项；未扫描模型不会被删除。</p>}
    {rows.length > 0 && <>
      <div className={styles.metrics} aria-label="扫描结果摘要">
        <span><strong>{counts.available}</strong> 可用</span>
        <span><strong>{counts.permission_denied}</strong> 权限受限</span>
        <span><strong>{counts.uncertain}</strong> 待确认</span>
        <span><strong>{rows.filter(row => row.efforts.length).length}</strong> 已确认档位</span>
        <span><strong>{rows.filter(row => row.imageInput?.status === 'supported').length}</strong> 图片识别通过</span>
        {!!counts.model_not_found && <span>{counts.model_not_found} 模型不存在</span>}
        {!!counts['non-text'] && <span>{counts['non-text']} 非文本候选</span>}
      </div>
      <details className={styles.disclosure}><summary>查看逐模型结果（{rows.length}）</summary><div className={styles.results}><table><thead><tr><th>模型</th><th>可用性</th><th>思考档位</th><th>图片输入</th><th>说明</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.id}</td><td>{labels[row.availability]}</td><td>{row.efforts.length ? row.efforts.map(level => (({low:'低',medium:'中',high:'高'} as Record<string,string>)[level] ?? level)).join(' / ') : '待确认'}</td><td title={row.imageInput?.note}>{({ supported: '识别通过', unsupported: '不支持', uncertain: '待确认' } as Record<string,string>)[row.imageInput?.status ?? ''] ?? '未检测'}</td><td>{row.note}{row.compat?.supportsDeveloperRole === false && '；已检测到需使用 system 角色'}</td></tr>)}</tbody></table></div></details>

    </>}
    {state.status === 'complete' && !state.appliedAt && <>
      <label className={styles.check}><input type="checkbox" checked={exclude} onChange={e => setExclude(e.target.checked)}/>移除确认不存在的模型和非文本候选</label>
      <button type="button" disabled={busy || !!state.stale || !snapshot.view?.writable} onClick={() => void action('apply')}>应用模型与已确认能力</button>
    </>}
    {(state.appliedAt || state.canRestore) && <div className={styles.scanActions}>
      {state.appliedAt && <p role="status">扫描结果已应用</p>}
      {state.canRestore && <button type="button" className={styles.quietButton} disabled={busy || !snapshot.view?.writable} onClick={() => void action('restore')}>恢复原配置</button>}
    </div>}
    {(error || state.error) && <p role="alert">{error || state.error}</p>}
    <details className={styles.rules}>
      <summary>扫描范围与判断规则</summary>
      <p>{t(profile.api === 'openai-responses' ? 'scanLimitsResponses' : 'scanLimitsCompletions')}</p>
      <p>403/401 仅表示当前凭证受限，模型会保留在选择列表；只有连续确认明确的 model_not_found 才会在应用时移除。仅成功返回不代表支持档位；合法值成功且非法值被拒绝才会确认。超时、限流及预算不足保留待确认，不自动提高额度。已有手动档位不会因待确认结果被清除。图片需正确识别随机色块顺序才确认支持；未确认或不支持不会清除已有图片配置，可在下方手动调整。这里只检测图片输入，不检测图片生成、音频或视频。</p>
    </details>
    <ReasoningEditor mirror={mirror} write={write} t={t} fixedProvider={route}/>
  </section>
}
