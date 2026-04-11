import { describe, expect, it } from 'vitest'
import { parseDrillFile } from '../../../../src/content/drills/domain'

describe('parseDrillFile', () => {
  it('returns null for empty input', () => {
    expect(parseDrillFile('')).toBeNull()
  })

  it('returns null when yaml has no title', () => {
    expect(parseDrillFile('tasks:\n  - task: foo\n    command: bar\n    explanation: baz')).toBeNull()
  })

  it('returns null when yaml has no tasks array', () => {
    expect(parseDrillFile('title: "Foo"\nsteps:\n  - command: bar')).toBeNull()
  })

  it('parses a single task correctly', () => {
    const yaml = `
title: "Pod Basics"
description: "Learn pods."
environment: "minimal"
ckaTargetMinutes: 5
tasks:
  - task: "List all nodes"
    command: "kubectl get nodes"
    explanation: "Lists all nodes."
`
    const result = parseDrillFile(yaml)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Pod Basics')
    expect(result!.description).toBe('Learn pods.')
    expect(result!.environment).toBe('minimal')
    expect(result!.ckaTargetMinutes).toBe(5)
    expect(result!.tasks).toHaveLength(1)
    expect(result!.tasks[0]).toEqual({
      task: 'List all nodes',
      command: 'kubectl get nodes',
      explanation: 'Lists all nodes.'
    })
  })

  it('parses multiple tasks in order', () => {
    const yaml = `
title: "Multi"
tasks:
  - task: "First"
    command: "kubectl get nodes"
    explanation: "Lists nodes."
  - task: "Second"
    command: "kubectl get pods"
    explanation: "Lists pods."
`
    const result = parseDrillFile(yaml)
    expect(result!.tasks).toHaveLength(2)
    expect(result!.tasks[0].command).toBe('kubectl get nodes')
    expect(result!.tasks[1].command).toBe('kubectl get pods')
  })

  it('skips task items missing required fields', () => {
    const yaml = `
title: "Partial"
tasks:
  - task: "Only task, no command"
    explanation: "No command field."
  - task: "Valid"
    command: "kubectl get pods"
    explanation: "Lists pods."
`
    const result = parseDrillFile(yaml)
    expect(result!.tasks).toHaveLength(1)
    expect(result!.tasks[0].command).toBe('kubectl get pods')
  })

  it('parses optional tag when valid', () => {
    const yaml = `
title: "Tagged"
tag: storage
tasks:
  - task: "t"
    command: "kubectl get nodes"
    explanation: "e"
`
    const result = parseDrillFile(yaml)
    expect(result!.tag).toBe('storage')
  })

  it('ignores invalid tag values', () => {
    const yaml = `
title: "Bad tag"
tag: not-a-real-tag
tasks:
  - task: "t"
    command: "kubectl get nodes"
    explanation: "e"
`
    const result = parseDrillFile(yaml)
    expect(result!.tag).toBeUndefined()
  })

  it('returns null for invalid yaml', () => {
    expect(parseDrillFile('{ invalid yaml ][')).toBeNull()
  })
})
