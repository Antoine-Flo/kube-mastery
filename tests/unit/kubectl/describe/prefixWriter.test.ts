import { describe, expect, it } from 'vitest'
import {
  LEVEL_0,
  createStringPrefixWriter
} from '../../../../src/core/kubectl/describe/prefixWriter'

describe('PrefixWriter', () => {
  it('indents by level with two spaces per level', () => {
    const writer = createStringPrefixWriter()
    writer.write(LEVEL_0, '%s', 'line\n')
    writer.write(1, '%s', 'nested\n')
    expect(writer.toString()).toContain('line')
    expect(writer.toString()).toContain('  nested')
  })
})
