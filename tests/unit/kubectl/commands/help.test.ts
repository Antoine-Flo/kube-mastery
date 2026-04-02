import { describe, expect, it } from 'vitest'
import { resolveKubectlHelp } from '../../../../src/core/kubectl/commands/help'

describe('kubectl help resolver', () => {
  it('should return explain help text', () => {
    const output = resolveKubectlHelp('kubectl explain --help')

    expect(output).toBeDefined()
    expect(output).toContain(
      'Describe fields and structure of various resources.'
    )
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
    expect(output).toContain('Modify kubeconfig files using subcommands')
    expect(output).toContain('get-contexts')
  })

  it('should include config command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('config')
  })

  it('should return replace help text', () => {
    const output = resolveKubectlHelp('kubectl replace --help')

    expect(output).toBeDefined()
    expect(output).toContain('Replace a resource by file name or stdin.')
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
    expect(output).toContain('Update existing container image(s) of resources.')
    expect(output).toContain('kubectl set image')
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
    expect(output).toContain('kubectl edit (RESOURCE/NAME | -f FILENAME)')
  })

  it('should include edit command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('edit')
  })

  it('should return patch help text', () => {
    const output = resolveKubectlHelp('kubectl patch --help')

    expect(output).toBeDefined()
    expect(output).toContain(
      'Update fields of a resource using strategic merge patch, a JSON merge patch, or a JSON patch.'
    )
    expect(output).toContain('kubectl patch (-f FILENAME | TYPE NAME)')
  })

  it('should include patch command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('patch')
  })

  it('should return rollout help text', () => {
    const output = resolveKubectlHelp('kubectl rollout --help')

    expect(output).toBeDefined()
    expect(output).toContain('Manage the rollout of one or many resources.')
    expect(output).toContain('kubectl rollout status')
  })

  it('should include rollout command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('rollout')
  })

  it('should return catalog-backed create help text', () => {
    const output = resolveKubectlHelp('kubectl create --help')

    expect(output).toBeDefined()
    expect(output).toContain('Create a resource from a file or from stdin.')
    expect(output).toContain('clusterrole')
    expect(output).toContain('kubectl create -f FILENAME [options]')
  })
})
