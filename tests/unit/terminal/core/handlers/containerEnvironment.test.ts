import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import {
  createSecret,
  encodeBase64
} from '../../../../../src/core/cluster/ressources/Secret'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import {
  buildContainerEnvironmentVariables,
  buildHostEnvironmentVariables
} from '../../../../../src/core/terminal/core/handlers/containerEnvironment'

describe('containerEnvironment', () => {
  it('builds host environment variables', () => {
    const envVars = buildHostEnvironmentVariables()
    expect(envVars).toEqual([
      'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      'HOME=/home/kube',
      'HOSTNAME=host-shell'
    ])
  })

  it('builds container environment variables from all supported sources', () => {
    const pod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [
        {
          name: 'app',
          image: 'nginx',
          env: [
            { name: 'PLAIN', source: { type: 'value', value: 'hello' } },
            {
              name: 'FROM_CM',
              source: {
                type: 'configMapKeyRef',
                name: 'app-config',
                key: 'LOG_LEVEL'
              }
            },
            {
              name: 'FROM_SECRET',
              source: {
                type: 'secretKeyRef',
                name: 'db-secret',
                key: 'password'
              }
            }
          ]
        }
      ]
    })

    const result = buildContainerEnvironmentVariables(pod, 'app')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain(
      'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
    )
    expect(result.value).toContain('HOME=/root')
    expect(result.value).toContain('HOSTNAME=web')
    expect(result.value).toContain('PLAIN=hello')
    expect(result.value).toContain('FROM_CM=<from configMap app-config:LOG_LEVEL>')
    expect(result.value).toContain(
      'FROM_SECRET=<from secret db-secret:password>'
    )
  })

  it('resolves configmap and secret refs when api server is available', () => {
    const apiServer = createApiServerFacade()
    const configMapCreateResult = apiServer.createResource(
      'ConfigMap',
      createConfigMap({
        name: 'app-config',
        namespace: 'default',
        data: {
          LOG_LEVEL: 'debug'
        }
      })
    )
    expect(configMapCreateResult.ok).toBe(true)

    const secretCreateResult = apiServer.createResource(
      'Secret',
      createSecret({
        name: 'db-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {
          password: encodeBase64('super-secret-token')
        }
      })
    )
    expect(secretCreateResult.ok).toBe(true)

    const pod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [
        {
          name: 'app',
          image: 'nginx',
          env: [
            {
              name: 'FROM_CM',
              source: {
                type: 'configMapKeyRef',
                name: 'app-config',
                key: 'LOG_LEVEL'
              }
            },
            {
              name: 'FROM_SECRET',
              source: {
                type: 'secretKeyRef',
                name: 'db-secret',
                key: 'password'
              }
            }
          ]
        }
      ]
    })

    const result = buildContainerEnvironmentVariables(pod, 'app', apiServer)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('FROM_CM=debug')
    expect(result.value).toContain('FROM_SECRET=super-secret-token')
  })

  it('returns explicit error when container is missing', () => {
    const pod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'app', image: 'nginx' }]
    })
    const result = buildContainerEnvironmentVariables(pod, 'missing')
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('container missing not found in pod web')
  })

  it('falls back to unknown for unsupported env source types', () => {
    const pod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [
        {
          name: 'app',
          image: 'nginx',
          env: [
            {
              name: 'BROKEN',
              source: { type: 'value', value: 'ok' }
            }
          ]
        }
      ]
    })

    const mutablePod = {
      ...pod,
      spec: {
        ...pod.spec,
        containers: pod.spec.containers.map((container) => {
          if (container.name !== 'app') {
            return container
          }
          return {
            ...container,
            env: [
              ...(container.env ?? []),
              { name: 'UNKNOWN', source: { type: 'other' } as never }
            ]
          }
        })
      }
    }

    const result = buildContainerEnvironmentVariables(mutablePod, 'app')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('UNKNOWN=unknown')
  })
})
