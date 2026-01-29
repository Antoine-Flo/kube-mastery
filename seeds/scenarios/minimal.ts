import { scenario } from './types'

export default scenario({
    name: 'minimal',
    description: 'Minimal cluster with nodes and CoreDNS only',
    k8s: {
        add: [
            'node-control-plane',
            'node-worker-1',
            'pod-coredns',
        ]
    }
})
