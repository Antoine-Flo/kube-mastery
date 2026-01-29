import { scenario } from './types'
import minimal from './minimal'
import { EXAMPLE_FILES } from '~/core/filesystem/debianFileSystem'

export default scenario({
    name: 'deployment-with-configmap',
    description: 'Deployment with ConfigMap for configuration',
    extends: minimal,
    k8s: {
        add: [
            'deployment-nginx',
            'configmap-nginx',
            'pod-web',
        ]
    },
    fs: {
        files: EXAMPLE_FILES
    }
})
