export interface SavedEditorFile { path: string; text: string; saved: string; version: string }
export function acknowledgeSave(current: SavedEditorFile, written: { path: string; text: string; version: string }): SavedEditorFile {
  // A save response acknowledges the submitted text; typing during the request remains a draft.
  return { ...current, saved: written.text, version: written.version }
}
