import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'pods-errors',
    description: 'Pods in error states for troubleshooting exercises',
    extends: minimal,
    k8s: {
        add: [
            'pod-crashloop',
            'pod-imagepull',
            'pod-pending',
        ]
    }
})
