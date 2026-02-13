import { describe, expect, it } from 'vitest'
import { parseCommand } from '../../../../src/core/kubectl/commands/parser'

describe('kubectl parser - create deployment', () => {
  it('should parse replicas and port for imperative create', () => {
    const result = parseCommand(
      'kubectl create deployment my-dep --image=nginx --replicas=3 --port=8080'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('my-dep')
    expect(result.value.replicas).toBe(3)
    expect(result.value.port).toBe(8080)
  })

  it('should parse namespace for imperative create', () => {
    const result = parseCommand(
      'kubectl create deployment my-dep --image=nginx -n staging'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.namespace).toBe('staging')
  })

  it('should parse repeated image flags and command after separator', () => {
    const result = parseCommand(
      'kubectl create deployment my-dep --image=busybox --image=nginx -- date'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.createImages).toEqual(['busybox', 'nginx'])
    expect(result.value.createCommand).toEqual(['date'])
  })

  it('should parse name when namespace flag is before the name', () => {
    const result = parseCommand(
      'kubectl create deployment -n staging my-dep --image=busybox'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.name).toBe('my-dep')
    expect(result.value.namespace).toBe('staging')
  })
})
