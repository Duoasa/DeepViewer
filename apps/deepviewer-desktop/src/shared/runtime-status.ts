export type RuntimePhase = 'stopped' | 'starting' | 'ready' | 'stopping' | 'failed'
export type NativeThemeSource = 'light' | 'dark'

export interface RuntimeStatusView {
  phase: RuntimePhase
  attempt: number
  changedAt: string
  errorCode?: string
  userMessage?: string
}

export interface DeepViewerDesktopApi {
  getRuntimeStatus(): Promise<RuntimeStatusView>
  retryRuntime(): Promise<void>
  openLogDirectory(): Promise<void>
  setNativeThemeSource(source: NativeThemeSource): void
  onRuntimeStatus(listener: (status: RuntimeStatusView) => void): () => void
}
