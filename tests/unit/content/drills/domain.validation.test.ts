import { describe, expect, it } from 'vitest'
import { parseDrillFile } from '../../../../src/content/drills/domain'

describe('parseDrillFile validation schema', () => {
  it('parses assertion-based validation', () => {
    const rawMarkdown = `---
title: "Validation"
---

## check

### Solution

\`\`\`bash
kubectl get pods
\`\`\`

### Validation

\`\`\`yaml
- type: "clusterFieldEquals"
  kind: "Pod"
  namespace: "app"
  name: "web"
  path: "{.metadata.name}"
  value: "web"
  onFail: "missing"
\`\`\`
`
    const parsed = parseDrillFile(rawMarkdown)
    expect(parsed).not.toBeNull()
    expect(parsed?.tasks[0].validation?.assertions).toHaveLength(1)
    expect(parsed?.tasks[0].validation?.assertions[0]).toMatchObject({
      type: 'clusterFieldEquals',
      kind: 'Pod',
      name: 'web'
    })
  })

  it('rejects unknown assertion types', () => {
    const rawMarkdown = `---
title: "Validation"
---

## check

### Solution

\`\`\`bash
kubectl get pods
\`\`\`

### Validation

\`\`\`yaml
- type: "clusterUnknown"
  kind: "Pod"
  name: "web"
  onFail: "missing"
\`\`\`
`
    expect(parseDrillFile(rawMarkdown)).toBeNull()
  })

  it('rejects malformed assertion payload', () => {
    const rawMarkdown = `---
title: "Validation"
---

## check

### Solution

\`\`\`bash
kubectl get pods
\`\`\`

### Validation

\`\`\`yaml
- type: "clusterFieldEquals"
  kind: "Pod"
  namespace: "app"
  path: "{.metadata.name}"
  value: "web"
  onFail: "missing"
\`\`\`
`
    expect(parseDrillFile(rawMarkdown)).toBeNull()
  })

  it('parses every supported assertion type', () => {
    const rawMarkdown = `---
title: "All assertions"
---

## all

### Solution

\`\`\`bash
kubectl get pods
\`\`\`

### Validation

\`\`\`yaml
- type: "clusterResourceExists"
  kind: "Namespace"
  name: "demo"
  onFail: "x"
- type: "clusterFieldEquals"
  kind: "Pod"
  namespace: "app"
  name: "web"
  path: "{.metadata.name}"
  value: "web"
  onFail: "x"
- type: "clusterFieldContains"
  kind: "Deployment"
  namespace: "app"
  name: "api"
  path: "{.spec.template.spec.containers[0].image}"
  value: "nginx"
  onFail: "x"
- type: "clusterFieldNotEmpty"
  kind: "Endpoints"
  namespace: "app"
  name: "web"
  path: "{.subsets[*].addresses[*].ip}"
  onFail: "x"
- type: "clusterFieldsEqual"
  kind: "Deployment"
  namespace: "app"
  name: "web"
  leftPath: "{.status.readyReplicas}"
  rightPath: "{.status.replicas}"
  onFail: "x"
- type: "clusterListFieldContains"
  kind: "Pod"
  namespace: "app"
  path: "{.items[*].metadata.name}"
  value: "web"
  onFail: "x"
- type: "filesystemFileExists"
  path: "/tmp/demo.txt"
  onFail: "x"
- type: "filesystemFileContains"
  path: "/tmp/demo.txt"
  value: "hello"
  onFail: "x"
- type: "filesystemFileNotEmpty"
  path: "/tmp/demo.txt"
  onFail: "x"
\`\`\`
`
    const parsed = parseDrillFile(rawMarkdown)
    expect(parsed).not.toBeNull()
    const assertions = parsed?.tasks[0].validation?.assertions ?? []
    expect(assertions).toHaveLength(9)
    expect(assertions.map((item) => item.type)).toEqual([
      'clusterResourceExists',
      'clusterFieldEquals',
      'clusterFieldContains',
      'clusterFieldNotEmpty',
      'clusterFieldsEqual',
      'clusterListFieldContains',
      'filesystemFileExists',
      'filesystemFileContains',
      'filesystemFileNotEmpty'
    ])
  })
})
