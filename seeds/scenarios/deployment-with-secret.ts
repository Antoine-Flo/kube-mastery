import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'deployment-with-secret',
    description: 'Deployment using secrets',
    extends: minimal,
    k8s: {
        add: [
            'deployment-app',
            'secret-db-credentials',
        ]
    }
})
