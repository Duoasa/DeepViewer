// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ToolResultNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import { useDisclosure } from '@deepseek-ai/dsh-client-ui-chat/src/client/chat/use-disclosure.ts'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { toolRowModel } from '../src/client/tool/models/tool-call-model.ts'
import { GenericToolCard } from '../src/client/tool/toolviews/GenericToolCard.tsx'

const t = makeTranslate(zh, commonZh)
const notice = 'Read the file before editing.\nThe protection remains active.'
const failed = (name: string, code: string): ToolResultNode => ({
  kind: 'tool-result', seq: 10, time: 2000, callId: 'guard', callTime: 1000,
  call: { name, argsRaw: '{"file_path":"src/example.ts"}' },
  content: [{ type: 'text', text: notice }], isError: true, subCalls: [],
  error: { name: 'FsError', code },
})
afterEach(cleanup)

describe('DeepViewer file protection tone', () => {
  it.each(['edit', 'write'])('%s uses warnings for observation guards without changing failure semantics', name => {
    for (const code of ['FS_NOT_OBSERVED', 'FS_STALE_VERSION']) {
      const model = toolRowModel(name, failed(name, code))
      expect(model.errorTone).toBe('warning')
      expect(model.state).toBe('error')
      expect(model.output).toBe(notice)
      expect(model.errorSummary).toBe('Read the file before editing.')
    }
  })
  it.each(['FS_PERMISSION_DENIED', 'FS_SANDBOX_DENIED', 'FS_IO_ERROR', 'FS_EDIT_NOT_FOUND'])('keeps actual %s errors red, even with protection-like text', code => {
    expect(toolRowModel('edit', failed('edit', code)).errorTone).toBe('error')
  })
  it('does not infer a warning from text or from an unrelated tool', () => {
    expect(toolRowModel('bash', failed('bash', 'FS_NOT_OBSERVED')).errorTone).toBe('error')
    expect(toolRowModel('edit', { ...failed('edit', 'FS_NOT_OBSERVED'), error: { name: 'Error', code: 'unknown' } }).errorTone).toBe('error')
    expect(toolRowModel('edit', { ...failed('edit', 'FS_NOT_OBSERVED'), isError: false }).errorTone).toBe('error')
  })
  it.each([
    ['FS_NOT_OBSERVED', 'warning'], ['FS_STALE_VERSION', 'warning'], ['FS_IO_ERROR', 'error'],
  ])('renders %s consistently in the collapsed summary and expanded output', (code, tone) => {
    const view = render(<GenericToolCard phase="result" block={failed('edit', code)}
      toolName="edit" callId="guard" useDisclosure={useDisclosure} t={t}
      openFile={() => {}} loadImage={async () => { throw new Error('Image loader is unused in this test') }} />)
    expect(view.container.querySelector('[data-state]')?.getAttribute('data-state')).toBe('error')
    expect(view.container.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe(tone)
    fireEvent.click(view.getByRole('button'))
    expect(view.container.querySelector('[data-error]')?.getAttribute('data-tone')).toBe(tone)
    expect(view.getByText(/The protection remains active/)).toBeTruthy()
  })
  it('uses the shared warning color for both surfaces and preserves the red default', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/client/tool/components/ToolRow.module.css'), 'utf8')
    expect(css).toMatch(/\.errorSummary\[data-tone="warning"\],\s*\.ioText\[data-error\]\[data-tone="warning"\]\s*\{\s*color: var\(--dsw-alias-state-warn-primary\)/)
    expect(css).toMatch(/\.errorSummary\s*\{\s*color: var\(--dsw-alias-state-error-primary\)/)
    expect(css).toContain('.summary:not(.errorSummary):not(.stoppedSummary)')
  })
})
