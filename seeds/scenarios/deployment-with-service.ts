import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'deployment-with-service',
    description: 'Deployment with ClusterIP service',
    extends: minimal,
    k8s: {
        add: [
            'deployment-nginx',
            'service-nginx',
        ]
    }
})
