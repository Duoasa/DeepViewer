// Append to the official sandboxed preload; only the fixed product origin receives allowlisted state.
;(function deepviewerStateMigration() {
  if (location.protocol !== 'dsh-app:' || location.hostname !== 'app' || !process.isMainFrame) return
  const { ipcRenderer } = require('electron')
  try {
    const values = ipcRenderer.sendSync('deepviewer-state-bootstrap')
    for (const [key, value] of Object.entries(values)) if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    void ipcRenderer.invoke('deepviewer-state-imported').catch(() => undefined)
  } catch (error) { console.error('DeepViewer frontend migration is pending', error) }
})()
