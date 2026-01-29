import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'multi-node',
    description: 'Cluster with multiple nodes (control-plane + worker)',
    extends: minimal,
    k8s: {
        add: [
            'node-worker-1',
            'pod-web',
            'pod-redis',
            'pod-postgres',
        ]
    }
})
