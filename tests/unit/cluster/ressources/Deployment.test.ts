// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Tests for Deployment factory, parser, and helper functions

import { describe, expect, it } from 'vitest'
import {
  createDeployment,
  generateReplicaSetName,
  generateTemplateHash,
  getDeploymentDesiredReplicas,
  getDeploymentReadyDisplay,
  isDeploymentAvailable,
  parseDeploymentManifest
} from '../../../../src/core/cluster/ressources/Deployment'

describe('createDeployment', () => {
  it('should create Deployment with required fields', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      replicas: 3,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })

    expect(deployment.apiVersion).toBe('apps/v1')
    expect(deployment.kind).toBe('Deployment')
    expect(deployment.metadata.name).toBe('nginx-deployment')
    expect(deployment.metadata.namespace).toBe('default')
    expect(deployment.spec.replicas).toBe(3)
    expect(deployment.spec.selector.matchLabels).toEqual({ app: 'nginx' })
  })

  it('should default replicas to 1 if not specified', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })

    expect(deployment.spec.replicas).toBe(1)
  })

  it('should initialize status with zeros', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      replicas: 3,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })

    expect(deployment.status.replicas).toBe(0)
    expect(deployment.status.readyReplicas).toBe(0)
    expect(deployment.status.availableReplicas).toBe(0)
    expect(deployment.status.updatedReplicas).toBe(0)
  })

  it('should include strategy if provided', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      },
      strategy: {
        type: 'RollingUpdate',
        rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
      }
    })

    expect(deployment.spec.strategy).toBeDefined()
    expect(deployment.spec.strategy!.type).toBe('RollingUpdate')
    expect(deployment.spec.strategy!.rollingUpdate!.maxSurge).toBe(1)
  })

  it('should include labels and annotations if provided', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      },
      labels: { app: 'nginx', version: 'v1' },
      annotations: { description: 'Test deployment' }
    })

    expect(deployment.metadata.labels).toEqual({ app: 'nginx', version: 'v1' })
    expect(deployment.metadata.annotations).toEqual({
      description: 'Test deployment'
    })
  })
})

describe('parseDeploymentManifest', () => {
  it('should parse valid minimal Deployment manifest', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'nginx-deployment',
        namespace: 'default'
      },
      spec: {
        replicas: 2,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:latest' }]
          }
        }
      }
    }

    const result = parseDeploymentManifest(manifest)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.metadata.name).toBe('nginx-deployment')
      expect(result.value.spec.replicas).toBe(2)
    }
  })

  it('should parse Deployment with strategy', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'nginx-deployment' },
      spec: {
        replicas: 3,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxSurge: '25%', maxUnavailable: '25%' }
        }
      }
    }

    const result = parseDeploymentManifest(manifest)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spec.strategy!.type).toBe('RollingUpdate')
      expect(result.value.spec.strategy!.rollingUpdate!.maxSurge).toBe('25%')
    }
  })

  it('should reject manifest with invalid apiVersion', () => {
    const manifest = {
      apiVersion: 'v1', // Invalid for Deployment
      kind: 'Deployment',
      metadata: { name: 'test' },
      spec: {
        selector: { matchLabels: { app: 'test' } },
        template: {
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
        }
      }
    }

    const result = parseDeploymentManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('should reject manifest without containers', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'test' },
      spec: {
        selector: { matchLabels: { app: 'test' } },
        template: {
          spec: { containers: [] }
        }
      }
    }

    const result = parseDeploymentManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('should reject manifest with invalid replicas type', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'test' },
      spec: {
        replicas: 'invalid',
        selector: { matchLabels: { app: 'test' } },
        template: {
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
        }
      }
    }

    const result = parseDeploymentManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('should default namespace to "default"', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'nginx-deployment' },
      spec: {
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
        }
      }
    }

    const result = parseDeploymentManifest(manifest)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.metadata.namespace).toBe('default')
    }
  })
})

describe('getDeploymentDesiredReplicas', () => {
  it('should return spec.replicas', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      replicas: 5,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      }
    })

    expect(getDeploymentDesiredReplicas(deployment)).toBe(5)
  })

  it('should return 1 if replicas not set', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      }
    })

    expect(getDeploymentDesiredReplicas(deployment)).toBe(1)
  })
})

describe('getDeploymentReadyDisplay', () => {
  it('should return "ready/desired" format', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      replicas: 3,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      }
    })

    // Initial status has 0 ready
    expect(getDeploymentReadyDisplay(deployment)).toBe('0/3')
  })
})

describe('isDeploymentAvailable', () => {
  it('should return false when no conditions', () => {
    const deployment = createDeployment({
      name: 'nginx-deployment',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      }
    })

    expect(isDeploymentAvailable(deployment)).toBe(false)
  })
})

describe('generateTemplateHash', () => {
  it('should generate consistent hash for same template', () => {
    const template = {
      metadata: { labels: { app: 'nginx' } },
      spec: { containers: [{ name: 'nginx', image: 'nginx:1.21' }] }
    }

    const hash1 = generateTemplateHash(template)
    const hash2 = generateTemplateHash(template)

    expect(hash1).toBe(hash2)
  })

  it('should generate different hash for different images', () => {
    const template1 = {
      spec: { containers: [{ name: 'nginx', image: 'nginx:1.21' }] }
    }
    const template2 = {
      spec: { containers: [{ name: 'nginx', image: 'nginx:1.22' }] }
    }

    const hash1 = generateTemplateHash(template1)
    const hash2 = generateTemplateHash(template2)

    expect(hash1).not.toBe(hash2)
  })

  it('should return 10 character hex string', () => {
    const template = {
      spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
    }

    const hash = generateTemplateHash(template)

    expect(hash).toMatch(/^[0-9a-f]{10}$/)
  })

  it('should generate different hash for different env vars', () => {
    const template1 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            env: [{ name: 'MODE', value: 'prod' }]
          }
        ]
      }
    }
    const template2 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            env: [{ name: 'MODE', value: 'debug' }]
          }
        ]
      }
    }

    const hash1 = generateTemplateHash(template1)
    const hash2 = generateTemplateHash(template2)

    expect(hash1).not.toBe(hash2)
  })

  it('should generate different hash for different resources', () => {
    const template1 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            resources: { limits: { cpu: '200m', memory: '256Mi' } }
          }
        ]
      }
    }
    const template2 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            resources: { limits: { cpu: '500m', memory: '256Mi' } }
          }
        ]
      }
    }

    const hash1 = generateTemplateHash(template1)
    const hash2 = generateTemplateHash(template2)

    expect(hash1).not.toBe(hash2)
  })

  it('should generate different hash for different command and args', () => {
    const template1 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            command: ['sh', '-c'],
            args: ['echo first']
          }
        ]
      }
    }
    const template2 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            command: ['sh', '-c'],
            args: ['echo second']
          }
        ]
      }
    }

    const hash1 = generateTemplateHash(template1)
    const hash2 = generateTemplateHash(template2)

    expect(hash1).not.toBe(hash2)
  })

  it('should generate different hash for different volumes', () => {
    const template1 = {
      spec: {
        volumes: [{ name: 'config', configMap: { name: 'cm-a' } }],
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      }
    }
    const template2 = {
      spec: {
        volumes: [{ name: 'config', configMap: { name: 'cm-b' } }],
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      }
    }

    const hash1 = generateTemplateHash(template1)
    const hash2 = generateTemplateHash(template2)

    expect(hash1).not.toBe(hash2)
  })

  it('should generate different hash for different ports', () => {
    const template1 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            ports: [{ containerPort: 80 }]
          }
        ]
      }
    }
    const template2 = {
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            ports: [{ containerPort: 8080 }]
          }
        ]
      }
    }

    const hash1 = generateTemplateHash(template1)
    const hash2 = generateTemplateHash(template2)

    expect(hash1).not.toBe(hash2)
  })

  it('should ignore pod-template-hash label in template metadata', () => {
    const template1 = {
      metadata: {
        labels: {
          app: 'nginx'
        }
      },
      spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
    }
    const template2 = {
      metadata: {
        labels: {
          app: 'nginx',
          'pod-template-hash': '1234567890'
        }
      },
      spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
    }

    const hash1 = generateTemplateHash(template1)
    const hash2 = generateTemplateHash(template2)

    expect(hash1).toBe(hash2)
  })
})

describe('generateReplicaSetName', () => {
  it('should combine deployment name and hash', () => {
    const name = generateReplicaSetName('nginx-deployment', 'abc123def0')

    expect(name).toBe('nginx-deployment-abc123def0')
  })
})
