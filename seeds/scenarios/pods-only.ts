import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'pods-only',
    description: 'Simple pods without orchestration',
    extends: minimal,
    k8s: {
        add: [
            'pod-web',
            'pod-redis',
            'pod-postgres',
        ]
    }
})
