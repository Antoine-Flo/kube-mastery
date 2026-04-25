import { describe, expect, it } from 'vitest'
import { splitYamlDocuments } from '../../../../src/core/cluster/seeds/yamlDocuments'

describe('splitYamlDocuments', () => {
  it('should split documents with bare separator', () => {
    const yamlContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: first
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: second
`

    const documents = splitYamlDocuments(yamlContent)

    expect(documents).toHaveLength(2)
  })

  it('should split documents with separator comments', () => {
    const yamlContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: first
--- # second document
apiVersion: v1
kind: ConfigMap
metadata:
  name: second
`

    const documents = splitYamlDocuments(yamlContent)

    expect(documents).toHaveLength(2)
  })

  it('should split documents with separator tags', () => {
    const yamlContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: first
--- !tagged
apiVersion: v1
kind: ConfigMap
metadata:
  name: second
`

    const documents = splitYamlDocuments(yamlContent)

    expect(documents).toHaveLength(2)
  })
})
