import { describe, expect, it } from 'vitest'
import { resolveKubectlHelp } from '../../../../src/core/kubectl/commands/help'

describe('kubectl help resolver', () => {
  it('should return explain help text', () => {
    const output = resolveKubectlHelp('kubectl explain --help')

    expect(output).toBeDefined()
    expect(output).toContain('Get documentation for a resource.')
    expect(output).toContain('kubectl explain TYPE')
  })

  it('should include explain command in root help', () => {
    const output = resolveKubectlHelp('kubectl -h')

    expect(output).toBeDefined()
    expect(output).toContain('explain')
  })

  it('should return diff help text', () => {
    const output = resolveKubectlHelp('kubectl diff --help')

    expect(output).toBeDefined()
    expect(output).toContain('Diff configurations specified by file name')
    expect(output).toContain('kubectl diff -f FILENAME')
  })

  it('should include diff command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('diff')
  })

  it('should return config help text', () => {
    const output = resolveKubectlHelp('kubectl config --help')

    expect(output).toBeDefined()
    expect(output).toContain('Modify kubeconfig files.')
    expect(output).toContain('kubectl config get-contexts')
  })

  it('should include config command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('config')
  })

  it('should return replace help text', () => {
    const output = resolveKubectlHelp('kubectl replace --help')

    expect(output).toBeDefined()
    expect(output).toContain('Replace a resource from a file or from stdin.')
    expect(output).toContain('kubectl replace -f FILENAME')
  })

  it('should include replace command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('replace')
  })

  it('should return set image help text', () => {
    const output = resolveKubectlHelp('kubectl set image --help')

    expect(output).toBeDefined()
    expect(output).toContain('Update the image of a pod template or pod.')
    expect(output).toContain(
      'kubectl set image TYPE/NAME CONTAINER=IMAGE [CONTAINER=IMAGE...]'
    )
  })

  it('should include set command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('set')
  })

  it('should return edit help text', () => {
    const output = resolveKubectlHelp('kubectl edit --help')

    expect(output).toBeDefined()
    expect(output).toContain('Edit a resource from the default editor.')
    expect(output).toContain('kubectl edit TYPE NAME')
  })

  it('should include edit command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('edit')
  })

  it('should return patch help text', () => {
    const output = resolveKubectlHelp('kubectl patch --help')

    expect(output).toBeDefined()
    expect(output).toContain('Update fields of a resource.')
    expect(output).toContain(
      'kubectl patch (TYPE NAME | TYPE/NAME) --type=merge -p PATCH'
    )
  })

  it('should include patch command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('patch')
  })
})
