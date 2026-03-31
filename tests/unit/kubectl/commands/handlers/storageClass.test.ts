import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createStorageClass } from '../../../../../src/core/cluster/ressources/StorageClass'
import { handleDescribe } from '../../../../../src/core/kubectl/commands/handlers/describe'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl storageclass surface', () => {
  it('renders kubectl get storageclass output', () => {
    const apiServer = createApiServerFacade()
    const storageClass = createStorageClass({
      name: 'standard',
      annotations: {
        'storageclass.kubernetes.io/is-default-class': 'true'
      },
      spec: {
        provisioner: 'sim.kubemastery.io/hostpath',
        reclaimPolicy: 'Delete',
        volumeBindingMode: 'Immediate'
      }
    })
    apiServer.etcd.restore(
      createClusterStateData({
        storageClasses: [storageClass]
      })
    )
    const parsed: ParsedCommand = {
      action: 'get',
      resource: 'storageclasses',
      flags: {}
    }

    const output = handleGet(apiServer, parsed)
    expect(output).toContain('NAME')
    expect(output).toContain('PROVISIONER')
    expect(output).toContain('RECLAIMPOLICY')
    expect(output).toContain('standard')
    expect(output).toContain('sim.kubemastery.io/hostpath')
  })

  it('renders kubectl describe storageclass output', () => {
    const apiServer = createApiServerFacade()
    const storageClass = createStorageClass({
      name: 'standard',
      annotations: {
        'storageclass.kubernetes.io/is-default-class': 'true'
      },
      spec: {
        provisioner: 'sim.kubemastery.io/hostpath',
        reclaimPolicy: 'Delete',
        volumeBindingMode: 'Immediate'
      }
    })
    apiServer.etcd.restore(
      createClusterStateData({
        storageClasses: [storageClass]
      })
    )
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'storageclasses',
      name: 'standard',
      flags: {}
    }

    const output = handleDescribe(apiServer, parsed)
    expect(output.ok).toBe(true)
    if (!output.ok) {
      return
    }
    expect(output.value).toContain('Name:')
    expect(output.value).toContain('standard')
    expect(output.value).toContain('Provisioner:')
    expect(output.value).toContain('sim.kubemastery.io/hostpath')
  })
})
