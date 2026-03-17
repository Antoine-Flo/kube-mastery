import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { handleEdit } from '../../../../../src/core/kubectl/commands/handlers/edit'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'
import type { EditorModal } from '../../../../../src/core/shell/commands'

describe('kubectl edit handler', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  it('should open editor and update resource on save', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        containers: [{ name: 'web', image: 'nginx:1.25' }]
      })
    )

    let capturedContent = ''
    let capturedSave: ((newContent: string) => void) | undefined
    const editorModal: EditorModal = {
      open: (_filename, content, onSave) => {
        capturedContent = content
        capturedSave = onSave
      }
    }
    const messages: string[] = []

    const parsed = parseCommand('kubectl edit pod edit-demo')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: (message) => {
        messages.push(message)
      }
    })
    expect(result.ok).toBe(true)
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    capturedSave(capturedContent.replace('nginx:1.25', 'nginx:1.26'))
    const updated = apiServer.findResource('Pod', 'edit-demo', 'default')
    expect(updated.ok).toBe(true)
    if (!updated.ok) {
      return
    }
    expect(updated.value.spec.containers[0].image).toBe('nginx:1.26')
    expect(messages.some((entry) => entry.includes('pod/edit-demo edited'))).toBe(true)
  })

  it('should reject immutable metadata.name changes', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        containers: [{ name: 'web', image: 'nginx:1.25' }]
      })
    )

    let capturedContent = ''
    let capturedSave: ((newContent: string) => void) | undefined
    const editorModal: EditorModal = {
      open: (_filename, content, onSave) => {
        capturedContent = content
        capturedSave = onSave
      }
    }
    const messages: string[] = []

    const parsed = parseCommand('kubectl edit pod edit-demo')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: (message) => {
        messages.push(message)
      }
    })
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    capturedSave(capturedContent.replace('name: edit-demo', 'name: edit-demo-new'))
    const original = apiServer.findResource('Pod', 'edit-demo', 'default')
    expect(original.ok).toBe(true)
    expect(
      messages.some((entry) => entry.includes('metadata.name: field is immutable'))
    ).toBe(true)
  })

  it('should reject invalid yaml payloads', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        containers: [{ name: 'web', image: 'nginx:1.25' }]
      })
    )

    let capturedSave: ((newContent: string) => void) | undefined
    const editorModal: EditorModal = {
      open: (_filename, _content, onSave) => {
        capturedSave = onSave
      }
    }
    const messages: string[] = []

    const parsed = parseCommand('kubectl edit pod edit-demo')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: (message) => {
        messages.push(message)
      }
    })
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    capturedSave('kind: Pod\nmetadata:\n  name: [')
    expect(messages.some((entry) => entry.includes('YAML parse error'))).toBe(true)
  })

  it('should return not found for missing resource', () => {
    const parsed = parseCommand('kubectl edit pod does-not-exist')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleEdit(apiServer, parsed.value, {
      editorModal: {
        open: () => {}
      }
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('pods "does-not-exist" not found')
    }
  })

  it('should reject immutable workload selector changes', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'web',
        namespace: 'default',
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.25' }]
          }
        }
      })
    )

    let capturedContent = ''
    let capturedSave: ((newContent: string) => void) | undefined
    const editorModal: EditorModal = {
      open: (_filename, content, onSave) => {
        capturedContent = content
        capturedSave = onSave
      }
    }
    const messages: string[] = []

    const parsed = parseCommand('kubectl edit deployment web')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: (message) => {
        messages.push(message)
      }
    })
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    capturedSave(capturedContent.replace('app: web', 'app: changed'))
    expect(messages.some((entry) => entry.includes('spec.selector: field is immutable'))).toBe(
      true
    )
  })
})
