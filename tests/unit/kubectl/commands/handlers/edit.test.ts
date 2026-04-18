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
        phase: 'Running',
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
    expect(updated.value.status.phase).toBe('Pending')
    expect(
      updated.value.status.containerStatuses?.[0]?.stateDetails?.reason
    ).toBe('ContainerCreating')
    expect(
      messages.some((entry) => entry.includes('pod/edit-demo edited'))
    ).toBe(true)
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

    capturedSave(
      capturedContent.replace('name: edit-demo', 'name: edit-demo-new')
    )
    expect(
      messages.some((entry) =>
        entry.includes('error: pods "edit-demo" is invalid')
      )
    ).toBe(true)
    expect(
      messages.some((entry) =>
        entry.includes('error: Edit cancelled, no valid changes were saved.')
      )
    ).toBe(true)
  })

  it('should reopen editor with immutable error details for pod container name changes', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        containers: [{ name: 'edit-demo', image: 'nginx:1.25' }]
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

    const parsed = parseCommand('kubectl edit pod edit-demo')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: () => {}
    })
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    const editedManifest = capturedContent.replace(
      'spec:\n  containers:\n  - name: edit-demo',
      'spec:\n  containers:\n  - name: edit-demoo'
    )
    capturedSave(editedManifest)
    expect(capturedContent).toContain('# pods "edit-demo" was not valid:')
    expect(capturedContent).toContain(
      'spec.containers[*].name: field is immutable'
    )
  })

  it('should return kubectl-like pod spec forbidden message for unsupported spec edits', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        containers: [{ name: 'edit-demo', image: 'nginx:1.25' }]
      })
    )

    let capturedContent = ''
    let capturedSave: ((newContent: string) => void) | undefined
    const messages: string[] = []
    const editorModal: EditorModal = {
      open: (_filename, content, onSave) => {
        capturedContent = content
        capturedSave = onSave
      }
    }

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

    const editedManifest = capturedContent.replace(
      'spec:\n',
      'spec:\n  dnsPolicy: Toto\n'
    )
    capturedSave(editedManifest)
    expect(
      messages.some((entry) =>
        entry.includes('error: pods "edit-demo" is invalid')
      )
    ).toBe(true)
    expect(capturedContent).toContain('# pods "edit-demo" was not valid:')
    expect(capturedContent).toContain(
      'pod updates may not change fields other than'
    )
    expect(capturedContent).toContain('# @@ -')
  })

  it('should print cancel message when edit is cancelled after invalid retries', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        containers: [{ name: 'edit-demo', image: 'nginx:1.25' }]
      })
    )

    let capturedContent = ''
    let capturedSave: ((newContent: string) => void) | undefined
    let capturedCancel: (() => void) | undefined
    const editorModal: EditorModal = {
      open: (_filename, content, onSave, onCancel) => {
        capturedContent = content
        capturedSave = onSave
        capturedCancel = onCancel
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

    const editedManifest = capturedContent.replace(
      'spec:\n',
      'spec:\n  nodeName: worker-2\n'
    )
    capturedSave(editedManifest)
    expect(capturedCancel).toBeDefined()
    capturedCancel?.()

    expect(
      messages.some((entry) =>
        entry.includes('error: Edit cancelled, no valid changes were saved.')
      )
    ).toBe(true)
  })

  it('should allow pod activeDeadlineSeconds update', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        containers: [{ name: 'edit-demo', image: 'nginx:1.25' }]
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

    const editedManifest = capturedContent.replace(
      'spec:\n',
      'spec:\n  activeDeadlineSeconds: 30\n'
    )
    capturedSave(editedManifest)
    expect(
      messages.some((entry) => entry.includes('pod/edit-demo edited'))
    ).toBe(true)
  })

  it('should reject pod tolerations modifications that are not additions', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-demo',
        namespace: 'default',
        tolerations: [{ key: 'team', operator: 'Equal', value: 'a' }],
        containers: [{ name: 'edit-demo', image: 'nginx:1.25' }]
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

    const parsed = parseCommand('kubectl edit pod edit-demo')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: () => {}
    })
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    const editedManifest = capturedContent.replace('value: a', 'value: b')
    capturedSave(editedManifest)
    expect(capturedContent).toContain('# pods "edit-demo" was not valid:')
    expect(capturedContent).toContain(
      'pod updates may not change fields other than'
    )
  })

  it('should reopen editor for invalid yaml payloads', () => {
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

    const parsed = parseCommand('kubectl edit pod edit-demo')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: () => {}
    })
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    capturedSave('kind: Pod\nmetadata:\n  name: [')
    expect(capturedContent).toContain('# pods "edit-demo" was not valid:')
    expect(capturedContent).toContain('error: YAML parse error')
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

  it('should reopen editor with immutable workload selector details', () => {
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

    const parsed = parseCommand('kubectl edit deployment web')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    handleEdit(apiServer, parsed.value, {
      editorModal,
      onAsyncOutput: () => {}
    })
    expect(capturedSave).toBeDefined()
    if (capturedSave == null) {
      return
    }

    capturedSave(capturedContent.replace('app: web', 'app: changed'))
    expect(capturedContent).toContain('# deployments.apps "web" was not valid:')
    expect(capturedContent).toContain('spec.selector: field is immutable')
  })

  it('should not mutate resource on edit --dry-run=client', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'edit-dry-run',
        namespace: 'default',
        containers: [{ name: 'web', image: 'nginx:1.25' }]
      })
    )
    let capturedContent = ''
    let capturedSave: ((newContent: string) => void) | undefined
    const messages: string[] = []
    const parsed = parseCommand('kubectl edit pod edit-dry-run --dry-run=client')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleEdit(apiServer, parsed.value, {
      editorModal: {
        open: (_filename, content, onSave) => {
          capturedContent = content
          capturedSave = onSave
        }
      },
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

    const unchangedPod = apiServer.findResource('Pod', 'edit-dry-run', 'default')
    expect(unchangedPod.ok).toBe(true)
    if (!unchangedPod.ok) {
      return
    }
    expect(unchangedPod.value.spec.containers[0].image).toBe('nginx:1.25')
    expect(
      messages.some((entry) => entry.includes('pod/edit-dry-run edited (dry run)'))
    ).toBe(true)
  })
})
