export const toneContracts = [
  {
    "id": "protection-tone-0",
    "file": "packages/client/ui-tool/src/client/tool/toolviews/file-mutation-row.tsx",
    "before": "      errorSummary={model.errorSummary}\n      diff={diff}\n",
    "after": "      errorSummary={model.errorSummary}\n      errorTone={model.errorTone}\n      diff={diff}\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-1",
    "file": "packages/client/ui-tool/src/client/tool/toolviews/GenericToolCard.tsx",
    "before": "      errorSummary={autoReview?.summary ?? model.errorSummary}\n      terminal={terminal}\n",
    "after": "      errorSummary={autoReview?.summary ?? model.errorSummary}\n      errorTone={model.errorTone}\n      terminal={terminal}\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-2",
    "file": "packages/client/ui-tool/src/client/tool/models/tool-call-model.ts",
    "before": "  errorSummary: string | null\n  /** Structured Auto-review denial identity; null for every ordinary result. */\n",
    "after": "  errorSummary: string | null\n  /** Presentation only: recoverable file observation guards use the warning color. */\n  errorTone: 'error' | 'warning'\n  /** Structured Auto-review denial identity; null for every ordinary result. */\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-3",
    "file": "packages/client/ui-tool/src/client/tool/models/tool-call-model.ts",
    "before": "  const errorSummary = state === 'error' && output !== null ? firstLine(output) : null\n  const bodyRaw = argsRaw === '' ? null : argsRaw\n",
    "after": "  const errorSummary = state === 'error' && output !== null ? firstLine(output) : null\n  // Keep the failure state and protection semantics intact; only its UI tone changes.\n  const errorTone = state === 'error' && done && (variant === 'edit' || variant === 'write')\n    && (block.error?.code === 'FS_NOT_OBSERVED' || block.error?.code === 'FS_STALE_VERSION')\n    ? 'warning' : 'error'\n  const bodyRaw = argsRaw === '' ? null : argsRaw\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-4",
    "file": "packages/client/ui-tool/src/client/tool/models/tool-call-model.ts",
    "before": "    errorSummary,\n    autoReviewDenial: deriveAutoReviewDenial(block),\n",
    "after": "    errorSummary,\n    errorTone,\n    autoReviewDenial: deriveAutoReviewDenial(block),\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-5",
    "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx",
    "before": "  errorSummary?: string | null | undefined\n  /** Terminal card; card fields are mutually exclusive and replace text sections. */\n",
    "after": "  errorSummary?: string | null | undefined\n  /** Warning for recoverable file protection; other failures keep the error color. */\n  errorTone?: 'error' | 'warning' | undefined\n  /** Terminal card; card fields are mutually exclusive and replace text sections. */\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-6",
    "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx",
    "before": "  errorSummary,\n  terminal,\n",
    "after": "  errorSummary,\n  errorTone = 'error',\n  terminal,\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-7",
    "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx",
    "before": "  // A failure keeps its first result line when available and otherwise turns\n  // the ordinary summary red. An interruption turns the tool-owned summary\n  // amber while retaining the business icon and hidden state announcement.\n",
    "after": "  // A failure keeps its first result line when available and otherwise turns\n  // the ordinary summary red, or orange for file protection. An interruption turns the tool-owned summary\n  // amber while retaining the business icon and hidden state announcement.\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-8",
    "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx",
    "before": "          )}\n        >\n",
    "after": "          )}\n          data-tone={state === 'error' ? errorTone : undefined}\n        >\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-9",
    "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx",
    "before": "                                  <span className={css.ioLabel}>{t('row.output')}</span>\n                                  <span className={css.ioText} data-error={state === 'error' || undefined}>\n                                    {outputText}\n",
    "after": "                                  <span className={css.ioLabel}>{t('row.output')}</span>\n                                  <span className={css.ioText} data-error={state === 'error' || undefined} data-tone={state === 'error' ? errorTone : undefined}>\n                                    {outputText}\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  },
  {
    "id": "protection-tone-10",
    "file": "packages/client/ui-tool/src/client/tool/components/ToolRow.tsx",
    "before": "    imageBody, renderSlot, loadImage, searchBody, searchLabels, webBody, webLabels, inspect, t, onOpenFile,\n    variant, bodyText, cardBody, outputText, state,\n  ])\n",
    "after": "    imageBody, renderSlot, loadImage, searchBody, searchLabels, webBody, webLabels, inspect, t, onOpenFile,\n    variant, bodyText, cardBody, outputText, state, errorTone,\n  ])\n",
    "reason": "Recoverable filesystem observation guards are orange; execution errors remain errors."
  }
]
