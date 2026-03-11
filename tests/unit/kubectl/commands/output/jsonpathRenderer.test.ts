import { describe, expect, it } from 'vitest'
import { renderKubectlJsonPath } from '../../../../../src/core/kubectl/commands/output/jsonpath/renderer'

const samplePayload = {
  kind: 'List',
  items: [
    {
      metadata: {
        name: 'node-a'
      },
      status: {
        addresses: [
          { type: 'InternalIP', address: '10.0.0.10' },
          { type: 'ExternalIP', address: '35.1.1.1' }
        ],
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'MemoryPressure', status: 'False' }
        ],
        initContainerStatuses: [
          { containerID: 'containerd://init-a' },
          { containerID: 'containerd://init-b' }
        ]
      }
    },
    {
      metadata: {
        name: 'node-b'
      },
      status: {
        addresses: [
          { type: 'InternalIP', address: '10.0.0.11' },
          { type: 'ExternalIP', address: '35.1.1.2' }
        ],
        conditions: [{ type: 'Ready', status: 'True' }],
        initContainerStatuses: [{ containerID: 'containerd://init-c' }]
      }
    }
  ],
  users: [
    {
      name: 'myself',
      user: {}
    },
    {
      name: 'e2e',
      user: { username: 'admin', password: 'secret' }
    }
  ]
}

describe('kubectl jsonpath renderer', () => {
  it('supports [] shortcut as first element', () => {
    const result = renderKubectlJsonPath(samplePayload, '{.users[].name}')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe('myself')
  })

  it('supports wildcard list extraction', () => {
    const result = renderKubectlJsonPath(samplePayload, '{.users[*].name}')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe('myself e2e')
  })

  it('supports filters with jsonpath-plus', () => {
    const result = renderKubectlJsonPath(
      samplePayload,
      '{.items[*].status.addresses[?(@.type=="ExternalIP")].address}'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe('35.1.1.1 35.1.1.2')
  })

  it('supports nested range blocks with @ context', () => {
    const result = renderKubectlJsonPath(
      samplePayload,
      '{range .items[*]}{@.metadata.name}:{range @.status.conditions[*]}{@.type}={@.status};{end}{end}'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe(
      'node-a:Ready=True;MemoryPressure=False;node-b:Ready=True;'
    )
  })

  it('supports literal escapes in template blocks', () => {
    const result = renderKubectlJsonPath(
      samplePayload,
      '{range .items[*].status.initContainerStatuses[*]}{.containerID}{"\\n"}{end}'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe(
      'containerd://init-a\ncontainerd://init-b\ncontainerd://init-c\n'
    )
  })

  it('rejects regex filters as unsupported', () => {
    const result = renderKubectlJsonPath(
      samplePayload,
      '{.items[?(@.metadata.name=~/^node-a$/)].metadata.name}'
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('regular expressions are not supported')
    }
  })
})
