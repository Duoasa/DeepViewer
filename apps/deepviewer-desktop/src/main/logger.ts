import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface AppLogger {
  readonly filePath: string
  info(component: string, message: string): void
  error(component: string, message: string): void
}

const REDACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/\b(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi, '$1[REDACTED]'],
  [/\b(DEEPSEEK_API_KEY\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]'],
  [/\bsk-[a-zA-Z0-9_-]{12,}\b/g, '[REDACTED_KEY]'],
]

export function redactLogMessage(message: string): string {
  return REDACTIONS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), message)
}

export class FileLogger implements AppLogger {
  readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    mkdirSync(dirname(filePath), { recursive: true })
  }

  info(component: string, message: string): void {
    this.write('INFO', component, message)
  }

  error(component: string, message: string): void {
    this.write('ERROR', component, message)
  }

  private write(level: 'INFO' | 'ERROR', component: string, message: string): void {
    const sanitized = redactLogMessage(message).replace(/[\r\n]+$/u, '')
    appendFileSync(this.filePath, `${new Date().toISOString()} ${level} ${component} ${sanitized}\n`, { encoding: 'utf8' })
  }
}
