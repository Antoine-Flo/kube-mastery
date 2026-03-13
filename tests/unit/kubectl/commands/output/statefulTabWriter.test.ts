import { describe, expect, it } from 'vitest'
import {
  createStatefulTabWriter,
  tryParseTableOutput
} from '../../../../../src/core/kubectl/commands/output/statefulTabWriter'

describe('statefulTabWriter', () => {
  it('keeps grown column widths across deltas', () => {
    const writer = createStatefulTabWriter({ spacing: 3 })
    writer.ingestHeaderAndRows(
      ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'],
      [['pod-a', '0/1', 'Pending', '11', '1s']]
    )

    const longStatusDelta = writer.formatDelta([
      ['pod-b', '0/1', 'ImagePullBackOff', '22', '2s']
    ])
    expect(longStatusDelta).toHaveLength(1)
    const longLine = longStatusDelta[0]
    const longRestartsIndex = longLine.indexOf('22')
    expect(longRestartsIndex).toBeGreaterThan(0)

    const shortStatusDelta = writer.formatDelta([
      ['pod-c', '0/1', 'ErrImagePull', '33', '3s']
    ])
    expect(shortStatusDelta).toHaveLength(1)
    const shortLine = shortStatusDelta[0]
    const shortRestartsIndex = shortLine.indexOf('33')
    expect(shortRestartsIndex).toBe(longRestartsIndex)
  })

  it('uses minimum width constraints by header name', () => {
    const withoutMinWidth = createStatefulTabWriter({ spacing: 3 })
    withoutMinWidth.ingestHeaderAndRows(
      ['NAME', 'STATUS', 'RESTARTS'],
      [['pod-a', 'Run', '1']]
    )
    const withoutMinLine = withoutMinWidth.formatRows([['pod-b', 'Run', '2']])[0]

    const withMinWidth = createStatefulTabWriter({
      spacing: 3,
      minColumnWidthsByHeader: { STATUS: 'ImagePullBackOff'.length }
    })
    withMinWidth.ingestHeaderAndRows(
      ['NAME', 'STATUS', 'RESTARTS'],
      [['pod-a', 'Run', '1']]
    )
    const withMinLine = withMinWidth.formatRows([['pod-b', 'Run', '2']])[0]

    expect(withMinLine.indexOf('2')).toBeGreaterThan(withoutMinLine.indexOf('2'))
  })

  it('returns only newly introduced rows in delta mode', () => {
    const writer = createStatefulTabWriter({ spacing: 3 })
    writer.ingestHeaderAndRows(
      ['NAME', 'READY', 'STATUS'],
      [['pod-a', '1/1', 'Running']]
    )

    const firstDelta = writer.formatDelta([
      ['pod-a', '1/1', 'Running'],
      ['pod-b', '0/1', 'Pending']
    ])
    expect(firstDelta).toEqual([expect.stringContaining('pod-b')])

    const secondDelta = writer.formatDelta([
      ['pod-a', '1/1', 'Running'],
      ['pod-b', '0/1', 'Pending']
    ])
    expect(secondDelta).toEqual([])
  })

  it('parses table output and rejects non-tabular output', () => {
    const parsed = tryParseTableOutput(`NAME   READY\npod-a   1/1`)
    expect(parsed).not.toBeNull()
    if (parsed == null) {
      return
    }
    expect(parsed.header).toEqual(['NAME', 'READY'])
    expect(parsed.rows).toEqual([['pod-a', '1/1']])
    expect(tryParseTableOutput('No resources found')).toBeNull()
  })
})
