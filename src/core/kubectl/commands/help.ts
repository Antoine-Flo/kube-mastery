const HELP_FLAGS = new Set(['-h', '--help'])

type HelpTopic =
  | 'root'
  | 'get'
  | 'diff'
  | 'create'
  | 'create deployment'
  | 'delete'
  | 'explain'
  | 'describe'
  | 'scale'
  | 'version'
  | 'cluster-info'
  | 'api-versions'
  | 'api-resources'
  | 'logs'
  | 'exec'
  | 'label'
  | 'annotate'
  | 'run'
  | 'config'

const ROOT_HELP = `kubectl controls the Kubernetes cluster manager.

Find more information at: https://kubernetes.io/docs/reference/kubectl/

Basic Commands (Beginner):
  create          Create a resource from a file or from stdin
  run             Run a particular image on the cluster
  get             Display one or many resources
  delete          Delete resources by file names, stdin, resources and names

Troubleshooting and Debugging Commands:
  explain         Get documentation for a resource
  describe        Show details of a specific resource or group of resources
  logs            Print the logs for a container in a pod
  exec            Execute a command in a container

Settings Commands:
  config          Modify kubeconfig files
  label           Update the labels on a resource
  annotate        Update the annotations on a resource

Other Commands:
  version         Print the client and server version information
  diff            Diff the live version against a would-be applied version
  cluster-info    Display cluster information
  api-versions    Print the supported API versions on the server
  api-resources   Print the supported API resources on the server
  scale           Set a new size for a deployment, replica set, or replication controller

Use "kubectl <command> --help" for more information about a given command.
Use "kubectl options" for a list of global command-line options (applies to all commands).`

const HELP_TEXTS: Record<HelpTopic, string> = {
  root: ROOT_HELP,
  get: `Display one or many resources.

Usage:
  kubectl get [(-o|--output=)json|yaml|wide|name|jsonpath=JSONPATH] (TYPE [NAME | -l label] | TYPE/NAME)

Examples:
  kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="ExternalIP")].address}'
  kubectl get nodes -o jsonpath='{range .items[*]}{@.metadata.name}:{range @.status.conditions[*]}{@.type}={@.status};{end}{end}'
  kubectl get pods -o jsonpath='{range .items[*].status.initContainerStatuses[*]}{.containerID}{"\\n"}{end}'

Notes:
  JSONPath regular expressions (=~) are not supported.

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  diff: `Diff configurations specified by file name between the current online configuration, and the configuration as it would be if applied.

Usage:
  kubectl diff -f FILENAME

Exit status:
  0 No differences were found.
  1 Differences were found.
  >1 Kubectl failed with an error.

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  create: `Create a resource from a file or from stdin.

Available Commands:
  deployment   Create a deployment with the specified name

Usage:
  kubectl create -f FILENAME
  kubectl create deployment NAME --image=image [--replicas=COUNT] [--port=PORT]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  'create deployment': `Create a deployment with the specified name.

Usage:
  kubectl create deployment NAME --image=image [--replicas=COUNT] [--port=PORT] [-- COMMAND [args...]]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  delete: `Delete resources by file names, stdin, resources and names.

Usage:
  kubectl delete (-f FILENAME | TYPE [NAME])

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  explain: `Get documentation for a resource.

Usage:
  kubectl explain TYPE [--recursive=TRUE|FALSE] [--api-version=GROUP/VERSION]
  kubectl explain TYPE.FIELD[.FIELD]

Examples:
  kubectl explain pods
  kubectl explain pods.spec.containers

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  describe: `Show details of a specific resource or group of resources.

Usage:
  kubectl describe TYPE NAME

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  scale: `Set a new size for a deployment, replica set, or replication controller.

Usage:
  kubectl scale (TYPE NAME | TYPE/NAME) --replicas=COUNT

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  version: `Print the client and server version information.

Usage:
  kubectl version [--client] [--output=json|yaml]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  'cluster-info': `Display addresses of the control plane and services with label kubernetes.io/cluster-service=true. To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.

Available Commands:
  dump          Dump relevant information for debugging and diagnosis

Usage:
  kubectl cluster-info [flags] [options]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  'api-versions': `Print the supported API versions on the server.

Usage:
  kubectl api-versions

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  'api-resources': `Print the supported API resources on the server.

Usage:
  kubectl api-resources [flags] [options]

Output format: one of (json, yaml, name, wide).
Sort fields: name, kind.

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  logs: `Print the logs for a container in a pod or specified resource.

Usage:
  kubectl logs POD [-c CONTAINER]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  exec: `Execute a command in a container.

Usage:
  kubectl exec POD -- COMMAND [args...]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  label: `Update the labels on a resource.

Usage:
  kubectl label TYPE NAME KEY=VALUE [--overwrite]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  annotate: `Update the annotations on a resource.

Usage:
  kubectl annotate TYPE NAME KEY=VALUE [--overwrite]

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  config: `Modify kubeconfig files.

Usage:
  kubectl config get-contexts
  kubectl config current-context
  kubectl config view [--minify] [--output=json|yaml|jsonpath=JSONPATH]
  kubectl config set-context --current --namespace=NAME

Examples:
  kubectl config view -o jsonpath='{.users[].name}'
  kubectl config view -o jsonpath='{.users[*].name}'

Use "kubectl options" for a list of global command-line options (applies to all commands).`,
  run: `Run a particular image on the cluster.

Usage:
  kubectl run NAME --image=image
  kubectl run -i -t NAME --image=image --restart=Never [--rm]
  kubectl run NAME --image=image -- <arg1> <arg2> ... <argN>
  kubectl run NAME --image=image --command -- COMMAND [args...]
  kubectl run NAME --image=image --env=KEY=VALUE --labels=key=value --port=PORT
  kubectl run NAME --image=image --dry-run=client [-o json|yaml|jsonpath=JSONPATH]

Use "kubectl options" for a list of global command-line options (applies to all commands).`
}

const tokenizeInput = (input: string): string[] => {
  return input
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
}

const hasHelpFlag = (tokens: string[]): boolean => {
  return tokens.some((token) => HELP_FLAGS.has(token))
}

const resolveTopic = (tokens: string[]): HelpTopic => {
  if (tokens.length <= 1) {
    return 'root'
  }

  const actionToken = tokens[1]
  if (HELP_FLAGS.has(actionToken)) {
    return 'root'
  }

  if (
    actionToken === 'create' &&
    tokens.length >= 3 &&
    tokens[2] === 'deployment'
  ) {
    return 'create deployment'
  }

  if (actionToken === 'config') {
    return 'config'
  }

  const topic = actionToken as HelpTopic
  if (HELP_TEXTS[topic]) {
    return topic
  }

  return 'root'
}

export const resolveKubectlHelp = (input: string): string | undefined => {
  const tokens = tokenizeInput(input)
  if (tokens.length === 0) {
    return undefined
  }

  if (tokens[0] !== 'kubectl') {
    return undefined
  }

  if (!hasHelpFlag(tokens)) {
    return undefined
  }

  const topic = resolveTopic(tokens)
  return HELP_TEXTS[topic]
}
