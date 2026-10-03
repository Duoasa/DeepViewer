// Application composition owns these modules; they are not profile-installed bundles.
export const nativeModuleContracts = [
  {
    id: 'native-deepviewer-diagnostic-escape', file: 'packages/boot/app-boot/src/profile-context.ts',
    before: '  if (telemetryPatch !== undefined) patches.push(telemetryPatch)\n  return patches',
    previousAfter: "  if (telemetryPatch !== undefined) patches.push(telemetryPatch)\n  if (process.env.DEEPVIEWER_DISABLE_BUILTINS === '1') {\n    const ids = new Set(['deepviewer-adapter', 'preset-deepviewer-chat', 'llm-subscriptions', 'model-capabilities'])\n    for (const row of composeEntries([patches])) if (ids.has(row.id)) patches.push({ id: row.id, disabled: true })\n  }\n  return patches",
    after: "  if (telemetryPatch !== undefined) patches.push(telemetryPatch)\n  if (process.env.DEEPVIEWER_DISABLE_BUILTINS === '1') {\n    const ids = new Set(['deepviewer-adapter', 'preset-deepviewer-chat', 'llm-subscriptions', 'model-capabilities'])\n    for (const row of composeEntries([patches])) if (ids.has(row.id)) patches.push({ id: row.id, disabled: true })\n  }\n  const deepviewerFeedbackIds = new Set(['ui-message-feedback', 'message-feedback', 'command-feedback', 'session-log-deepseek', 'session-telemetry-otel'])\n  for (const row of composeEntries([patches])) if (deepviewerFeedbackIds.has(row.id)) patches.push({ id: row.id, disabled: true })\n  return patches",
    reason: 'The diagnostic pure-core launch flag must win over stale explicit profile overrides; ordinary external plugin recovery retains built-ins.',
  },
  {
    id: 'native-deepviewer-composition', file: 'packages/bundle/web-app/package.json',
    before: '        "./presets/cordis.patch.yml"\n      ]',
    after: '        "./presets/cordis.patch.yml",\n        "./deepviewer.patch.yml"\n      ]',
    reason: 'Native Web application composition owns the DeepViewer rows and client discovery.',
  },
  {
    id: 'native-deepviewer-composition-shipping', file: 'packages/bundle/web-app/package.json',
    before: '    "cordis.patch.yml",\n    "presets/standard.patch.yml",',
    after: '    "cordis.patch.yml",\n    "deepviewer.patch.yml",\n    "presets/standard.patch.yml",',
    reason: 'The production dependency closure ships the application-owned composition.',
  },
]
