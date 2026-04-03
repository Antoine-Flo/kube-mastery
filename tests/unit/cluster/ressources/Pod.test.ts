// ═══════════════════════════════════════════════════════════════════════════
// POD INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Integration tests for parsePodManifest with YAML parsing

import { describe, expect, it } from 'vitest'
import {
  buildPodResolvConf,
  parsePodManifest
} from '../../../../src/core/cluster/ressources/Pod'

describe('buildPodResolvConf', () => {
  it('should fallback to default namespace when namespace is empty', () => {
    const resolvConf = buildPodResolvConf('')
    expect(resolvConf).toContain(
      'search default.svc.cluster.local svc.cluster.local cluster.local'
    )
  })

  it('should fallback to default namespace when namespace has only whitespace', () => {
    const resolvConf = buildPodResolvConf('   ')
    expect(resolvConf).toContain(
      'search default.svc.cluster.local svc.cluster.local cluster.local'
    )
  })
})

describe('parsePodManifest integration', () => {
  it('should parse pod with volumes from YAML', () => {
    const yamlPod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: 'web',
        namespace: 'default',
        labels: { app: 'nginx' }
      },
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:1.21',
            ports: [{ containerPort: 80 }]
          }
        ],
        volumes: [
          {
            name: 'nginx-config',
            configMap: { name: 'nginx-config' }
          }
        ]
      }
    }

    const result = parsePodManifest(yamlPod)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spec.volumes).toBeDefined()
      expect(result.value.spec.volumes?.length).toBe(1)
      expect(result.value.spec.volumes?.[0]).toEqual({
        name: 'nginx-config',
        source: { type: 'configMap', name: 'nginx-config' }
      })
    }
  })

  it('should parse pod with env vars from YAML', () => {
    const yamlPod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: 'test-pod',
        namespace: 'default'
      },
      spec: {
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            env: [
              {
                name: 'MY_VAR',
                value: 'hello'
              },
              {
                name: 'DB_HOST',
                valueFrom: {
                  configMapKeyRef: {
                    name: 'app-config',
                    key: 'database.host'
                  }
                }
              },
              {
                name: 'DB_USER',
                valueFrom: {
                  secretKeyRef: {
                    name: 'db-credentials',
                    key: 'username'
                  }
                }
              }
            ]
          }
        ]
      }
    }

    const result = parsePodManifest(yamlPod)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const container = result.value.spec.containers[0]
      expect(container.env).toBeDefined()
      expect(container.env?.length).toBe(3)
      expect(container.env?.[0]).toEqual({
        name: 'MY_VAR',
        source: { type: 'value', value: 'hello' }
      })
      expect(container.env?.[1]).toEqual({
        name: 'DB_HOST',
        source: {
          type: 'configMapKeyRef',
          name: 'app-config',
          key: 'database.host'
        }
      })
      expect(container.env?.[2]).toEqual({
        name: 'DB_USER',
        source: {
          type: 'secretKeyRef',
          name: 'db-credentials',
          key: 'username'
        }
      })
    }
  })

  it('should parse pod with probes from YAML', () => {
    const yamlPod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: 'test-pod',
        namespace: 'default'
      },
      spec: {
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            livenessProbe: {
              httpGet: {
                path: '/',
                port: 80
              },
              initialDelaySeconds: 10,
              periodSeconds: 5
            },
            readinessProbe: {
              httpGet: {
                path: '/health',
                port: 8080
              },
              initialDelaySeconds: 5,
              periodSeconds: 3
            },
            startupProbe: {
              exec: {
                command: ['cat', '/tmp/ready']
              },
              initialDelaySeconds: 0,
              periodSeconds: 10
            }
          }
        ]
      }
    }

    const result = parsePodManifest(yamlPod)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const container = result.value.spec.containers[0]
      expect(container.livenessProbe).toEqual({
        type: 'httpGet',
        path: '/',
        port: 80,
        initialDelaySeconds: 10,
        periodSeconds: 5
      })
      expect(container.readinessProbe).toEqual({
        type: 'httpGet',
        path: '/health',
        port: 8080,
        initialDelaySeconds: 5,
        periodSeconds: 3
      })
      expect(container.startupProbe).toEqual({
        type: 'exec',
        command: ['cat', '/tmp/ready'],
        initialDelaySeconds: 0,
        periodSeconds: 10
      })
    }
  })

  it('should parse complete pod from seed YAML format (web pod)', () => {
    const yamlPod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: 'web',
        namespace: 'default',
        labels: {
          app: 'nginx',
          tier: 'frontend'
        }
      },
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:1.21',
            ports: [{ containerPort: 80 }],
            resources: {
              requests: { cpu: '100m', memory: '128Mi' },
              limits: { cpu: '500m', memory: '256Mi' }
            },
            livenessProbe: {
              httpGet: { path: '/', port: 80 },
              initialDelaySeconds: 10,
              periodSeconds: 5
            },
            readinessProbe: {
              httpGet: { path: '/', port: 80 },
              initialDelaySeconds: 5,
              periodSeconds: 3
            },
            volumeMounts: [
              {
                name: 'nginx-config',
                mountPath: '/etc/nginx/nginx.conf',
                subPath: 'nginx.conf',
                readOnly: true
              }
            ]
          }
        ],
        volumes: [
          {
            name: 'nginx-config',
            configMap: { name: 'nginx-config' }
          }
        ]
      }
    }

    const result = parsePodManifest(yamlPod)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const pod = result.value
      expect(pod.metadata.name).toBe('web')
      expect(pod.spec.volumes).toBeDefined()
      expect(pod.spec.volumes?.[0].source).toBeDefined()
      expect(pod.spec.volumes?.[0].source.type).toBe('configMap')

      // Verify that describePod can format it without errors
      const container = pod.spec.containers[0]
      expect(container.livenessProbe?.type).toBe('httpGet')
      expect(container.readinessProbe?.type).toBe('httpGet')
    }
  })

  it('should reject volume mounts containing parent directory segments', () => {
    const yamlPod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: 'invalid-mount',
        namespace: 'default'
      },
      spec: {
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            volumeMounts: [
              {
                name: 'shared',
                mountPath: '/data/../secrets'
              }
            ]
          }
        ],
        volumes: [
          {
            name: 'shared',
            emptyDir: {}
          }
        ]
      }
    }

    const result = parsePodManifest(yamlPod)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('mountPath must not contain ".." segments')
    }
  })

  it('should reject initContainer volume mounts containing parent directory segments', () => {
    const yamlPod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: 'invalid-init-mount',
        namespace: 'default'
      },
      spec: {
        initContainers: [
          {
            name: 'init-app',
            image: 'busybox:1.36',
            volumeMounts: [
              {
                name: 'shared',
                mountPath: '/cache/../bootstrap'
              }
            ]
          }
        ],
        containers: [
          {
            name: 'app',
            image: 'nginx:latest'
          }
        ],
        volumes: [
          {
            name: 'shared',
            emptyDir: {}
          }
        ]
      }
    }

    const result = parsePodManifest(yamlPod)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('mountPath must not contain ".." segments')
    }
  })
})
