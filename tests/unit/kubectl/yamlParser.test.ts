import { describe, expect, it } from 'vitest'
import {
  parseKubernetesYaml,
  parseKubernetesYamlDocuments
} from '../../../src/core/kubectl/yamlParser'

describe('yamlParser', () => {
  it('should parse multi-document YAML with comment separators', () => {
    const yamlContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: first
  namespace: default
data:
  key: value
--- # second document
apiVersion: v1
kind: ConfigMap
metadata:
  name: second
  namespace: default
data:
  key: value
`

    const result = parseKubernetesYamlDocuments(yamlContent)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toHaveLength(2)
    expect(result.value[0].metadata.name).toBe('first')
    expect(result.value[1].metadata.name).toBe('second')
  })

  it('should reject multi-document YAML in single-document parser', () => {
    const yamlContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: first
  namespace: default
data:
  key: value
--- # second document
apiVersion: v1
kind: ConfigMap
metadata:
  name: second
  namespace: default
data:
  key: value
`

    const result = parseKubernetesYaml(yamlContent)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('multiple documents')
    }
  })
})
