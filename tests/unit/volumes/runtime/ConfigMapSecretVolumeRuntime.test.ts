import { describe, expect, it } from 'vitest'
import type { ConfigMap } from '../../../../src/core/cluster/ressources/ConfigMap'
import type { Secret } from '../../../../src/core/cluster/ressources/Secret'
import { encodeBase64 } from '../../../../src/core/cluster/ressources/Secret'
import type { Volume } from '../../../../src/core/cluster/ressources/Pod'
import {
  createConfigMapProvider,
  createPodVolumeRuntimeManager,
  createSecretProvider
} from '../../../../src/core/volumes/runtime'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'

describe('ConfigMap and Secret volume providers', () => {
  it('should materialize ConfigMap keys into volume files', () => {
    const manager = createPodVolumeRuntimeManager([createConfigMapProvider()])
    const volumes: Volume[] = [
      {
        name: 'nginx-conf',
        source: {
          type: 'configMap',
          name: 'nginx-config'
        }
      }
    ]
    const configMap: ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'nginx-config',
        namespace: 'default',
        creationTimestamp: new Date().toISOString()
      },
      data: {
        'default.conf': 'server { listen 80; }'
      }
    }

    const backings = manager.ensurePodVolumeBackings(
      volumes,
      {},
      {
        namespace: 'default',
        findConfigMap: (name, namespace) => {
          if (name === configMap.metadata.name && namespace === 'default') {
            return configMap
          }
          return undefined
        }
      }
    )
    const backingFileSystem = createFileSystem(
      backings['nginx-conf'],
      undefined,
      {
        mutable: true
      }
    )
    expect(backingFileSystem.readFile('/default.conf').ok).toBe(true)
  })

  it('should decode Secret data into mounted files', () => {
    const manager = createPodVolumeRuntimeManager([createSecretProvider()])
    const volumes: Volume[] = [
      {
        name: 'creds',
        source: {
          type: 'secret',
          secretName: 'app-creds'
        }
      }
    ]
    const secret: Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'app-creds',
        namespace: 'default',
        creationTimestamp: new Date().toISOString()
      },
      type: {
        type: 'Opaque'
      },
      data: {
        username: btoa('admin')
      }
    }

    const backings = manager.ensurePodVolumeBackings(
      volumes,
      {},
      {
        namespace: 'default',
        findSecret: (name, namespace) => {
          if (name === secret.metadata.name && namespace === 'default') {
            return secret
          }
          return undefined
        }
      }
    )
    const backingFileSystem = createFileSystem(backings.creds, undefined, {
      mutable: true
    })
    const readResult = backingFileSystem.readFile('/username')
    expect(readResult.ok).toBe(true)
    if (!readResult.ok) {
      return
    }
    expect(readResult.value).toBe('admin')
  })

  it('should decode UTF-8 Secret data into mounted files', () => {
    const manager = createPodVolumeRuntimeManager([createSecretProvider()])
    const volumes: Volume[] = [
      {
        name: 'creds',
        source: {
          type: 'secret',
          secretName: 'app-creds'
        }
      }
    ]
    const secret: Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'app-creds',
        namespace: 'default',
        creationTimestamp: new Date().toISOString()
      },
      type: {
        type: 'Opaque'
      },
      data: {
        password: encodeBase64('pässwörd')
      }
    }

    const backings = manager.ensurePodVolumeBackings(
      volumes,
      {},
      {
        namespace: 'default',
        findSecret: (name, namespace) => {
          if (name === secret.metadata.name && namespace === 'default') {
            return secret
          }
          return undefined
        }
      }
    )
    const backingFileSystem = createFileSystem(backings.creds, undefined, {
      mutable: true
    })
    const readResult = backingFileSystem.readFile('/password')
    expect(readResult.ok).toBe(true)
    if (!readResult.ok) {
      return
    }
    expect(readResult.value).toBe('pässwörd')
  })
})
