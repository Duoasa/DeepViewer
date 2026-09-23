import type { SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
export const LEVELS: readonly string[]
export function validateEfforts(mode: string, rows: Record<string, string>): Record<string, string | null> | false | undefined
export function modelEdit(view: Omit<SettingsNamespaceView, 'user'> & { user?: unknown }, route: string, id: string, mode: string, rows: Record<string, string>, imageMode?: string): SettingsPathOpView
