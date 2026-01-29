import { EXAMPLE_FILES } from '~/core/filesystem/debianFileSystem'
import { scenario } from './types'
import minimal from './minimal'

export default scenario({
    name: 'full-stack',
    description: 'Complete application with all resources (deployment, service, configmap, secret)',
    extends: minimal,
    k8s: {
        add: [
            'deployment-app',
            'service-nginx',
            'service-redis',
            'service-postgres',
            'pod-web',
            'pod-redis',
            'pod-postgres',
            'configmap-app',
            'configmap-nginx',
            'secret-db-credentials',
            'secret-api-token',
        ]
    },
    fs: {
        files: EXAMPLE_FILES
    }
})
