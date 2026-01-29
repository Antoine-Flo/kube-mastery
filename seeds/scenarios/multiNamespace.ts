import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'multi-namespace',
    description: 'Resources in multiple namespaces (production and staging)',
    extends: minimal,
    k8s: {
        add: [
            'pod-web-prod',
            'pod-api-prod',
            'pod-web-staging',
            'service-web-prod',
            'service-api-prod',
            'service-web-staging',
        ]
    }
})
