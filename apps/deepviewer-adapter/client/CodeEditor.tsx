import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'

function language(path: string) {
  const extension = path.split('.').at(-1)?.toLowerCase()
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(extension ?? '')) return javascript({ jsx: extension?.endsWith('x'), typescript: extension?.startsWith('t') })
  if (extension === 'json') return json()
  if (extension === 'md') return markdown()
  if (extension === 'py') return python()
  if (['html', 'htm'].includes(extension ?? '')) return html()
  if (extension === 'css') return css()
  return []
}
export function CodeEditor({ path, text, label, onChange, onSave }: { path: string; text: string; label: string; onChange: (text: string) => void; onSave: () => void }) {
  const container = useRef<HTMLDivElement>(null), editor = useRef<EditorView | undefined>(undefined)
  const callbacks = useRef({ onChange, onSave }); callbacks.current = { onChange, onSave }
  useEffect(() => {
    const view = new EditorView({ parent: container.current!, state: EditorState.create({ doc: text, extensions: [
      lineNumbers(), history(), highlightActiveLine(), drawSelection(), bracketMatching(), foldGutter(), highlightSelectionMatches(), syntaxHighlighting(defaultHighlightStyle), language(path),
      keymap.of([{ key: 'Mod-s', run: () => { callbacks.current.onSave(); return true } }, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]),
      EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
      EditorView.theme({ '&': { height: '100%', color: 'var(--dsw-alias-label-primary)', backgroundColor: 'var(--dsw-alias-bg-base)' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'Menlo, monospace', fontSize: '12px' }, '.cm-gutters': { color: 'var(--dsw-alias-label-tertiary)', background: 'var(--dsw-alias-bg-l1)', borderRight: 'none' }, '.cm-activeLine': { background: 'color-mix(in srgb, currentColor 5%, transparent)' }, '.cm-cursor': { borderLeftColor: 'currentColor' } }),
      EditorView.updateListener.of(update => { if (update.docChanged) callbacks.current.onChange(update.state.doc.toString()) }),
    ] }) }); editor.current = view
    return () => { view.destroy(); editor.current = undefined }
    // Document identity creates an editor; ordinary edits preserve selection, undo and scroll.
  }, [path, label])
  useEffect(() => { const view = editor.current; if (view && view.state.doc.toString() !== text) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }) }, [text])
  return <div ref={container} style={{ flex: 1, minHeight: 0 }} data-deepviewer-editor="" />
}
