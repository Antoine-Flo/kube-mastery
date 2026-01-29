import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'deployment-simple',
    description: 'Simple deployment without service',
    extends: minimal,
    k8s: {
        add: [
            'deployment-nginx',
        ]
    }
})
