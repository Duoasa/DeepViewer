import { defineStore } from '@deepseek-ai/dsh-client-store'
import { acknowledgeSave } from './editor-save.ts'
export interface EditorFile { path: string; text: string; saved: string; version: string }
export function createEditorStore() {
  return defineStore({ init: (): { byPath: Record<string, EditorFile> } => ({ byPath: {} }), persist: 'deepviewer.editor.v1', actions: {
    loaded: (draft, file: { path: string; text: string; version: string }) => { draft.byPath[file.path] = { ...file, saved: file.text } },
    saved: (draft, file: { path: string; text: string; version: string }) => { const current = draft.byPath[file.path]; if (current) draft.byPath[file.path] = acknowledgeSave(current, file) },
    edit: (draft, path: string, text: string) => { const file = draft.byPath[path]; if (file) file.text = text },
  } })
}
export type EditorStore = ReturnType<typeof createEditorStore>
