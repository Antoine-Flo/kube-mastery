import type { PodPhase } from '../../cluster/ressources/Pod'

// ═══════════════════════════════════════════════════════════════════════════
// CONTAINER IMAGE REGISTRY SEED DATA
// ═══════════════════════════════════════════════════════════════════════════
// Defines available container images with tags, ports, and behavior.
// Used for image validation and pull simulation in the virtual cluster.

export type LogProfile =
  | 'control-plane-scheduler'
  | 'control-plane-apiserver'
  | 'control-plane-controller'
  | 'nginx'
  | 'redis'
  | 'mysql'
  | 'postgres'
  | 'generic'

export interface ImageManifest {
  name: string
  registry: string
  tags: string[]
  description: string
  defaultPorts: number[]
  logProfile?: LogProfile
  startupLogs?: string[]
  behavior: {
    startupTime: number
    defaultStatus: PodPhase
    runtimeValidation?: {
      rejectNonFlagArgsWithoutCommand?: boolean
    }
  }
}

export const SEED_IMAGES: ImageManifest[] = [
  {
    name: 'pause',
    registry: 'k8s.gcr.io',
    tags: ['3.9'],
    description: 'Kubernetes pod infrastructure container',
    defaultPorts: [],
    behavior: {
      startupTime: 100,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'etcd',
    registry: 'registry.k8s.io',
    tags: ['3.5.21-0'],
    description: 'Kubernetes etcd control plane component',
    defaultPorts: [2379, 2381],
    logProfile: 'generic',
    behavior: {
      startupTime: 1500,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'kube-apiserver',
    registry: 'registry.k8s.io',
    tags: ['v1.35.0'],
    description: 'Kubernetes API server control plane component',
    defaultPorts: [6443],
    logProfile: 'control-plane-apiserver',
    behavior: {
      startupTime: 1500,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'kube-controller-manager',
    registry: 'registry.k8s.io',
    tags: ['v1.35.0'],
    description: 'Kubernetes controller manager control plane component',
    defaultPorts: [10257],
    logProfile: 'control-plane-controller',
    behavior: {
      startupTime: 1500,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'kube-scheduler',
    registry: 'registry.k8s.io',
    tags: ['v1.35.0'],
    description: 'Kubernetes scheduler control plane component',
    defaultPorts: [10259],
    logProfile: 'control-plane-scheduler',
    behavior: {
      startupTime: 1500,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'coredns/coredns',
    registry: 'registry.k8s.io',
    tags: ['v1.13.1'],
    description: 'Kubernetes CoreDNS cluster DNS server',
    defaultPorts: [53, 9153],
    logProfile: 'generic',
    behavior: {
      startupTime: 1200,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'nginx',
    registry: 'docker.io/library',
    tags: [
      'latest',
      '1.28',
      '1.27',
      '1.26',
      '1.25',
      '1.24',
      '1.23',
      '1.22',
      '1.21'
    ],
    description: 'High-performance HTTP server and reverse proxy',
    defaultPorts: [80, 443],
    logProfile: 'nginx',
    startupLogs: [
      '2026/03/11 12:18:12 [notice] 1#1: start worker process 55',
      '2026/03/11 12:18:12 [notice] 1#1: start worker process 56',
      '2026/03/11 12:18:12 [notice] 1#1: start worker process 57',
      '2026/03/11 12:18:12 [notice] 1#1: start worker process 58',
      '2026/03/11 12:18:12 [notice] 1#1: start worker process 59'
    ],
    behavior: {
      startupTime: 1000,
      defaultStatus: 'Running',
      runtimeValidation: {
        rejectNonFlagArgsWithoutCommand: true
      }
    }
  },
  {
    name: 'redis',
    registry: 'docker.io/library',
    tags: ['latest', '7.0', '6.2'],
    description: 'In-memory data store and cache',
    defaultPorts: [6379],
    logProfile: 'redis',
    startupLogs: [
      '1:C 11 Mar 2026 12:18:16.565 # Warning: no config file specified, using the default config. In order to specify a config file use redis-server /path/to/redis.conf',
      '1:M 11 Mar 2026 12:18:16.565 * monotonic clock: POSIX clock_gettime',
      '1:M 11 Mar 2026 12:18:16.566 * Running mode=standalone, port=6379.',
      '1:M 11 Mar 2026 12:18:16.566 # Server initialized',
      '1:M 11 Mar 2026 12:18:16.566 * Ready to accept connections'
    ],
    behavior: {
      startupTime: 800,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'postgres',
    registry: 'docker.io/library',
    tags: ['latest', '15', '14'],
    description: 'Powerful open-source relational database',
    defaultPorts: [5432],
    logProfile: 'postgres',
    startupLogs: [
      'database system is ready to accept connections',
      'PostgreSQL 13.4 on x86_64-pc-linux-gnu, compiled by gcc',
      'listening on IPv4 address "0.0.0.0", port 5432'
    ],
    behavior: {
      startupTime: 2000,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'mysql',
    registry: 'docker.io/library',
    tags: ['latest', '8.0', '5.7'],
    description: 'Popular open-source relational database',
    defaultPorts: [3306],
    logProfile: 'mysql',
    startupLogs: [
      'mysqld: ready for connections. Version: 8.0.27  port: 3306',
      'InnoDB: Buffer pool(s) load completed',
      'MySQL Community Server - GPL initialized'
    ],
    behavior: {
      startupTime: 2500,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'busybox',
    registry: 'docker.io/library',
    tags: ['latest', '1.36', '1.35'],
    description: 'Minimal image for debugging and testing',
    defaultPorts: [],
    logProfile: 'generic',
    behavior: {
      startupTime: 200,
      defaultStatus: 'Succeeded'
    }
  },
  {
    name: 'curl',
    registry: 'curlimages',
    tags: ['latest', '8.8.0', '8.12.1'],
    description: 'Lightweight curl image used for HTTP checks',
    defaultPorts: [],
    logProfile: 'generic',
    behavior: {
      startupTime: 400,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'broken-app',
    registry: 'myregistry.io',
    tags: ['v1.0', 'latest'],
    description: 'Generic app image used for debugging practice',
    defaultPorts: [8080],
    logProfile: 'generic',
    behavior: {
      startupTime: 500,
      defaultStatus: 'Running'
    }
  },
  {
    name: 'private-image',
    registry: 'private.registry.io',
    tags: ['latest', 'v2.0'],
    description: 'Simulates authentication failure scenario',
    defaultPorts: [9000],
    logProfile: 'generic',
    behavior: {
      startupTime: 0,
      defaultStatus: 'Pending'
    }
  }
]
