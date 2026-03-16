import { describe, expect, it } from 'vitest'

import { getSeedPath } from '../../../bin/lib/cluster-manager'

describe('cluster-manager', () => {
  it('getSeedPath returns path under courses seeds', () => {
    const path = getSeedPath('minimal')
    expect(path).toContain('seeds')
    expect(path).toContain('minimal')
  })
})
