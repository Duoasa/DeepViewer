import { describe, expect, it } from 'vitest'
import { buildHarnessWebArgs, runtimeEnvironment } from '../src/main/resource-locator.js'

describe('Harness launch arguments', () => {
  it('keeps every embedded Web launch inside DeepViewer instead of opening the system browser', () => {
    expect(buildHarnessWebArgs(['node', 'bin.js'])).toEqual([
      'node', 'bin.js', 'web', '--port', '0', '--no-open',
    ])
    expect(buildHarnessWebArgs(['node', 'bin.js'], ['subscriptions.yml', 'preview.yml'])).toEqual([
      'node', 'bin.js',
      'web',
      '--patch', 'subscriptions.yml',
      '--patch', 'preview.yml',
      '--port', '0',
      '--no-open',
    ])
  })
})


describe('DSH Web runtime environment parity', () => {
  it.each(['read-only', 'workspace-write', 'danger-full-access'])(
    'passes the official %s permission mode through to DSH without overriding it', mode => {
      expect(runtimeEnvironment({ getPath: () => '/tmp/deepviewer-test' }, {
        DSH_PERMISSION_MODE: mode,
      }).DSH_PERMISSION_MODE).toBe(mode)
    },
  )

  it('leaves the official default in control when no permission mode is supplied', () => {
    expect(runtimeEnvironment({ getPath: () => '/tmp/deepviewer-test' }, {}))
      .not.toHaveProperty('DSH_PERMISSION_MODE')
  })

  it('inherits host tool configuration without sharing or mutating the source environment', () => {
    const inherited = {
      PATH: '/tools/bin:/usr/bin',
      SSH_AUTH_SOCK: '/tmp/test-agent.sock',
      CUSTOM_TOOL_CONFIG: '/tmp/tool-config',
      OPENAI_API_KEY: 'test-only-placeholder',
      HTTPS_PROXY: 'http://127.0.0.1:8080',
      DSH_HOME: '/tmp/external-dsh-home',
      ELECTRON_RUN_AS_NODE: '0',
      DSH_TELEMETRY_DISABLED: '0',
      FORCE_COLOR: '1',
    }
    const before = { ...inherited }
    const env = runtimeEnvironment({ getPath: () => '/tmp/deepviewer-test' }, inherited)
    expect(env).toEqual({
      ...inherited,
      ELECTRON_RUN_AS_NODE: '1',
      DSH_HOME: '/tmp/deepviewer-test/harness-home',
      DEEPVIEWER_PROJECTS_ROOT: '/tmp/deepviewer-test/DeepViewer/Projects',
      DEEPVIEWER_SESSION_SEARCH: '1',
      DSH_TELEMETRY_DISABLED: '1',
      FORCE_COLOR: '0',
    })
    expect(inherited).toEqual(before)
    expect(env).not.toBe(inherited)
  })
})
