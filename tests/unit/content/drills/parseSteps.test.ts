import { describe, expect, it } from 'vitest'
import { parseDrillFile } from '../../../../src/content/drills/domain'

describe('parseDrillFile', () => {
  it('returns null for empty input', () => {
    expect(parseDrillFile('')).toBeNull()
  })

  it('returns null for yaml input (markdown-only format)', () => {
    const yaml = `
title: "Legacy"
tasks:
  - task: "foo"
    command: "kubectl get pods"
    explanation: "legacy"
`
    expect(parseDrillFile(yaml)).toBeNull()
  })

  it('parses markdown drill format with solution and validation sections', () => {
    const markdown = `---
title: "Markdown Drill"
description: "Example"
tag: storage
environment: minimal
ckaTargetMinutes: 4
---

## First task

Optional instruction text.

### Solution

\`\`\`bash
kubectl get pods -n app
\`\`\`

Then inspect the output.

### Validation

\`\`\`yaml
- type: clusterResourceExists
  kind: Pod
  namespace: app
  name: nginx
  onFail: "Pod missing."
\`\`\`
`
    const result = parseDrillFile(markdown)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Markdown Drill')
    expect(result!.tasks).toHaveLength(1)
    expect(result!.tasks[0].task).toBe('First task')
    expect(result!.tasks[0].command).toBe('kubectl get pods -n app')
    expect(result!.tasks[0].instructionMarkdown).toBe('Optional instruction text.')
    expect(result!.tasks[0].solutionMarkdown).toContain('kubectl get pods -n app')
    expect(result!.tasks[0].validation?.assertions).toHaveLength(1)
  })

  it('parses multiple bash fences in markdown solution as command array', () => {
    const markdown = `---
title: "Multi command markdown"
---

## Task

### Solution

\`\`\`bash
kubectl apply -f cm.yaml
\`\`\`

\`\`\`bash
kubectl get cm
\`\`\`
`
    const result = parseDrillFile(markdown)
    expect(result).not.toBeNull()
    expect(result!.tasks[0].command).toEqual([
      'kubectl apply -f cm.yaml',
      'kubectl get cm'
    ])
  })

  it('returns null when markdown has no frontmatter title', () => {
    const markdown = `
## Task

### Solution

\`\`\`bash
kubectl get pods
\`\`\`
`
    expect(parseDrillFile(markdown)).toBeNull()
  })
})
