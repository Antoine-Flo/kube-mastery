// ═══════════════════════════════════════════════════════════════════════════
// YAML CONVERTERS TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Tests for YAML to TypeScript ADT conversion functions

import { describe, expect, it } from 'vitest'
import {
  convertYamlEnvVar,
  convertYamlProbe,
  convertYamlSecretType,
  convertYamlVolume
} from '../../../../src/core/cluster/ressources/yamlConverters'

describe('yamlConverters', () => {
  describe('convertYamlVolume', () => {
    it('should convert configMap volume', () => {
      const yamlVolume = {
        name: 'nginx-config',
        configMap: { name: 'nginx-config' }
      }

      const result = convertYamlVolume(yamlVolume)

      expect(result).toEqual({
        name: 'nginx-config',
        source: { type: 'configMap', name: 'nginx-config' }
      })
    })

    it('should convert secret volume with secretName', () => {
      const yamlVolume = {
        name: 'db-secret',
        secret: { secretName: 'db-credentials' }
      }

      const result = convertYamlVolume(yamlVolume)

      expect(result).toEqual({
        name: 'db-secret',
        source: { type: 'secret', secretName: 'db-credentials' }
      })
    })

    it('should convert secret volume with name (fallback)', () => {
      const yamlVolume = {
        name: 'db-secret',
        secret: { name: 'db-credentials' }
      }

      const result = convertYamlVolume(yamlVolume)

      expect(result).toEqual({
        name: 'db-secret',
        source: { type: 'secret', secretName: 'db-credentials' }
      })
    })

    it('should convert emptyDir volume', () => {
      const yamlVolume = {
        name: 'data',
        emptyDir: {}
      }

      const result = convertYamlVolume(yamlVolume)

      expect(result).toEqual({
        name: 'data',
        source: { type: 'emptyDir' }
      })
    })

    it('should return null for invalid volume', () => {
      expect(convertYamlVolume(null)).toBeNull()
      expect(convertYamlVolume({})).toBeNull()
      expect(convertYamlVolume({ name: 'test' })).toBeNull()
      expect(convertYamlVolume({ name: 123 })).toBeNull()
    })
  })

  describe('convertYamlEnvVar', () => {
    it('should convert env var with direct value', () => {
      const yamlEnv = {
        name: 'MY_VAR',
        value: 'hello'
      }

      const result = convertYamlEnvVar(yamlEnv)

      expect(result).toEqual({
        name: 'MY_VAR',
        source: { type: 'value', value: 'hello' }
      })
    })

    it('should convert env var with secretKeyRef', () => {
      const yamlEnv = {
        name: 'POSTGRES_USER',
        valueFrom: {
          secretKeyRef: {
            name: 'db-credentials',
            key: 'username'
          }
        }
      }

      const result = convertYamlEnvVar(yamlEnv)

      expect(result).toEqual({
        name: 'POSTGRES_USER',
        source: {
          type: 'secretKeyRef',
          name: 'db-credentials',
          key: 'username'
        }
      })
    })

    it('should convert env var with configMapKeyRef', () => {
      const yamlEnv = {
        name: 'POSTGRES_HOST',
        valueFrom: {
          configMapKeyRef: {
            name: 'app-config',
            key: 'database.host'
          }
        }
      }

      const result = convertYamlEnvVar(yamlEnv)

      expect(result).toEqual({
        name: 'POSTGRES_HOST',
        source: {
          type: 'configMapKeyRef',
          name: 'app-config',
          key: 'database.host'
        }
      })
    })

    it('should return null for invalid env var', () => {
      expect(convertYamlEnvVar(null)).toBeNull()
      expect(convertYamlEnvVar({})).toBeNull()
      expect(convertYamlEnvVar({ name: 'TEST' })).toBeNull()
      expect(convertYamlEnvVar({ name: 123 })).toBeNull()
    })
  })

  describe('convertYamlProbe', () => {
    it('should convert httpGet probe', () => {
      const yamlProbe = {
        httpGet: {
          path: '/',
          port: 80
        },
        initialDelaySeconds: 10,
        periodSeconds: 5
      }

      const result = convertYamlProbe(yamlProbe)

      expect(result).toEqual({
        type: 'httpGet',
        path: '/',
        port: 80,
        initialDelaySeconds: 10,
        periodSeconds: 5
      })
    })

    it('should convert exec probe', () => {
      const yamlProbe = {
        exec: {
          command: ['pg_isready', '-U', 'postgres']
        },
        initialDelaySeconds: 10,
        periodSeconds: 5
      }

      const result = convertYamlProbe(yamlProbe)

      expect(result).toEqual({
        type: 'exec',
        command: ['pg_isready', '-U', 'postgres'],
        initialDelaySeconds: 10,
        periodSeconds: 5
      })
    })

    it('should convert tcpSocket probe', () => {
      const yamlProbe = {
        tcpSocket: {
          port: 5432
        },
        initialDelaySeconds: 30,
        periodSeconds: 10
      }

      const result = convertYamlProbe(yamlProbe)

      expect(result).toEqual({
        type: 'tcpSocket',
        port: 5432,
        initialDelaySeconds: 30,
        periodSeconds: 10
      })
    })

    it('should convert probe without optional fields', () => {
      const yamlProbe = {
        httpGet: {
          path: '/health',
          port: 8080
        }
      }

      const result = convertYamlProbe(yamlProbe)

      expect(result).toEqual({
        type: 'httpGet',
        path: '/health',
        port: 8080
      })
    })

    it('should return null for invalid probe', () => {
      expect(convertYamlProbe(null)).toBeNull()
      expect(convertYamlProbe({})).toBeNull()
      expect(convertYamlProbe({ httpGet: {} })).toBeNull()
      expect(convertYamlProbe({ exec: {} })).toBeNull()
    })
  })

  describe('convertYamlSecretType', () => {
    it('should convert Opaque type', () => {
      const result = convertYamlSecretType('Opaque', 'my-secret', {})

      expect(result).toEqual({ type: 'Opaque' })
    })

    it('should convert undefined type to Opaque', () => {
      const result = convertYamlSecretType(undefined, 'my-secret', {})

      expect(result).toEqual({ type: 'Opaque' })
    })

    it('should convert service-account-token type', () => {
      const result = convertYamlSecretType('kubernetes.io/service-account-token', 'default-token-abc123', {})

      expect(result).toEqual({
        type: 'kubernetes.io/service-account-token',
        serviceAccountName: 'default-token-abc123'
      })
    })

    it('should convert dockerconfigjson type', () => {
      const data = {
        '.dockerconfigjson': 'eyJhdXRocyI6eyJkb2NrZXIuaW8iOnsidXNlcm5hbWUiOiJ1c2VyIiwicGFzc3dvcmQiOiJwYXNzIn19fQ=='
      }

      const result = convertYamlSecretType('kubernetes.io/dockerconfigjson', 'docker-secret', data)

      expect(result).toEqual({
        type: 'kubernetes.io/dockerconfigjson',
        dockerConfigJson: data['.dockerconfigjson']
      })
    })

    it('should default unknown type to Opaque', () => {
      const result = convertYamlSecretType('unknown-type', 'my-secret', {})

      expect(result).toEqual({ type: 'Opaque' })
    })
  })
})
