import { command } from '../../builder'
import type { KubectlCommandSpec } from '../../model'
import { DESCRIBE_CONFIG } from '../../../describe/registry'
import { createLeafCommand } from './shared'

/**
 * Declarative command specs mirror upstream kubectl flag sets semantically (not Cobra).
 * Reference when aligning output or validation:
 * - get: refs/k8s/kubectl/pkg/cmd/get/get_flags.go (PrintFlags, AllowedFormats, ToPrinter)
 * - describe: refs/k8s/kubectl/pkg/cmd/describe/describe.go (DescribeFlags, AddFlags)
 */

const DESCRIBE_RESOURCE_ALLOWLIST = Object.keys(DESCRIBE_CONFIG)
const ROLLOUT_RESOURCE_ALLOWLIST = ['deployments', 'daemonsets', 'statefulsets']

/** get subcommand flags: compare with GetFlags / PrintFlags in refs/k8s/kubectl/pkg/cmd/get/get_flags.go */
const getCommand = createLeafCommand({
  path: ['get'],
  use: 'get\n[(-o|--output=)json|yaml|kyaml|name|go-template|go-template-file|template|templatefile|jsonpath|jsonpath-as-json|jsonpath-file|custom-columns|custom-columns-file|wide]\n(TYPE[.VERSION][.GROUP] [NAME | -l label] | TYPE[.VERSION][.GROUP]/NAME ...) [flags] [options]',
  short: 'Display one or many resources',
  handlerId: 'get',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'string', name: 'filename', short: 'f', description: 'File path' },
    {
      kind: 'string',
      name: 'kustomize',
      short: 'k',
      description: 'Process kustomization directory'
    },
    {
      kind: 'bool',
      name: 'recursive',
      short: 'R',
      description: 'Recursive files'
    },
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' },
    {
      kind: 'string',
      name: 'field-selector',
      description: 'Field selector query'
    },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    { kind: 'bool', name: 'no-headers', description: 'Hide headers' },
    { kind: 'bool', name: 'show-labels', description: 'Show labels column' },
    { kind: 'string', name: 'sort-by', description: 'Sort by field' },
    {
      kind: 'string',
      name: 'subresource',
      description: 'Subresource to fetch'
    },
    {
      kind: 'bool',
      name: 'allow-missing-template-keys',
      description: 'Ignore missing template keys',
      defaultValue: 'true'
    },
    { kind: 'string', name: 'chunk-size', description: 'Chunk size for lists' },
    {
      kind: 'bool',
      name: 'watch',
      short: 'w',
      description: 'Watch for changes'
    },
    { kind: 'bool', name: 'watch-only', description: 'Watch events only' },
    {
      kind: 'bool',
      name: 'output-watch-events',
      description: 'Include watch event wrappers'
    },
    {
      kind: 'bool',
      name: 'ignore-not-found',
      description: 'Ignore not found errors'
    },
    { kind: 'string', name: 'raw', description: 'Raw URI to request' }
  ]
})

/** describe subcommand flags: compare with DescribeFlags in refs/k8s/kubectl/pkg/cmd/describe/describe.go */
const describeCommand = createLeafCommand({
  path: ['describe'],
  use: 'describe TYPE NAME',
  short: 'Show details of a specific resource or group of resources',
  handlerId: 'describe',
  completion: {
    resourceTypes: {
      mode: 'allowlist',
      resources: DESCRIBE_RESOURCE_ALLOWLIST
    },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const deleteCommand = createLeafCommand({
  path: ['delete'],
  use: 'delete (-f FILENAME | TYPE [NAME])',
  short: 'Delete resources by file names, stdin, resources and names',
  handlerId: 'delete',
  completion: {
    resourceTypes: { mode: 'all', includePseudoResources: true },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'string', name: 'filename', short: 'f', description: 'File path' },
    {
      kind: 'string',
      name: 'grace-period',
      description: 'Period of time in seconds'
    },
    { kind: 'bool', name: 'force', description: 'Immediate delete' },
    {
      kind: 'bool',
      name: 'wait',
      description: 'Wait for resources to terminate'
    },
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const applyCommand = createLeafCommand({
  path: ['apply'],
  use: 'apply (-f FILENAME)',
  short: 'Apply a configuration to a resource by file name or stdin',
  handlerId: 'apply',
  flags: [
    { kind: 'string', name: 'filename', short: 'f', description: 'File path' }
  ]
})

const createDeploymentCommand = createLeafCommand({
  path: ['create', 'deployment'],
  use: 'create deployment NAME --image=image [--replicas=COUNT] [--port=PORT]',
  short: 'Create a deployment with the specified name',
  handlerId: 'create',
  flags: [
    { kind: 'stringArray', name: 'image', description: 'Image name' },
    { kind: 'string', name: 'replicas', description: 'Replica count' },
    { kind: 'string', name: 'port', description: 'Port number' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createIngressCommand = createLeafCommand({
  path: ['create', 'ingress'],
  use: 'create ingress NAME --rule=host/path=service:port [--class=ingressClassName]',
  short: 'Create an ingress from imperative flags',
  handlerId: 'create',
  flags: [
    {
      kind: 'stringArray',
      name: 'rule',
      description: 'Host/path backend rule'
    },
    { kind: 'string', name: 'class', description: 'Ingress class name' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createNamespaceCommand = createLeafCommand({
  path: ['create', 'namespace'],
  aliases: ['ns'],
  use: 'create namespace NAME [--dry-run=none|server|client] [-o output]',
  short: 'Create a namespace',
  handlerId: 'create',
  flags: [
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createClusterroleCommand = createLeafCommand({
  path: ['create', 'clusterrole'],
  use: 'create clusterrole NAME [--verb=verbs] [--resource=resources] [--dry-run=none|server|client] [-o output]',
  short: 'Create a ClusterRole',
  handlerId: 'create',
  flags: [
    {
      kind: 'stringArray',
      name: 'verb',
      description: 'Verbs allowed on the resources'
    },
    {
      kind: 'stringArray',
      name: 'resource',
      description: 'Resources this rule applies to'
    },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createServiceClusterIpCommand = createLeafCommand({
  path: ['create', 'service', 'clusterip'],
  use: 'create service clusterip NAME --tcp=port:targetPort [--dry-run=none|server|client] [-o output]',
  short: 'Create a ClusterIP service',
  handlerId: 'create',
  flags: [
    { kind: 'string', name: 'tcp', description: 'Port mapping list' },
    { kind: 'string', name: 'node-port', description: 'NodePort value' },
    { kind: 'string', name: 'external-name', description: 'External DNS name' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createServiceNodePortCommand = createLeafCommand({
  path: ['create', 'service', 'nodeport'],
  use: 'create service nodeport NAME --tcp=port:targetPort [--node-port=port] [--dry-run=none|server|client] [-o output]',
  short: 'Create a NodePort service',
  handlerId: 'create',
  flags: [
    { kind: 'string', name: 'tcp', description: 'Port mapping list' },
    { kind: 'string', name: 'node-port', description: 'NodePort value' },
    { kind: 'string', name: 'external-name', description: 'External DNS name' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createServiceLoadBalancerCommand = createLeafCommand({
  path: ['create', 'service', 'loadbalancer'],
  use: 'create service loadbalancer NAME --tcp=port:targetPort [--dry-run=none|server|client] [-o output]',
  short: 'Create a LoadBalancer service',
  handlerId: 'create',
  flags: [
    { kind: 'string', name: 'tcp', description: 'Port mapping list' },
    { kind: 'string', name: 'node-port', description: 'NodePort value' },
    { kind: 'string', name: 'external-name', description: 'External DNS name' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createServiceExternalNameCommand = createLeafCommand({
  path: ['create', 'service', 'externalname'],
  use: 'create service externalname NAME --external-name=dns.name [--dry-run=none|server|client] [-o output]',
  short: 'Create an ExternalName service',
  handlerId: 'create',
  flags: [
    { kind: 'string', name: 'tcp', description: 'Port mapping list' },
    { kind: 'string', name: 'node-port', description: 'NodePort value' },
    { kind: 'string', name: 'external-name', description: 'External DNS name' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createServiceCommand = command({
  path: ['create', 'service'],
  use: 'create service <clusterip|nodeport|loadbalancer|externalname> NAME [flags]',
  description: {
    short: 'Create a service using an imperative subcommand'
  }
})
  .addCommand(
    createServiceClusterIpCommand,
    createServiceNodePortCommand,
    createServiceLoadBalancerCommand,
    createServiceExternalNameCommand
  )
  .build()

const createConfigMapCommand = createLeafCommand({
  path: ['create', 'configmap'],
  aliases: ['cm'],
  use: 'create configmap NAME --from-literal=key=value [--dry-run=none|server|client] [-o output]',
  short: 'Create a configmap from literal values',
  handlerId: 'create',
  flags: [
    {
      kind: 'stringArray',
      name: 'from-literal',
      description: 'Literal key=value entries'
    },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createSecretGenericCommand = createLeafCommand({
  path: ['create', 'secret', 'generic'],
  use: 'create secret generic NAME [--from-literal=key=value] [--from-file=[key=]path] [--from-env-file=path]',
  short: 'Create an opaque secret',
  handlerId: 'create',
  flags: [
    {
      kind: 'stringArray',
      name: 'from-literal',
      description: 'Literal key=value entries'
    },
    {
      kind: 'stringArray',
      name: 'from-file',
      description: 'File source entries'
    },
    {
      kind: 'stringArray',
      name: 'from-env-file',
      description: 'Env file entries'
    },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createSecretTlsCommand = createLeafCommand({
  path: ['create', 'secret', 'tls'],
  use: 'create secret tls NAME --cert=path --key=path [--dry-run=none|server|client] [-o output]',
  short: 'Create a TLS secret',
  handlerId: 'create',
  flags: [
    { kind: 'string', name: 'cert', description: 'Certificate path' },
    { kind: 'string', name: 'key', description: 'Private key path' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createSecretDockerRegistryCommand = createLeafCommand({
  path: ['create', 'secret', 'docker-registry'],
  use: 'create secret docker-registry NAME --docker-server=server --docker-username=user --docker-password=pass [--docker-email=email]',
  short: 'Create a docker-registry secret',
  handlerId: 'create',
  flags: [
    {
      kind: 'string',
      name: 'docker-server',
      description: 'Docker server'
    },
    {
      kind: 'string',
      name: 'docker-username',
      description: 'Docker username'
    },
    {
      kind: 'string',
      name: 'docker-password',
      description: 'Docker password'
    },
    { kind: 'string', name: 'docker-email', description: 'Docker email' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    }
  ]
})

const createSecretCommand = command({
  path: ['create', 'secret'],
  use: 'create secret <generic|tls|docker-registry> NAME [flags]',
  description: {
    short: 'Create a secret using an imperative subcommand'
  }
})
  .addCommand(
    createSecretGenericCommand,
    createSecretTlsCommand,
    createSecretDockerRegistryCommand
  )
  .build()

const createCommand = command({
  path: ['create'],
  use: 'create -f FILENAME | create deployment NAME --image=image',
  description: {
    short: 'Create a resource from a file or from stdin'
  }
})
  .handler('create')
  .flags.string('filename', 'File path', { short: 'f' })
  .flags.stringArray('image', 'Image name')
  .flags.string('replicas', 'Replica count')
  .flags.string('port', 'Port number')
  .flags.string('class', 'Ingress class name')
  .flags.stringArray('rule', 'Host/path backend rule')
  .flags.string('tcp', 'Port mapping list')
  .flags.string('node-port', 'NodePort value')
  .flags.string('external-name', 'External DNS name')
  .flags.stringArray('from-literal', 'Literal key=value entries')
  .flags.stringArray('from-file', 'File source entries')
  .flags.stringArray('from-env-file', 'Env file entries')
  .flags.string('cert', 'Certificate path')
  .flags.string('key', 'Private key path')
  .flags.string('docker-server', 'Docker server')
  .flags.string('docker-username', 'Docker username')
  .flags.string('docker-password', 'Docker password')
  .flags.string('docker-email', 'Docker email')
  .flags.string('output', 'Output format', { short: 'o' })
  .flags.enum('dry-run', 'Must be none, server or client', [
    'none',
    'server',
    'client'
  ])
  .addCommand(
    createDeploymentCommand,
    createIngressCommand,
    createNamespaceCommand,
    createClusterroleCommand,
    createServiceCommand,
    createConfigMapCommand,
    createSecretCommand
  )
  .build()

const logsCommand = createLeafCommand({
  path: ['logs'],
  use: 'logs POD [-c CONTAINER]',
  short: 'Print the logs for a container in a pod',
  handlerId: 'logs',
  completion: {
    resourceTypes: { mode: 'none' },
    resourceNames: { mode: 'pods' }
  },
  flags: [
    {
      kind: 'string',
      name: 'container',
      short: 'c',
      description: 'Container name'
    },
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' },
    { kind: 'string', name: 'tail', description: 'Lines to show' },
    { kind: 'string', name: 'since', description: 'Relative duration' },
    { kind: 'bool', name: 'follow', short: 'f', description: 'Stream logs' },
    { kind: 'bool', name: 'previous', short: 'p', description: 'Previous logs' }
  ]
})

const execCommand = createLeafCommand({
  path: ['exec'],
  use: 'exec POD -- COMMAND [args...]',
  short: 'Execute a command in a container',
  handlerId: 'exec',
  completion: {
    resourceTypes: { mode: 'none' },
    resourceNames: { mode: 'pods' }
  },
  flags: [
    {
      kind: 'string',
      name: 'container',
      short: 'c',
      description: 'Container name'
    },
    {
      kind: 'bool',
      name: 'stdin',
      short: 'i',
      description: 'Pass stdin to container'
    },
    { kind: 'bool', name: 'tty', short: 't', description: 'Stdin is a TTY' }
  ]
})

const labelCommand = createLeafCommand({
  path: ['label'],
  use: 'label TYPE NAME KEY=VALUE [--overwrite]',
  short: 'Update the labels on a resource',
  handlerId: 'label',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'bool', name: 'overwrite', description: 'Overwrite existing value' }
  ]
})

const annotateCommand = createLeafCommand({
  path: ['annotate'],
  use: 'annotate TYPE NAME KEY=VALUE [--overwrite]',
  short: 'Update the annotations on a resource',
  handlerId: 'annotate',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'bool', name: 'overwrite', description: 'Overwrite existing value' }
  ]
})

const versionCommand = createLeafCommand({
  path: ['version'],
  use: 'version',
  short: 'Print the client and server version information',
  handlerId: 'version',
  flags: [
    { kind: 'bool', name: 'client', description: 'Client version only' },
    { kind: 'string', name: 'output', short: 'o', description: 'Output format' }
  ]
})

const clusterInfoDumpCommand = createLeafCommand({
  path: ['cluster-info', 'dump'],
  use: 'cluster-info dump [flags]',
  short: 'Dump relevant information for debugging and diagnosis',
  handlerId: 'cluster-info',
  flags: [
    {
      kind: 'string',
      name: 'output-directory',
      description: 'Write output to a directory'
    },
    { kind: 'string', name: 'namespaces', description: 'Namespace list' },
    { kind: 'bool', name: 'all-namespaces', description: 'Dump all namespaces' }
  ]
})

const clusterInfoCommand = command({
  path: ['cluster-info'],
  use: 'cluster-info',
  description: {
    short: 'Display cluster information'
  }
})
  .handler('cluster-info')
  .addCommand(clusterInfoDumpCommand)
  .build()

const apiVersionsCommand = createLeafCommand({
  path: ['api-versions'],
  use: 'api-versions',
  short: 'Print the supported API versions on the server',
  handlerId: 'api-versions'
})

const apiResourcesCommand = createLeafCommand({
  path: ['api-resources'],
  use: 'api-resources',
  short: 'Print the supported API resources on the server',
  handlerId: 'api-resources'
})

const optionsCommand = createLeafCommand({
  path: ['options'],
  use: 'options',
  short: 'List global command-line options',
  handlerId: 'options'
})

const diffCommand = createLeafCommand({
  path: ['diff'],
  use: 'diff -f FILENAME',
  short:
    'Diff configurations specified by file name between the current online configuration, and the configuration as it would be if applied',
  handlerId: 'diff',
  flags: [
    { kind: 'string', name: 'filename', short: 'f', description: 'File path' }
  ]
})

const replaceCommand = createLeafCommand({
  path: ['replace'],
  use: 'replace -f FILENAME',
  short: 'Replace a resource from a file or from stdin',
  handlerId: 'replace',
  flags: [
    { kind: 'string', name: 'filename', short: 'f', description: 'File path' },
    { kind: 'bool', name: 'force', description: 'Force replacement' }
  ]
})

const explainCommand = createLeafCommand({
  path: ['explain'],
  use: 'explain TYPE[.FIELD]',
  short: 'Get documentation for a resource',
  handlerId: 'explain',
  flags: [
    {
      kind: 'bool',
      name: 'recursive',
      short: 'R',
      description: 'Show all fields'
    },
    { kind: 'string', name: 'api-version', description: 'Version to use' }
  ]
})

const editCommand = createLeafCommand({
  path: ['edit'],
  use: 'edit TYPE NAME',
  short: 'Edit a resource from the default editor',
  handlerId: 'edit',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  }
})

const patchCommand = createLeafCommand({
  path: ['patch'],
  use: 'patch (TYPE NAME | TYPE/NAME) --type=merge -p PATCH',
  short: 'Update fields of a resource',
  handlerId: 'patch',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    {
      kind: 'enum',
      name: 'type',
      description: 'Patch type',
      enumValues: ['merge']
    },
    { kind: 'string', name: 'patch', short: 'p', description: 'Patch payload' }
  ]
})

const scaleCommand = createLeafCommand({
  path: ['scale'],
  use: 'scale (TYPE NAME | TYPE/NAME) --replicas=COUNT',
  short:
    'Set a new size for a deployment, replica set, or replication controller',
  handlerId: 'scale',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [{ kind: 'string', name: 'replicas', description: 'Replica count' }]
})

const exposeCommand = createLeafCommand({
  path: ['expose'],
  use: 'expose TYPE NAME --port=PORT',
  short: 'Expose a resource as a new Kubernetes service',
  handlerId: 'expose',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'string', name: 'port', description: 'Service port' },
    { kind: 'string', name: 'target-port', description: 'Target port' },
    { kind: 'string', name: 'type', description: 'Service type' },
    { kind: 'string', name: 'name', description: 'Service name override' },
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const waitCommand = createLeafCommand({
  path: ['wait'],
  use: 'wait --for=condition=Ready TYPE/NAME --timeout=60s',
  short: 'Wait for a specific condition on one or many resources',
  handlerId: 'wait',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'string', name: 'for', description: 'Condition expression' },
    { kind: 'string', name: 'timeout', description: 'Duration' }
  ]
})

const runCommand = createLeafCommand({
  path: ['run'],
  use: 'run NAME --image=image',
  short: 'Run a particular image on the cluster',
  handlerId: 'run',
  flags: [
    { kind: 'string', name: 'image', description: 'Container image' },
    { kind: 'bool', name: 'command', description: 'Use command mode' },
    { kind: 'stringArray', name: 'env', description: 'Environment variables' },
    { kind: 'string', name: 'labels', description: 'Labels' },
    {
      kind: 'string',
      name: 'output',
      short: 'o',
      description: 'Output format'
    },
    {
      kind: 'enum',
      name: 'dry-run',
      description: 'Must be none, server or client',
      enumValues: ['none', 'server', 'client']
    },
    { kind: 'string', name: 'restart', description: 'Restart policy' },
    { kind: 'bool', name: 'stdin', short: 'i', description: 'Stdin' },
    { kind: 'bool', name: 'tty', short: 't', description: 'TTY' },
    { kind: 'bool', name: 'rm', description: 'Remove pod on exit' },
    { kind: 'string', name: 'port', description: 'Port' }
  ]
})

const setImageCommand = createLeafCommand({
  path: ['set', 'image'],
  use: 'set image TYPE/NAME CONTAINER=IMAGE [CONTAINER=IMAGE...]',
  short: 'Update the image of a pod template or pod',
  handlerId: 'set',
  completion: {
    resourceTypes: { mode: 'all' },
    resourceNames: { mode: 'fromResourceType' }
  }
})

const setCommand = command({
  path: ['set'],
  use: 'set',
  description: {
    short: 'Set specific features on objects'
  }
})
  .addCommand(setImageCommand)
  .build()

const rolloutStatusCommand = createLeafCommand({
  path: ['rollout', 'status'],
  use: 'rollout status (TYPE NAME | TYPE/NAME)',
  short: 'Show the status of the rollout',
  handlerId: 'rollout',
  completion: {
    resourceTypes: {
      mode: 'allowlist',
      resources: ROLLOUT_RESOURCE_ALLOWLIST
    },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'string', name: 'timeout', description: 'Duration' },
    { kind: 'string', name: 'watch', description: 'true or false' }
  ]
})

const rolloutHistoryCommand = createLeafCommand({
  path: ['rollout', 'history'],
  use: 'rollout history (TYPE NAME | TYPE/NAME)',
  short: 'View rollout history',
  handlerId: 'rollout',
  completion: {
    resourceTypes: {
      mode: 'allowlist',
      resources: ROLLOUT_RESOURCE_ALLOWLIST
    },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [{ kind: 'string', name: 'revision', description: 'Revision id' }]
})

const rolloutRestartCommand = createLeafCommand({
  path: ['rollout', 'restart'],
  use: 'rollout restart (TYPE NAME | TYPE/NAME)',
  short: 'Restart a resource',
  handlerId: 'rollout',
  completion: {
    resourceTypes: {
      mode: 'allowlist',
      resources: ROLLOUT_RESOURCE_ALLOWLIST
    },
    resourceNames: { mode: 'fromResourceType' }
  }
})

const rolloutUndoCommand = createLeafCommand({
  path: ['rollout', 'undo'],
  use: 'rollout undo (TYPE NAME | TYPE/NAME)',
  short: 'Roll back to a previous revision',
  handlerId: 'rollout',
  completion: {
    resourceTypes: {
      mode: 'allowlist',
      resources: ROLLOUT_RESOURCE_ALLOWLIST
    },
    resourceNames: { mode: 'fromResourceType' }
  },
  flags: [
    { kind: 'string', name: 'revision', description: 'Revision id' },
    { kind: 'string', name: 'to-revision', description: 'Revision id' }
  ]
})

const rolloutCommand = command({
  path: ['rollout'],
  use: 'rollout',
  description: {
    short: 'Manage the rollout of a resource'
  }
})
  .addCommand(
    rolloutStatusCommand,
    rolloutHistoryCommand,
    rolloutRestartCommand,
    rolloutUndoCommand
  )
  .build()

const topPodsCommand = createLeafCommand({
  path: ['top', 'pods'],
  use: 'top pods [NAME]',
  short: 'Display resource (CPU/memory) usage of pods',
  handlerId: 'top-pods',
  completion: {
    resourceTypes: { mode: 'none' },
    resourceNames: { mode: 'pods' }
  },
  flags: [
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const topPodCommand = createLeafCommand({
  path: ['top', 'pod'],
  use: 'top pod [NAME]',
  short: 'Display resource (CPU/memory) usage of pods',
  handlerId: 'top-pods',
  completion: {
    resourceTypes: { mode: 'none' },
    resourceNames: { mode: 'pods' }
  },
  flags: [
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const topNodesCommand = createLeafCommand({
  path: ['top', 'nodes'],
  use: 'top nodes [NAME]',
  short: 'Display resource (CPU/memory) usage of nodes',
  handlerId: 'top-nodes',
  completion: {
    resourceTypes: { mode: 'none' },
    resourceNames: { mode: 'nodes' }
  },
  flags: [
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const topNodeCommand = createLeafCommand({
  path: ['top', 'node'],
  use: 'top node [NAME]',
  short: 'Display resource (CPU/memory) usage of nodes',
  handlerId: 'top-nodes',
  completion: {
    resourceTypes: { mode: 'none' },
    resourceNames: { mode: 'nodes' }
  },
  flags: [
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const topCommand = command({
  path: ['top'],
  use: 'top',
  description: {
    short: 'Display resource (CPU/memory) usage'
  }
})
  .addCommand(topPodsCommand, topPodCommand, topNodesCommand, topNodeCommand)
  .build()

const configGetContextsCommand = createLeafCommand({
  path: ['config', 'get-contexts'],
  use: 'config get-contexts',
  short: 'Display one or many contexts from the kubeconfig file',
  handlerId: 'config-get-contexts'
})

const configCurrentContextCommand = createLeafCommand({
  path: ['config', 'current-context'],
  use: 'config current-context',
  short: 'Display the current-context',
  handlerId: 'config-current-context'
})

const configViewCommand = createLeafCommand({
  path: ['config', 'view'],
  use: 'config view',
  short: 'Display merged kubeconfig settings',
  handlerId: 'config-view',
  flags: [
    { kind: 'bool', name: 'minify', description: 'Minify output' },
    { kind: 'string', name: 'output', short: 'o', description: 'Output format' }
  ]
})

const configSetContextCommand = createLeafCommand({
  path: ['config', 'set-context'],
  use: 'config set-context --current --namespace=NAME',
  short: 'Set a context entry in kubeconfig',
  handlerId: 'config-set-context',
  flags: [
    { kind: 'bool', name: 'current', description: 'Use current context' },
    { kind: 'string', name: 'namespace', description: 'Namespace name' }
  ]
})

const configCommand = command({
  path: ['config'],
  use: 'config',
  description: {
    short: 'Modify kubeconfig files'
  }
})
  .addCommand(
    configGetContextsCommand,
    configCurrentContextCommand,
    configViewCommand,
    configSetContextCommand
  )
  .build()

export const KUBECTL_COMMAND_SPECS: readonly KubectlCommandSpec[] = [
  getCommand,
  describeCommand,
  deleteCommand,
  applyCommand,
  createCommand,
  logsCommand,
  execCommand,
  labelCommand,
  annotateCommand,
  versionCommand,
  clusterInfoCommand,
  apiVersionsCommand,
  apiResourcesCommand,
  optionsCommand,
  diffCommand,
  replaceCommand,
  explainCommand,
  editCommand,
  patchCommand,
  scaleCommand,
  exposeCommand,
  waitCommand,
  runCommand,
  setCommand,
  rolloutCommand,
  topCommand,
  configCommand
]
