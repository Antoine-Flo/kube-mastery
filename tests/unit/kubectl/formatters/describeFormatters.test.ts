import { describe, expect, it } from 'vitest'
import {
  describeConfigMap,
  describeDeployment,
  describeLease,
  describeNetworkPolicy,
  describeNode,
  describePod,
  describeSecret
} from '../../../../src/core/kubectl/formatters/describeFormatters'
import {
  createDeployment,
  generateTemplateHash,
  type DeploymentCondition
} from '../../../../src/core/cluster/ressources/Deployment'
import { createNode } from '../../../../src/core/cluster/ressources/Node'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { createConfigMap } from '../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../src/core/cluster/ressources/Secret'
import { createLease } from '../../../../src/core/cluster/ressources/Lease'
import { createNetworkPolicy } from '../../../../src/core/cluster/ressources/NetworkPolicy'
import { createClusterStateData } from '../../helpers/utils'

describe('describeFormatters', () => {
  describe('describePod', () => {
    it('should format basic pod info', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).toContain('Name:')
      expect(result).toContain('nginx-pod')
      expect(result).toContain('Namespace:')
      expect(result).toContain('default')
      expect(result).toContain('Status:')
    })

    it('should not show last state for a fresh running pod', () => {
      const pod = createPod({
        name: 'fresh-running-pod',
        namespace: 'default',
        nodeName: 'worker-a',
        phase: 'Running',
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).not.toContain('Last State:')
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

      expect(result).toContain('Labels:')
      expect(result).toContain('<none>')
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
      expect(result).toContain('description: test')
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
      expect(result).toContain('Image:')
      expect(result).toContain('nginx:1.21')
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
      expect(result).toContain('cpu:')
      expect(result).toContain('100m')
      expect(result).toContain('memory:')
      expect(result).toContain('128Mi')
      expect(result).toContain('Limits:')
      expect(result).toContain('cpu:')
      expect(result).toContain('500m')
      expect(result).toContain('memory:')
      expect(result).toContain('512Mi')
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
      expect(result).toContain('http://:8080/health')
      expect(result).toContain('delay=10s')
      expect(result).toContain('timeout=1s')
      expect(result).toContain('period=5s')
      expect(result).toContain('#failure=3')
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

    it('should include controlled by when pod has owner reference', () => {
      const pod = createPod({
        name: 'owned-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'ReplicaSet',
            name: 'owned-rs',
            uid: 'default-owned-rs',
            controller: true
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('Controlled By:  ReplicaSet/owned-rs')
    })

    it('should include toleration seconds for NoExecute tolerations', () => {
      const pod = createPod({
        name: 'tolerated-pod',
        namespace: 'default',
        nodeName: 'worker-a',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })

      const result = describePod(pod)

      expect(result).toContain(
        'node.kubernetes.io/not-ready:NoExecute op=Exists for 300s'
      )
      expect(result).toContain(
        'node.kubernetes.io/unreachable:NoExecute op=Exists for 300s'
      )
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

    it('should format volumes section with hostPath', () => {
      const pod = createPod({
        name: 'hostpath-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'host-vol',
            source: {
              type: 'hostPath',
              path: '/var/lib/kube-data',
              hostPathType: 'DirectoryOrCreate'
            }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('HostPath')
      expect(result).toContain('/var/lib/kube-data')
      expect(result).toContain('DirectoryOrCreate')
    })

    it('should format volumes section with persistentVolumeClaim', () => {
      const pod = createPod({
        name: 'pvc-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'pvc-vol',
            source: {
              type: 'persistentVolumeClaim',
              claimName: 'data-claim',
              readOnly: true
            }
          }
        ]
      })

      const result = describePod(pod)

      expect(result).toContain('PersistentVolumeClaim')
      expect(result).toContain('data-claim')
      expect(result).toContain('ReadOnly:   true')
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

    it('should show detailed state and last state for crashing container', () => {
      const basePod = createPod({
        name: 'crash-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })
      const pod = {
        ...basePod,
        status: {
          ...basePod.status,
          containerStatuses: (basePod.status.containerStatuses ?? []).map(
            (status) => {
              return {
                ...status,
                state: 'Waiting' as const,
                stateDetails: {
                  state: 'Waiting' as const,
                  reason: 'CrashLoopBackOff'
                },
                lastStateDetails: {
                  state: 'Terminated' as const,
                  reason: 'Error',
                  exitCode: 1,
                  startedAt: '2026-03-13T10:00:00.000Z',
                  finishedAt: '2026-03-13T10:00:05.000Z'
                }
              }
            }
          )
        }
      }

      const result = describePod(pod)

      expect(result).toContain('State:          Waiting')
      expect(result).toContain('Reason:       CrashLoopBackOff')
      expect(result).toContain('Last State:          Terminated')
      expect(result).toContain('Reason:       Error')
      expect(result).toContain('Exit Code:    1')
      expect(result).toContain('Finished:')
    })

    it('should render kubelet warning event for CrashLoopBackOff', () => {
      const basePod = createPod({
        name: 'crashloop-pod',
        namespace: 'default',
        nodeName: 'worker-a',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })
      const pod = {
        ...basePod,
        status: {
          ...basePod.status,
          phase: 'Pending' as const,
          containerStatuses: (basePod.status.containerStatuses ?? []).map(
            (status) => {
              return {
                ...status,
                stateDetails: {
                  state: 'Waiting' as const,
                  reason: 'CrashLoopBackOff'
                }
              }
            }
          )
        }
      }

      const result = describePod(pod)

      expect(result).toContain('Events:')
      expect(result).toContain('Warning BackOff')
      expect(result).toContain('Back-off restarting failed container')
    })

    it('shows Last Seen and Count columns for stored pod events', () => {
      const pod = createPod({
        name: 'api-pod',
        namespace: 'default',
        nodeName: 'worker-a',
        containers: [{ name: 'api', image: 'nginx:latest' }],
        phase: 'Running'
      })

      const result = describePod(pod, [
        {
          type: 'Normal',
          reason: 'Scheduled',
          source: 'default-scheduler',
          message: 'Successfully assigned default/api-pod to worker-a',
          timestamp: '2026-03-13T10:00:00.000Z'
        }
      ])

      expect(result).toContain('First Seen')
      expect(result).toContain('Last Seen')
      expect(result).toContain('Count')
      expect(result).toContain('Successfully assigned default/api-pod')
    })

    it('aggregates repeated stored pod events and increments count', () => {
      const pod = createPod({
        name: 'api-pod',
        namespace: 'default',
        nodeName: 'worker-a',
        containers: [{ name: 'api', image: 'nginx:latest' }],
        phase: 'Running'
      })

      const result = describePod(pod, [
        {
          type: 'Warning',
          reason: 'BackOff',
          source: 'kubelet',
          message:
            'Back-off restarting failed container api in pod default/api-pod',
          timestamp: '2026-03-13T10:00:00.000Z'
        },
        {
          type: 'Warning',
          reason: 'BackOff',
          source: 'kubelet',
          message:
            'Back-off restarting failed container api in pod default/api-pod',
          timestamp: '2026-03-13T10:00:10.000Z'
        }
      ])

      expect(result).toContain('Back-off restarting failed container api')
      expect(result).toContain('2')
    })
  })

  describe('describeDeployment', () => {
    it('should format basic deployment metadata', () => {
      const deployment = createDeployment({
        name: 'web-app',
        namespace: 'default',
        selector: { matchLabels: { app: 'web-app' } },
        template: {
          metadata: { labels: { app: 'web-app' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:1.28' }]
          }
        },
        labels: { app: 'web-app' },
        annotations: { owner: 'team-platform' },
        creationTimestamp: '2026-02-20T10:00:00.000Z'
      })

      const result = describeDeployment(deployment)

      expect(result).toContain('Name:             web-app')
      expect(result).toContain('Namespace:        default')
      expect(result).toContain('CreationTimestamp:')
      expect(result).toContain('Labels:           app=web-app')
      expect(result).toContain('Annotations:      owner=team-platform')
      expect(result).toContain('Selector:         app=web-app')
      expect(result).toContain('StrategyType:     RollingUpdate')
      expect(result).toContain('MinReadySeconds:  0')
      expect(result).toContain('Pod Template:')
      expect(result).toContain('Containers:')
      expect(result).toContain('Image:      nginx:1.28')
    })

    it('should format replica counters from deployment status', () => {
      const deployment = {
        ...createDeployment({
          name: 'api-app',
          namespace: 'default',
          replicas: 3,
          selector: { matchLabels: { app: 'api-app' } },
          template: {
            metadata: { labels: { app: 'api-app' } },
            spec: {
              containers: [{ name: 'api', image: 'nginx:latest' }]
            }
          }
        }),
        status: {
          replicas: 3,
          updatedReplicas: 2,
          availableReplicas: 1,
          unavailableReplicas: 2
        }
      }

      const result = describeDeployment(deployment)

      expect(result).toContain(
        'Replicas:         3 desired | 2 updated | 3 total | 1 available | 2 unavailable'
      )
    })

    it('should format rolling update strategy values', () => {
      const deployment = createDeployment({
        name: 'rollout-app',
        namespace: 'default',
        selector: { matchLabels: { app: 'rollout-app' } },
        template: {
          metadata: { labels: { app: 'rollout-app' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:latest' }]
          }
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxUnavailable: 1, maxSurge: '25%' }
        }
      })

      const result = describeDeployment(deployment)

      expect(result).toContain('StrategyType:     RollingUpdate')
      expect(result).toContain(
        'RollingUpdateStrategy: 1 max unavailable, 25% max surge'
      )
    })

    it('should format Recreate strategy without rolling update line', () => {
      const deployment = createDeployment({
        name: 'recreate-app',
        namespace: 'default',
        selector: { matchLabels: { app: 'recreate-app' } },
        template: {
          metadata: { labels: { app: 'recreate-app' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:latest' }]
          }
        },
        strategy: { type: 'Recreate' }
      })

      const result = describeDeployment(deployment)

      expect(result).toContain('StrategyType:     Recreate')
      expect(result).not.toContain('RollingUpdateStrategy:')
    })

    it('should show <none> fallbacks for missing labels and annotations', () => {
      const deployment = createDeployment({
        name: 'no-meta-app',
        namespace: 'default',
        selector: { matchLabels: { app: 'no-meta-app' } },
        template: {
          spec: {
            containers: [{ name: 'web', image: 'nginx:latest' }]
          }
        }
      })

      const result = describeDeployment(deployment)

      expect(result).toContain('Labels:           <none>')
      expect(result).toContain('Annotations:      <none>')
      expect(result).toContain('OldReplicaSets:    <none>')
      expect(result).toContain('NewReplicaSet:     <none>')
      expect(result).toContain('Events:             <none>')
    })

    it('should format new and old replica sets from cluster state', () => {
      const deployment = createDeployment({
        name: 'web-app',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.28' }]
          }
        }
      })
      const templateHash = generateTemplateHash(deployment.spec.template)
      const newReplicaSetName = `web-app-${templateHash.substring(0, 10)}`

      const newReplicaSet = createReplicaSet({
        name: newReplicaSetName,
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web' } },
        template: deployment.spec.template,
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'web-app',
            uid: 'default-web-app',
            controller: true
          }
        ]
      })
      const oldReplicaSet = createReplicaSet({
        name: 'web-app-old123456',
        namespace: 'default',
        replicas: 0,
        selector: { matchLabels: { app: 'web' } },
        template: deployment.spec.template,
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'web-app',
            uid: 'default-web-app',
            controller: true
          }
        ]
      })

      const state = createClusterStateData({
        deployments: [deployment],
        replicaSets: [
          {
            ...newReplicaSet,
            status: {
              ...newReplicaSet.status,
              replicas: 3
            }
          },
          {
            ...oldReplicaSet,
            status: {
              ...oldReplicaSet.status,
              replicas: 0
            }
          }
        ]
      })

      const result = describeDeployment(deployment, state)

      expect(result).toContain(
        'OldReplicaSets:    web-app-old123456 (0/0 replicas created)'
      )
      expect(result).toContain(
        `NewReplicaSet:     ${newReplicaSetName} (3/3 replicas created)`
      )
    })

    it('should render deployment lifecycle events table', () => {
      const deployment = createDeployment({
        name: 'web-app',
        namespace: 'default',
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.28' }]
          }
        }
      })

      const result = describeDeployment(deployment, undefined, [
        {
          type: 'Normal',
          reason: 'ScalingReplicaSet',
          source: 'deployment-controller',
          message: 'Scaled up replica set web-app-5c8584f7ff from 0 to 3',
          timestamp: '2026-03-25T10:00:00.000Z'
        }
      ])

      expect(result).toContain('Events:')
      expect(result).toContain('ScalingReplicaSet')
      expect(result).toContain('deployment-controller')
      expect(result).toContain(
        'Scaled up replica set web-app-5c8584f7ff from 0 to 3'
      )
    })

    it('should format template environment variables and conditions', () => {
      const deploymentConditions: DeploymentCondition[] = [
        {
          type: 'Available',
          status: 'True',
          reason: 'MinimumReplicasAvailable'
        },
        {
          type: 'Progressing',
          status: 'True',
          reason: 'NewReplicaSetAvailable'
        }
      ]

      const deployment = {
        ...createDeployment({
          name: 'env-app',
          namespace: 'default',
          selector: { matchLabels: { app: 'env-app' } },
          template: {
            metadata: { labels: { app: 'env-app' } },
            spec: {
              containers: [
                {
                  name: 'web',
                  image: 'nginx:latest',
                  env: [
                    {
                      name: 'MODE',
                      source: { type: 'value', value: 'prod' }
                    },
                    {
                      name: 'DB_HOST',
                      source: {
                        type: 'configMapKeyRef',
                        name: 'db-config',
                        key: 'host'
                      }
                    },
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
            }
          }
        }),
        status: {
          conditions: deploymentConditions
        }
      }

      const result = describeDeployment(deployment)

      expect(result).toContain('Environment:')
      expect(result).toContain('MODE:  prod')
      expect(result).toContain("config map 'db-config'")
      expect(result).toContain("secret 'db-secret'")
      expect(result).toContain('Conditions:')
      expect(result).toContain('Available')
      expect(result).toContain('Progressing')
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

  describe('describeNode', () => {
    it('should format basic node information', () => {
      const node = createNode({
        name: 'sim-worker',
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://2.2.0',
            kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Debian GNU/Linux 12 (bookworm)'
          },
          conditions: [
            {
              type: 'Ready',
              status: 'True'
            }
          ],
          addresses: [
            { type: 'InternalIP', address: '172.18.0.3' },
            { type: 'Hostname', address: 'sim-worker' }
          ],
          capacity: {
            cpu: '4',
            memory: '8Gi'
          },
          allocatable: {
            cpu: '3900m',
            memory: '7800Mi'
          }
        },
        creationTimestamp: '2024-01-16T18:03:00Z'
      })

      const result = describeNode(node)

      expect(result).toContain('Name:')
      expect(result).toContain('sim-worker')
      expect(result).toContain('Roles:')
      expect(result).toContain('CreationTimestamp:')
      expect(result).toContain('Conditions:')
      expect(result).toContain('Addresses:')
      expect(result).toContain('Capacity:')
      expect(result).toContain('Allocatable:')
      expect(result).toContain('System Info:')
    })

    it('should format taints and unschedulable when present', () => {
      const node = createNode({
        name: 'sim-control-plane',
        labels: {
          'node-role.kubernetes.io/control-plane': ''
        },
        spec: {
          unschedulable: true,
          taints: [
            {
              key: 'node-role.kubernetes.io/control-plane',
              effect: 'NoSchedule'
            }
          ]
        },
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://2.2.0',
            kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Debian GNU/Linux 12 (bookworm)'
          }
        }
      })

      const result = describeNode(node)

      expect(result).toContain('Roles:')
      expect(result).toContain('control-plane')
      expect(result).toContain('Taints:')
      expect(result).toContain('NoSchedule')
      expect(result).toContain('Unschedulable:      true')
    })

    it('should include non-terminated pods and allocated resources sections', () => {
      const node = createNode({
        name: 'sim-worker',
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://2.2.0',
            kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Debian GNU/Linux 12 (bookworm)'
          },
          allocatable: {
            cpu: '4000m',
            memory: '8Gi'
          }
        }
      })
      const pod = createPod({
        name: 'web-pod',
        namespace: 'default',
        nodeName: 'sim-worker',
        containers: [
          {
            name: 'web',
            image: 'nginx:latest',
            resources: {
              requests: {
                cpu: '100m',
                memory: '128Mi'
              },
              limits: {
                cpu: '500m',
                memory: '512Mi'
              }
            }
          }
        ],
        phase: 'Running'
      })
      const state = createClusterStateData({
        pods: [pod]
      })

      const result = describeNode(node, state)

      expect(result).toContain('Non-terminated Pods:')
      expect(result).toContain('web-pod')
      expect(result).toContain('Allocated resources:')
      expect(result).toContain('cpu')
      expect(result).toContain('memory')
    })
  })

  describe('describeLease', () => {
    it('should format basic lease info', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          renewTime: '2024-01-01T00:00:00Z'
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Name:')
      expect(result).toContain('node-lease-1')
      expect(result).toContain('Namespace:')
      expect(result).toContain('kube-node-lease')
      expect(result).toContain('API Version:')
      expect(result).toContain('coordination.k8s.io/v1')
      expect(result).toContain('Kind:')
      expect(result).toContain('Lease')
    })

    it('should format labels', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        labels: {
          'kubernetes.io/node-name': 'node-1'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Labels:')
      expect(result).toContain('kubernetes.io/node-name=node-1')
    })

    it('should show <none> for empty labels', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Labels:')
      expect(result).toContain('<none>')
    })

    it('should format annotations', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        annotations: {
          'lease.example.com/custom': 'value'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Annotations:')
      expect(result).toContain('lease.example.com/custom=value')
    })

    it('should format creation timestamp', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        creationTimestamp: '2024-01-01T00:00:00Z',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Creation Timestamp:')
      // formatDescribeDate converts to UTC string format like "Mon, 01 Jan 2024 00:00:00 GMT"
      expect(result).toContain('01 Jan 2024')
    })

    it('should format owner references', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        ownerReferences: [
          {
            apiVersion: 'v1',
            kind: 'Node',
            name: 'node-1',
            uid: 'node-uid-123'
          }
        ],
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Owner References:')
      expect(result).toContain('API Version:')
      expect(result).toContain('v1')
      expect(result).toContain('Kind:')
      expect(result).toContain('Node')
      expect(result).toContain('Name:')
      expect(result).toContain('node-1')
      expect(result).toContain('UID:')
      expect(result).toContain('node-uid-123')
    })

    it('should show <none> for empty owner references', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Owner References:')
      expect(result).toContain('<none>')
    })

    it('should format spec fields', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          renewTime: '2024-01-01T00:00:00Z'
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Spec:')
      expect(result).toContain('Holder Identity:')
      expect(result).toContain('node-1')
      expect(result).toContain('Lease Duration Seconds:')
      expect(result).toContain('40')
      expect(result).toContain('Renew Time:')
      expect(result).toContain('2024-01-01T00:00:00Z')
    })

    it('should show <none> for missing holderIdentity', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Holder Identity:')
      expect(result).toContain('<none>')
    })

    it('should format resource version and uid when present', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        resourceVersion: '12345',
        uid: 'lease-uid-123',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Resource Version:')
      expect(result).toContain('12345')
      expect(result).toContain('UID:')
      expect(result).toContain('lease-uid-123')
    })

    it('should always show Events section', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      const result = describeLease(lease)

      expect(result).toContain('Events:')
      expect(result).toContain('<none>')
    })
  })

  describe('describeNetworkPolicy', () => {
    it('should include pod selector and ingress isolation line', () => {
      const policy = createNetworkPolicy({
        name: 'deny-all',
        namespace: 'default',
        creationTimestamp: '2024-01-15T10:00:00.000Z',
        spec: {
          podSelector: { matchLabels: { app: 'backend' } },
          policyTypes: ['Ingress'],
          ingress: []
        }
      })
      const result = describeNetworkPolicy(policy)
      expect(result).toContain('Name:         deny-all')
      expect(result).toContain('Namespace:    default')
      expect(result).toContain('PodSelector:     app=backend')
      expect(result).toContain('Allowing ingress traffic:')
      expect(result).toContain(
        '(Selected pods are isolated for ingress connectivity)'
      )
      expect(result).toContain('Policy Types: Ingress')
      expect(result).not.toContain('Events:')
    })
  })
})
