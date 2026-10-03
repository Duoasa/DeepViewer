import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ProviderScan, type ScanState } from './ProviderScan.tsx'
export const inject = ['slots', 'locale', 'configForms', 'remote.settings', 'connection']
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'deepviewer.reasoning': string }
}
const NS = 'deepviewer.reasoning'
export function apply(ctx: Context): void {
  const zh = { scanProtocols: '自动扫描支持 OpenAI Chat Completions 和 Responses 兼容接口。', scanLimitsResponses: '仅访问此 API。最多 200 个模型，每模型最多 7 次短请求（含内置色块图片检测），单次最多 64 输出 token、15 秒，并发 2。不发送个人图片，可能产生 API 费用，点击后开始，可随时停止。', scanLimitsCompletions: '仅访问此 API。最多 200 个模型，每模型最多 7 次短请求（含内置色块图片检测），单次最多 1 输出 token、15 秒，并发 2。不发送个人图片，可能产生 API 费用，点击后开始，可随时停止。', title: '手动配置模型能力', imageInput: '图片输入', textOnly: '仅文本', textImage: '文本和图片', imageNote: '只声明图片输入，不代表图片生成、音频或视频。仅启用此 API 确实支持的能力。', description: '为此 API 的模型配置图片输入与思考档位，保存后使用原生上传和模型菜单。', provider: '提供方', model: '模型', choose: '请选择', inherit: '使用默认能力', disabled: '不提供强度选择', custom: '自定义档位', mode: '能力配置', level: '档位', wire: '接口值', preset: '填入低 / 中 / 高', save: '保存', reload: '重新读取', saving: '保存中…', saved: '模型能力已保存', stale: '配置已变化，请重新读取后再保存', unavailable: '暂无可编辑的自定义模型', off: '关闭', minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '极高', max: '最高', note: '关闭档位的接口值留空表示不发送思考参数，不能保证服务商停止思考。', error: '保存失败' }
  const en = { scanProtocols: 'Automatic scanning supports OpenAI Chat Completions and Responses compatible APIs.', scanLimitsResponses: 'Up to 200 models and 7 short requests per model, including a synthetic color image. Each request is capped at 64 output tokens and 15 seconds; concurrency is 2. No personal images are sent. API charges may apply. Start explicitly and stop at any time.', scanLimitsCompletions: 'Up to 200 models and 7 short requests per model, including a synthetic color image. Each request is capped at 1 output token and 15 seconds; concurrency is 2. No personal images are sent. API charges may apply. Start explicitly and stop at any time.', title: 'Manual model capabilities', imageInput: 'Image input', textOnly: 'Text only', textImage: 'Text and images', imageNote: 'Declares image input only, not image generation, audio or video. Enable only capabilities this API supports.', description: 'Declare supported levels per custom model, then choose an effort in the conversation model menu. Enable only levels supported by your provider.', provider: 'Provider', model: 'Model', choose: 'Select', inherit: 'Use default capability', disabled: 'No effort selector', custom: 'Custom levels', mode: 'Capability', level: 'Level', wire: 'API value', preset: 'Fill low / medium / high', save: 'Save', reload: 'Reload', saving: 'Saving…', saved: 'Saved. Choose effort in the conversation model menu.', stale: 'Settings changed. Reload before saving.', unavailable: 'No editable custom models', off: 'Off', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Maximum', note: 'An empty Off value omits the reasoning parameter; it does not guarantee that the provider stops thinking.', error: 'Save failed' }
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'reasoning: locale')
  const mirror = ctx.configForms.describe()
  const connection = ctx.get('connection') as ConnectionHandle
  const t = ctx.locale.bind(NS)
  const write = async (op: SettingsPathOpView, revision: number) => {
    const response = await ctx.remote.settings.mutate('llm-pi-ai', [op], revision)
    if (!response.ok) throw new Error(response.error.message)
    mirror.acceptView(response.value)
    return response.value
  }
  const scan = async (method: string, payload: object) => {
    const response = await connection.rpc.call('/deepviewer-model-scans', method, payload)
    if (!response.ok) throw new Error(response.error.message)
    if (method === 'apply' || method === 'restore') {
      const fresh = await ctx.remote.settings.describe()
      if (fresh.ok) for (const view of fresh.value.namespaces) if (view.ns === 'llm-pi-ai') mirror.acceptView(view)
    }
    return response.value as ScanState
  }
  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
    name: 'settings.models.provider-card', key: 'llm-pi-ai',
    inject: () => ({ mirror, write, t, scan }),
  }, ProviderScan))
}
