import { describe, expect, it } from 'vitest'
import { buildHarnessWebArgs } from '../src/main/resource-locator.js'

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
