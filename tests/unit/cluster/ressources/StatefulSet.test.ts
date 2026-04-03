import { describe, expect, it } from 'vitest'
import { parseStatefulSetManifest } from '../../../../src/core/cluster/ressources/StatefulSet'
import { parseKubernetesYaml } from '../../../../src/core/kubectl/yamlParser'

const buildManifestWithExpression = (expression: {
  key: string
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist'
  values?: string[]
}) => {
  return {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: {
      name: 'test-sts'
    },
    spec: {
      selector: {
        matchExpressions: [expression]
      },
      template: {
        metadata: {
          labels: {
            app: 'nginx'
          }
        },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx' }]
        }
      }
    }
  }
}

describe('parseStatefulSetManifest', () => {
  it('rejects In operator with missing values', () => {
    const manifest = buildManifestWithExpression({
      key: 'app',
      operator: 'In'
    })

    const result = parseStatefulSetManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('rejects In operator with empty values array', () => {
    const manifest = buildManifestWithExpression({
      key: 'app',
      operator: 'In',
      values: []
    })

    const result = parseStatefulSetManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('rejects NotIn operator with missing values', () => {
    const manifest = buildManifestWithExpression({
      key: 'app',
      operator: 'NotIn'
    })

    const result = parseStatefulSetManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('rejects Exists operator with non-empty values', () => {
    const manifest = buildManifestWithExpression({
      key: 'app',
      operator: 'Exists',
      values: ['nginx']
    })

    const result = parseStatefulSetManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('rejects DoesNotExist operator with non-empty values', () => {
    const manifest = buildManifestWithExpression({
      key: 'app',
      operator: 'DoesNotExist',
      values: ['nginx']
    })

    const result = parseStatefulSetManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('accepts Exists operator with empty values array', () => {
    const manifest = buildManifestWithExpression({
      key: 'app',
      operator: 'Exists',
      values: []
    })

    const result = parseStatefulSetManifest(manifest)
    expect(result.ok).toBe(true)
  })
})

describe('parseKubernetesYaml StatefulSet selector validation', () => {
  it('rejects In operator with empty values through full YAML flow', () => {
    const yamlManifest = `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: test-sts
spec:
  selector:
    matchExpressions:
      - key: app
        operator: In
        values: []
  template:
    spec:
      containers:
        - name: nginx
          image: nginx
`

    const result = parseKubernetesYaml(yamlManifest)
    expect(result.ok).toBe(false)
  })
})
