// ═══════════════════════════════════════════════════════════════════════════
// DAEMONSET CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that DaemonSet resources conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createDaemonSet } from '../../../src/core/cluster/ressources/DaemonSet'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator } from '../openapi/validator'

describe('DaemonSet OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    const specResult = await loadOpenAPISpec('apis__apps__v1_openapi.json')
    expect(specResult.ok).toBe(true)
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid daemonsets', () => {
    it('should validate minimal DaemonSet', () => {
      const daemonSet = {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: 'test-daemonset',
          namespace: 'kube-system',
          creationTimestamp: new Date().toISOString()
        },
        spec: {
          selector: {
            matchLabels: {
              app: 'agent'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'agent'
              }
            },
            spec: {
              containers: [
                {
                  name: 'agent',
                  image: 'busybox:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        daemonSet,
        'apps/v1',
        'DaemonSet'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      if (!result.value.valid) {
        throw new Error(
          `Validation failed with schema errors: ${JSON.stringify(result.value.errors)}`
        )
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate DaemonSet with updateStrategy', () => {
      const daemonSet = {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: 'test-daemonset',
          namespace: 'kube-system',
          creationTimestamp: new Date().toISOString()
        },
        spec: {
          selector: {
            matchLabels: {
              app: 'agent'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'agent'
              }
            },
            spec: {
              containers: [
                {
                  name: 'agent',
                  image: 'busybox:latest'
                }
              ]
            }
          },
          updateStrategy: {
            type: 'RollingUpdate',
            rollingUpdate: {
              maxUnavailable: 1
            }
          }
        }
      }

      const result = validator.validateResource(
        daemonSet,
        'apps/v1',
        'DaemonSet'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      if (!result.value.valid) {
        throw new Error(
          `Validation failed with schema errors: ${JSON.stringify(result.value.errors)}`
        )
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate DaemonSet with labels and annotations', () => {
      const daemonSet = {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: 'test-daemonset',
          namespace: 'kube-system',
          creationTimestamp: new Date().toISOString(),
          labels: {
            app: 'agent',
            tier: 'node'
          },
          annotations: {
            description: 'Node agent daemonset'
          }
        },
        spec: {
          selector: {
            matchLabels: {
              app: 'agent'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'agent'
              }
            },
            spec: {
              containers: [
                {
                  name: 'agent',
                  image: 'busybox:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        daemonSet,
        'apps/v1',
        'DaemonSet'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate DaemonSet created by createDaemonSet factory', () => {
      const daemonSet = createDaemonSet({
        name: 'factory-daemonset',
        namespace: 'kube-system',
        labels: { app: 'agent' },
        selector: { matchLabels: { app: 'agent' } },
        template: {
          metadata: { labels: { app: 'agent' } },
          spec: {
            containers: [{ name: 'agent', image: 'busybox:latest' }]
          }
        }
      })
      const daemonSetForValidation = {
        apiVersion: daemonSet.apiVersion,
        kind: daemonSet.kind,
        metadata: daemonSet.metadata,
        spec: daemonSet.spec
      }
      const result = validator.validateResource(
        daemonSetForValidation,
        'apps/v1',
        'DaemonSet'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      if (!result.value.valid) {
        throw new Error(
          `Validation failed with schema errors: ${JSON.stringify(result.value.errors)}`
        )
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid daemonsets', () => {
    it('should reject DaemonSet without spec.selector', () => {
      const invalidDaemonSet = {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: 'test-daemonset',
          namespace: 'kube-system'
        },
        spec: {
          template: {
            metadata: {
              labels: {
                app: 'agent'
              }
            },
            spec: {
              containers: [
                {
                  name: 'agent',
                  image: 'busybox:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidDaemonSet,
        'apps/v1',
        'DaemonSet'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject DaemonSet without spec.template', () => {
      const invalidDaemonSet = {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: 'test-daemonset',
          namespace: 'kube-system'
        },
        spec: {
          selector: {
            matchLabels: {
              app: 'agent'
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidDaemonSet,
        'apps/v1',
        'DaemonSet'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
      }
    })

    it('should reject DaemonSet with invalid selector type', () => {
      const invalidDaemonSet = {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: 'test-daemonset',
          namespace: 'kube-system'
        },
        spec: {
          selector: 'invalid',
          template: {
            metadata: {
              labels: {
                app: 'agent'
              }
            },
            spec: {
              containers: [
                {
                  name: 'agent',
                  image: 'busybox:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidDaemonSet,
        'apps/v1',
        'DaemonSet'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })
  })
})
