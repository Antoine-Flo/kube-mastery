import { command } from '../../builder'
import type { KubectlCommandSpec } from '../../model'
import { createLeafCommand } from './shared'

const getCommand = createLeafCommand({
  path: ['get'],
  use: 'get\n[(-o|--output=)json|yaml|kyaml|name|go-template|go-template-file|template|templatefile|jsonpath|jsonpath-as-json|jsonpath-file|custom-columns|custom-columns-file|wide]\n(TYPE[.VERSION][.GROUP] [NAME | -l label] | TYPE[.VERSION][.GROUP]/NAME ...) [flags] [options]',
  short: 'Display one or many resources',
  handlerId: 'get',
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

const describeCommand = createLeafCommand({
  path: ['describe'],
  use: 'describe TYPE NAME',
  short: 'Show details of a specific resource or group of resources',
  handlerId: 'describe',
  flags: [
    { kind: 'string', name: 'selector', short: 'l', description: 'Selector' }
  ]
})

const deleteCommand = createLeafCommand({
  path: ['delete'],
  use: 'delete (-f FILENAME | TYPE [NAME])',
  short: 'Delete resources by file names, stdin, resources and names',
  handlerId: 'delete',
  flags: [
    { kind: 'string', name: 'filename', short: 'f', description: 'File path' },
    {
      kind: 'string',
      name: 'grace-period',
      description: 'Period of time in seconds'
    },
    { kind: 'bool', name: 'force', description: 'Immediate delete' },
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
  .flags.string('output', 'Output format', { short: 'o' })
  .flags.enum('dry-run', 'Must be none, server or client', [
    'none',
    'server',
    'client'
  ])
  .addCommand(createDeploymentCommand)
  .build()

const logsCommand = createLeafCommand({
  path: ['logs'],
  use: 'logs POD [-c CONTAINER]',
  short: 'Print the logs for a container in a pod',
  handlerId: 'logs',
  flags: [
    {
      kind: 'string',
      name: 'container',
      short: 'c',
      description: 'Container name'
    },
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
  flags: [
    { kind: 'bool', name: 'overwrite', description: 'Overwrite existing value' }
  ]
})

const annotateCommand = createLeafCommand({
  path: ['annotate'],
  use: 'annotate TYPE NAME KEY=VALUE [--overwrite]',
  short: 'Update the annotations on a resource',
  handlerId: 'annotate',
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
  handlerId: 'edit'
})

const patchCommand = createLeafCommand({
  path: ['patch'],
  use: 'patch (TYPE NAME | TYPE/NAME) --type=merge -p PATCH',
  short: 'Update fields of a resource',
  handlerId: 'patch',
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
  flags: [{ kind: 'string', name: 'replicas', description: 'Replica count' }]
})

const exposeCommand = createLeafCommand({
  path: ['expose'],
  use: 'expose TYPE NAME --port=PORT',
  short: 'Expose a resource as a new Kubernetes service',
  handlerId: 'expose',
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
  handlerId: 'set'
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
  flags: [{ kind: 'string', name: 'revision', description: 'Revision id' }]
})

const rolloutRestartCommand = createLeafCommand({
  path: ['rollout', 'restart'],
  use: 'rollout restart (TYPE NAME | TYPE/NAME)',
  short: 'Restart a resource',
  handlerId: 'rollout'
})

const rolloutUndoCommand = createLeafCommand({
  path: ['rollout', 'undo'],
  use: 'rollout undo (TYPE NAME | TYPE/NAME)',
  short: 'Roll back to a previous revision',
  handlerId: 'rollout',
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
  configCommand
]
