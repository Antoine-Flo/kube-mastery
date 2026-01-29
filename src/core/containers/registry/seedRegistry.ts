import type { PodPhase } from '../../cluster/ressources/Pod'

// ═══════════════════════════════════════════════════════════════════════════
// CONTAINER IMAGE REGISTRY SEED DATA
// ═══════════════════════════════════════════════════════════════════════════
// Defines available container images with tags, ports, and behavior.
// Used for image validation and pull simulation in the virtual cluster.

export interface ImageManifest {
    name: string
    registry: string
    tags: string[]
    description: string
    defaultPorts: number[]
    behavior: {
        startupTime: number
        defaultStatus: PodPhase
    }
}

export const SEED_IMAGES: ImageManifest[] = [
    {
        name: 'nginx',
        registry: 'docker.io/library',
        tags: ['latest', '1.25', '1.21'],
        description: 'High-performance HTTP server and reverse proxy',
        defaultPorts: [80, 443],
        behavior: {
            startupTime: 1000,
            defaultStatus: 'Running',
        },
    },
    {
        name: 'redis',
        registry: 'docker.io/library',
        tags: ['latest', '7.0', '6.2'],
        description: 'In-memory data store and cache',
        defaultPorts: [6379],
        behavior: {
            startupTime: 800,
            defaultStatus: 'Running',
        },
    },
    {
        name: 'postgres',
        registry: 'docker.io/library',
        tags: ['latest', '15', '14'],
        description: 'Powerful open-source relational database',
        defaultPorts: [5432],
        behavior: {
            startupTime: 2000,
            defaultStatus: 'Running',
        },
    },
    {
        name: 'mysql',
        registry: 'docker.io/library',
        tags: ['latest', '8.0', '5.7'],
        description: 'Popular open-source relational database',
        defaultPorts: [3306],
        behavior: {
            startupTime: 2500,
            defaultStatus: 'Running',
        },
    },
    {
        name: 'busybox',
        registry: 'docker.io/library',
        tags: ['latest', '1.36', '1.35'],
        description: 'Minimal image for debugging and testing',
        defaultPorts: [],
        behavior: {
            startupTime: 200,
            defaultStatus: 'Succeeded',
        },
    },
    {
        name: 'broken-app',
        registry: 'myregistry.io',
        tags: ['v1.0', 'latest'],
        description: 'Intentionally broken app for debugging practice',
        defaultPorts: [8080],
        behavior: {
            startupTime: 500,
            defaultStatus: 'Failed',
        },
    },
    {
        name: 'private-image',
        registry: 'private.registry.io',
        tags: ['latest', 'v2.0'],
        description: 'Simulates authentication failure scenario',
        defaultPorts: [9000],
        behavior: {
            startupTime: 0,
            defaultStatus: 'Pending',
        },
    },
]

