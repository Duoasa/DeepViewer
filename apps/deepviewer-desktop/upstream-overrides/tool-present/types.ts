/** Durable file deliveries produced by the present tool. */
import type { ToolExecution } from '@deepseek-ai/dsh-tools'

import type { ToolCallId } from '@deepseek-ai/dsh-llm/brand'

/** A declared filesystem file whose current contents remain at its source path. */
export interface PresentedFile {
  /** Original absolute path or path relative to the Session working directory. */
  path: string
  /** Optional description supplied by the model. */
  description?: string
  /** Internal source aliases; only path is a user-facing open target. */
  sourcePaths?: string[]
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Declared filesystem files from a successful final present result, including nested calls. */
    'deliverables/presented': { turn: number; callId: ToolCallId; files: PresentedFile[] }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /** Host delivery policy; the default preserves standalone DSH behavior. */
    'deliverables/prepare'(exec: ToolExecution, files: PresentedFile[], next: () => Promise<PresentedFile[]>): Promise<PresentedFile[]>
  }
}
