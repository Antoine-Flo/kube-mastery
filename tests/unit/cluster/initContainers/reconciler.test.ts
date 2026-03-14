import { describe, expect, it } from 'vitest'
import { reconcileInitContainers } from '../../../../src/core/cluster/initContainers/reconciler'
import {
  createPod,
  type Pod
} from '../../../../src/core/cluster/ressources/Pod'

describe('InitContainer Reconciler', () => {
  describe('pod without init containers', () => {
    it('should start regular containers and set phase to Running', () => {
      const pod = createPod({
        name: 'no-init-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Running')

      const mainStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'main'
      )
      expect(mainStatus?.stateDetails?.state).toBe('Running')
      expect(mainStatus?.ready).toBe(true)
      expect(mainStatus?.started).toBe(true)
      expect(mainStatus?.startedAt).toBeDefined()
    })

    it('should handle pod with empty initContainers array', () => {
      const pod = createPod({
        name: 'empty-init-pod',
        namespace: 'default',
        initContainers: [],
        containers: [{ name: 'app', image: 'redis:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Running')
    })

    it('should start multiple regular containers', () => {
      const pod = createPod({
        name: 'multi-container-pod',
        namespace: 'default',
        containers: [
          { name: 'nginx', image: 'nginx:latest' },
          { name: 'redis', image: 'redis:latest' }
        ]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Running')

      const nginxStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'nginx'
      )
      const redisStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'redis'
      )

      expect(nginxStatus?.stateDetails?.state).toBe('Running')
      expect(nginxStatus?.ready).toBe(true)
      expect(redisStatus?.stateDetails?.state).toBe('Running')
      expect(redisStatus?.ready).toBe(true)
    })
  })

  describe('init container with invalid image', () => {
    it('should fail pod when init container has invalid image', () => {
      const pod = createPod({
        name: 'invalid-image-pod',
        namespace: 'default',
        initContainers: [{ name: 'init', image: 'nonexistent-image:v999' }],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Failed')

      const initStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init'
      )
      expect(initStatus?.stateDetails?.state).toBe('Terminated')
    })

    it('should not start regular containers when init fails', () => {
      const pod = createPod({
        name: 'failed-init-pod',
        namespace: 'default',
        initContainers: [{ name: 'init', image: 'invalid:tag' }],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Failed')

      const mainStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'main'
      )
      // Regular container should not have started
      expect(mainStatus?.stateDetails?.state).not.toBe('Running')
    })
  })

  describe('init container execution failure', () => {
    it('should fail pod when init container command fails', () => {
      const pod = createPod({
        name: 'exec-fail-pod',
        namespace: 'default',
        initContainers: [
          {
            name: 'init',
            image: 'busybox:latest',
            command: ['unsupported-command'],
            args: ['arg1']
          }
        ],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Failed')

      const initStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init'
      )
      expect(initStatus?.stateDetails?.state).toBe('Terminated')
    })
  })

  describe('successful init container execution', () => {
    it('should complete init container and start regular containers', () => {
      const pod = createPod({
        name: 'success-pod',
        namespace: 'default',
        initContainers: [
          {
            name: 'init',
            image: 'busybox:latest',
            command: ['touch'],
            args: ['/ready']
          }
        ],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Running')

      const initStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init'
      )
      expect(initStatus?.stateDetails?.state).toBe('Terminated')

      const mainStatus = result.status.containerStatuses?.find(
        (cs) => cs.name === 'main'
      )
      expect(mainStatus?.stateDetails?.state).toBe('Running')
      expect(mainStatus?.ready).toBe(true)
    })

    it('should update filesystem after init container execution', () => {
      const pod = createPod({
        name: 'fs-update-pod',
        namespace: 'default',
        initContainers: [
          {
            name: 'init',
            image: 'busybox:latest',
            command: ['mkdir'],
            args: ['/data']
          }
        ],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Running')

      // Filesystem should be updated in _simulator.containers
      const initContainerSimulator = result._simulator.containers['init']
      expect(initContainerSimulator?.fileSystem).toBeDefined()
    })

    it('should run init container without command (no-op)', () => {
      const pod = createPod({
        name: 'no-cmd-pod',
        namespace: 'default',
        initContainers: [
          {
            name: 'init',
            image: 'busybox:latest'
            // No command - should be no-op
          }
        ],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Running')
    })
  })

  describe('multiple init containers', () => {
    it('should execute init containers sequentially', () => {
      const pod = createPod({
        name: 'multi-init-pod',
        namespace: 'default',
        initContainers: [
          {
            name: 'init-1',
            image: 'busybox:latest',
            command: ['mkdir'],
            args: ['/app']
          },
          {
            name: 'init-2',
            image: 'busybox:latest',
            command: ['touch'],
            args: ['/ready']
          }
        ],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Running')

      const init1Status = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init-1'
      )
      const init2Status = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init-2'
      )

      expect(init1Status?.stateDetails?.state).toBe('Terminated')
      expect(init2Status?.stateDetails?.state).toBe('Terminated')
    })

    it('should stop on first init container failure', () => {
      const pod = createPod({
        name: 'fail-second-pod',
        namespace: 'default',
        initContainers: [
          {
            name: 'init-1',
            image: 'busybox:latest',
            command: ['touch'],
            args: ['/ready']
          },
          {
            name: 'init-2',
            image: 'invalid-image:latest' // This will fail
          },
          {
            name: 'init-3',
            image: 'busybox:latest',
            command: ['touch'],
            args: ['/done']
          }
        ],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })

      const result = reconcileInitContainers(pod)

      expect(result.status.phase).toBe('Failed')

      const init1Status = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init-1'
      )
      const init2Status = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init-2'
      )
      const init3Status = result.status.containerStatuses?.find(
        (cs) => cs.name === 'init-3'
      )

      // First completed, second failed, third never ran
      expect(init1Status?.stateDetails?.state).toBe('Terminated')
      expect(init2Status?.stateDetails?.state).toBe('Terminated')
      expect(init3Status?.stateDetails?.state).toBe('Waiting') // Never started
    })
  })
})
