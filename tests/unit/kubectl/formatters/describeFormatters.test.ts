import { describe, expect, it } from 'vitest'
import {
  describeConfigMap,
  describePod,
  describeSecret
} from '../../../../src/core/kubectl/formatters/describeFormatters'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../src/core/cluster/ressources/Secret'

describe('describeFormatters', () => {
  describe('describePod', () => {
    it('should format basic pod info', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).toContain('Name:             nginx-pod')
      expect(result).toContain('Namespace:        default')
      expect(result).toContain('Status:')
    })

    it('should format labels', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        labels: { app: 'web', env: 'prod' }
      })

      const result = describePod(pod)

      expect(result).toContain('Labels:')
      expect(result).toContain('app=web')
      expect(result).toContain('env=prod')
    })

    it('should show <none> for empty labels', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).toContain('Labels:           <none>')
    })

    it('should format annotations', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        annotations: { description: 'test' }
      })

      const result = describePod(pod)

      expect(result).toContain('Annotations:')
      expect(result).toContain('description=test')
    })

    it('should format container section', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [
          {
            name: 'nginx',
            image: 'nginx:1.21',
            ports: [{ containerPort: 80 }]
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Containers:')
      expect(result).toContain('nginx:')
      expect(result).toContain('Image:      nginx:1.21')
      expect(result).toContain('80/TCP')
    })

    it('should format container with command and args', () => {
      const pod = createPod({
        name: 'busybox-pod',
        namespace: 'default',
        containers: [
          {
            name: 'busybox',
            image: 'busybox:latest',
            command: ['sh', '-c'],
            args: ['echo hello']
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Command:')
      expect(result).toContain('sh')
      expect(result).toContain('Args:')
      expect(result).toContain('echo hello')
    })

    it('should format init containers section', () => {
      const pod = createPod({
        name: 'init-pod',
        namespace: 'default',
        initContainers: [
          {
            name: 'init-setup',
            image: 'busybox:latest',
            command: ['touch', '/ready']
          }
        ],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).toContain('Init Containers:')
      expect(result).toContain('init-setup:')
      expect(result).toContain('Containers:')
      expect(result).toContain('main:')
    })

    it('should format resource requests and limits', () => {
      const pod = createPod({
        name: 'resource-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            resources: {
              requests: { cpu: '100m', memory: '128Mi' },
              limits: { cpu: '500m', memory: '512Mi' }
            }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Requests:')
      expect(result).toContain('cpu: 100m')
      expect(result).toContain('memory: 128Mi')
      expect(result).toContain('Limits:')
      expect(result).toContain('cpu: 500m')
      expect(result).toContain('memory: 512Mi')
    })

    it('should format liveness probe', () => {
      const pod = createPod({
        name: 'probe-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            livenessProbe: {
              type: 'httpGet',
              path: '/health',
              port: 8080,
              initialDelaySeconds: 10,
              periodSeconds: 5
            }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Liveness:')
      expect(result).toContain('http-get /health on port 8080')
      expect(result).toContain('delay=10s')
      expect(result).toContain('period=5s')
    })

    it('should format readiness probe', () => {
      const pod = createPod({
        name: 'probe-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            readinessProbe: {
              type: 'tcpSocket',
              port: 3306
            }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Readiness:')
      expect(result).toContain('tcp-socket :3306')
    })

    it('should format exec probe', () => {
      const pod = createPod({
        name: 'probe-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            startupProbe: {
              type: 'exec',
              command: ['cat', '/tmp/ready']
            }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Startup:')
      expect(result).toContain('exec [cat /tmp/ready]')
    })

    it('should format environment variables with direct values', () => {
      const pod = createPod({
        name: 'env-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            env: [
              {
                name: 'MY_VAR',
                source: { type: 'value', value: 'hello' }
              }
            ]
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Environment:')
      expect(result).toContain('MY_VAR:  hello')
    })

    it('should format env from configMap', () => {
      const pod = createPod({
        name: 'env-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            env: [
              {
                name: 'DB_HOST',
                source: {
                  type: 'configMapKeyRef',
                  name: 'db-config',
                  key: 'host'
                }
              }
            ]
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('DB_HOST:')
      expect(result).toContain("config map 'db-config'")
    })

    it('should format env from secret', () => {
      const pod = createPod({
        name: 'env-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            env: [
              {
                name: 'DB_PASSWORD',
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

      const result = describePod(pod)

      expect(result).toContain('DB_PASSWORD:')
      expect(result).toContain("secret 'db-secret'")
    })

    it('should format volume mounts', () => {
      const pod = createPod({
        name: 'vol-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            volumeMounts: [
              {
                name: 'data-vol',
                mountPath: '/data',
                readOnly: true
              }
            ]
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Mounts:')
      expect(result).toContain('data-vol')
      expect(result).toContain('/data')
      expect(result).toContain('(ro)')
    })

    it('should format volumes section with emptyDir', () => {
      const pod = createPod({
        name: 'vol-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'cache',
            source: { type: 'emptyDir' }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Volumes:')
      expect(result).toContain('cache:')
      expect(result).toContain('EmptyDir')
    })

    it('should format volumes section with configMap', () => {
      const pod = createPod({
        name: 'vol-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'config-vol',
            source: { type: 'configMap', name: 'my-config' }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('ConfigMap')
      expect(result).toContain('my-config')
    })

    it('should format volumes section with secret', () => {
      const pod = createPod({
        name: 'vol-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'secret-vol',
            source: { type: 'secret', secretName: 'my-secret' }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Secret')
      expect(result).toContain('my-secret')
    })

    it('should show <none> for no volumes', () => {
      const pod = createPod({
        name: 'simple-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).toContain('Volumes:  <none>')
    })

    it('should include conditions section', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).toContain('Conditions:')
      expect(result).toContain('Ready')
      expect(result).toContain('True')
    })

    it('should generate consistent IP for same pod name', () => {
      const pod = createPod({
        name: 'test-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })

      const result1 = describePod(pod)
      const result2 = describePod(pod)

      const ipMatch1 = result1.match(/IP:\s+([\d.]+)/)
      const ipMatch2 = result2.match(/IP:\s+([\d.]+)/)

      expect(ipMatch1?.[1]).toBe(ipMatch2?.[1])
      expect(ipMatch1?.[1]).toMatch(/^172\.17\.0\.\d+$/)
    })
  })

  describe('describeConfigMap', () => {
    it('should format basic configmap info', () => {
      const cm = createConfigMap({
        name: 'my-config',
        namespace: 'default',
        data: { key: 'value' }
      })

      const result = describeConfigMap(cm)

      expect(result).toContain('Name:         my-config')
      expect(result).toContain('Namespace:    default')
    })

    it('should format data section', () => {
      const cm = createConfigMap({
        name: 'app-config',
        namespace: 'default',
        data: {
          'database.url': 'localhost:5432',
          'app.name': 'MyApp'
        }
      })

      const result = describeConfigMap(cm)

      expect(result).toContain('Data')
      expect(result).toContain('====')
      expect(result).toContain('database.url:')
      expect(result).toContain('localhost:5432')
      expect(result).toContain('app.name:')
      expect(result).toContain('MyApp')
    })

    it('should show <no data> for empty configmap', () => {
      const cm = createConfigMap({
        name: 'empty-config',
        namespace: 'default',
        data: {}
      })

      const result = describeConfigMap(cm)

      expect(result).toContain('<no data>')
    })

    it('should format binaryData section', () => {
      const cm = createConfigMap({
        name: 'binary-config',
        namespace: 'default',
        data: {},
        binaryData: { 'cert.pem': 'YmluYXJ5ZGF0YQ==' }
      })

      const result = describeConfigMap(cm)

      expect(result).toContain('BinaryData')
      expect(result).toContain('cert.pem:')
      expect(result).toContain('bytes')
    })

    it('should format labels and annotations', () => {
      const cm = createConfigMap({
        name: 'labeled-config',
        namespace: 'default',
        data: {},
        labels: { env: 'prod' },
        annotations: { version: '1.0' }
      })

      const result = describeConfigMap(cm)

      expect(result).toContain('Labels:')
      expect(result).toContain('env=prod')
      expect(result).toContain('Annotations:')
      expect(result).toContain('version=1.0')
    })
  })

  describe('describeSecret', () => {
    it('should format basic secret info', () => {
      const secret = createSecret({
        name: 'my-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: { password: 'c2VjcmV0' }
      })

      const result = describeSecret(secret)

      expect(result).toContain('Name:         my-secret')
      expect(result).toContain('Namespace:    default')
      expect(result).toContain('Type:  Opaque')
    })

    it('should format service-account-token type', () => {
      const secret = createSecret({
        name: 'sa-token',
        namespace: 'default',
        secretType: {
          type: 'kubernetes.io/service-account-token',
          serviceAccountName: 'default'
        },
        data: { token: 'dG9rZW4=' }
      })

      const result = describeSecret(secret)

      expect(result).toContain('Type:  kubernetes.io/service-account-token')
    })

    it('should format dockerconfigjson type', () => {
      const secret = createSecret({
        name: 'docker-secret',
        namespace: 'default',
        secretType: {
          type: 'kubernetes.io/dockerconfigjson',
          dockerConfigJson: '{}'
        },
        data: { '.dockerconfigjson': 'e30=' }
      })

      const result = describeSecret(secret)

      expect(result).toContain('Type:  kubernetes.io/dockerconfigjson')
    })

    it('should show data keys with byte counts (masked)', () => {
      const secret = createSecret({
        name: 'multi-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {
          username: 'YWRtaW4=',
          password: 'c2VjcmV0MTIz'
        }
      })

      const result = describeSecret(secret)

      expect(result).toContain('Data')
      expect(result).toContain('username:')
      expect(result).toContain('bytes')
      expect(result).toContain('password:')
      // Should NOT contain actual secret values
      expect(result).not.toContain('admin')
      expect(result).not.toContain('secret123')
    })

    it('should show <no data> for empty secret', () => {
      const secret = createSecret({
        name: 'empty-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {}
      })

      const result = describeSecret(secret)

      expect(result).toContain('<no data>')
    })

    it('should format labels and annotations', () => {
      const secret = createSecret({
        name: 'labeled-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {},
        labels: { type: 'credentials' },
        annotations: { 'rotation-date': '2024-01-01' }
      })

      const result = describeSecret(secret)

      expect(result).toContain('Labels:')
      expect(result).toContain('type=credentials')
      expect(result).toContain('Annotations:')
      expect(result).toContain('rotation-date=2024-01-01')
    })
  })
})
