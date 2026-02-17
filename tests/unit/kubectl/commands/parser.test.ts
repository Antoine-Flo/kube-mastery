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

describe('kubectl parser - describe', () => {
  it('should parse name when namespace flag is between resource and name', () => {
    const result = parseCommand('kubectl describe pod -n kube-system coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse resource and name when namespace flag is before resource', () => {
    const result = parseCommand('kubectl describe -n kube-system pod coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })
})

describe('kubectl parser - get and delete flag positions', () => {
  it('should parse get when namespace flag is before resource', () => {
    const result = parseCommand('kubectl get -n kube-system pods')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.namespace).toBe('kube-system')
    expect(result.value.name).toBeUndefined()
  })

  it('should parse get when namespace flag is between resource and name', () => {
    const result = parseCommand('kubectl get pod -n kube-system coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse delete when namespace flag is before resource', () => {
    const result = parseCommand('kubectl delete -n kube-system pod coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse delete when namespace flag is between resource and name', () => {
    const result = parseCommand('kubectl delete pod -n kube-system coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })
})
