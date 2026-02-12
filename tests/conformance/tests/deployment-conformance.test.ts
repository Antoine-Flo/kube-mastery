// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that Deployment resources conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createDeployment } from '../../../src/core/cluster/ressources/Deployment'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator } from '../openapi/validator'

describe('Deployment OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    // Load OpenAPI spec for apps/v1
    const specResult = await loadOpenAPISpec('apis__apps__v1_openapi.json')
    expect(specResult.ok).toBe(true)
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }

    // Create validator
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid deployments', () => {
    it('should validate minimal deployment', () => {
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default',
          creationTimestamp: new Date().toISOString()
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: 'test'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'test'
              }
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        deployment,
        'apps/v1',
        'Deployment'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate deployment with replicas', () => {
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default',
          creationTimestamp: new Date().toISOString()
        },
        spec: {
          replicas: 3,
          selector: {
            matchLabels: {
              app: 'test'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'test'
              }
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        deployment,
        'apps/v1',
        'Deployment'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate deployment with strategy', () => {
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default',
          creationTimestamp: new Date().toISOString()
        },
        spec: {
          replicas: 2,
          strategy: {
            type: 'RollingUpdate',
            rollingUpdate: {
              maxSurge: 1,
              maxUnavailable: 0
            }
          },
          selector: {
            matchLabels: {
              app: 'test'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'test'
              }
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        deployment,
        'apps/v1',
        'Deployment'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate deployment with labels and annotations', () => {
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default',
          creationTimestamp: new Date().toISOString(),
          labels: {
            app: 'test',
            version: '1.0'
          },
          annotations: {
            description: 'Test deployment'
          }
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: 'test'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'test'
              }
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        deployment,
        'apps/v1',
        'Deployment'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate Deployment created by createDeployment factory', () => {
      const deployment = createDeployment({
        name: 'factory-deployment',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:latest' }]
          }
        },
        labels: { app: 'nginx' }
      })

      const result = validator.validateResource(
        deployment,
        'apps/v1',
        'Deployment'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate Deployment with RollingUpdate strategy from factory', () => {
      const deployment = createDeployment({
        name: 'rolling-deployment',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:latest' }]
          }
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
        }
      })

      const result = validator.validateResource(
        deployment,
        'apps/v1',
        'Deployment'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid deployments', () => {
    it('should reject deployment without spec.selector', () => {
      const invalidDeployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default'
        },
        spec: {
          replicas: 1,
          template: {
            metadata: {
              labels: {
                app: 'test'
              }
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidDeployment,
        'apps/v1',
        'Deployment'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject deployment without spec.template', () => {
      const invalidDeployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default'
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: 'test'
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidDeployment,
        'apps/v1',
        'Deployment'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
      }
    })

    it('should reject deployment with invalid replicas type', () => {
      const invalidDeployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default'
        },
        spec: {
          replicas: 'invalid', // Invalid: should be number
          selector: {
            matchLabels: {
              app: 'test'
            }
          },
          template: {
            metadata: {
              labels: {
                app: 'test'
              }
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidDeployment,
        'apps/v1',
        'Deployment'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject deployment with invalid selector type', () => {
      const invalidDeployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default'
        },
        spec: {
          replicas: 1,
          selector: 'invalid', // Invalid: should be object with matchLabels
          template: {
            metadata: {
              labels: {
                app: 'test'
              }
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest'
                }
              ]
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidDeployment,
        'apps/v1',
        'Deployment'
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
