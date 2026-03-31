import type { Container } from '../../cluster/ressources/Pod'
import { convertYamlProbe } from '../../cluster/ressources/yamlConverters'

type TemplateProbeLike = Container['livenessProbe'] | Record<string, unknown>

type TemplateContainerLike = {
  name: string
  image: string
  imagePullPolicy?: string
  command?: string[]
  args?: string[]
  ports?: Array<{
    containerPort: number
    name?: string
    protocol?: 'TCP' | 'UDP'
  }>
  resources?: {
    requests?: {
      cpu?: string
      memory?: string
    }
    limits?: {
      cpu?: string
      memory?: string
    }
  }
  env?: Container['env']
  volumeMounts?: Container['volumeMounts']
  livenessProbe?: TemplateProbeLike
  readinessProbe?: TemplateProbeLike
  startupProbe?: TemplateProbeLike
  securityContext?: Record<string, unknown>
  terminationMessagePath?: string
  terminationMessagePolicy?: string
}

const isTemplateProbe = (
  probe: TemplateProbeLike | undefined
): probe is Container['livenessProbe'] => {
  if (probe == null) {
    return false
  }
  if (typeof probe !== 'object') {
    return false
  }
  if (!('type' in probe)) {
    return false
  }
  const candidate = probe as { type?: unknown }
  if (
    candidate.type !== 'httpGet' &&
    candidate.type !== 'exec' &&
    candidate.type !== 'tcpSocket'
  ) {
    return false
  }
  return true
}

const resolveTemplateProbe = (
  probe: TemplateProbeLike | undefined
): Container['livenessProbe'] | undefined => {
  if (probe == null) {
    return undefined
  }
  if (isTemplateProbe(probe)) {
    return probe
  }
  const convertedProbe = convertYamlProbe(probe)
  if (convertedProbe == null) {
    return undefined
  }
  return convertedProbe
}

const convertTemplateContainer = (
  container: TemplateContainerLike
): Container => {
  const livenessProbe = resolveTemplateProbe(container.livenessProbe)
  const readinessProbe = resolveTemplateProbe(container.readinessProbe)
  const startupProbe = resolveTemplateProbe(container.startupProbe)

  return {
    name: container.name,
    image: container.image,
    ...(container.imagePullPolicy && {
      imagePullPolicy: container.imagePullPolicy
    }),
    ...(container.command && { command: container.command }),
    ...(container.args && { args: container.args }),
    ...(container.ports && { ports: container.ports }),
    ...(container.resources && { resources: container.resources }),
    ...(container.env && { env: container.env }),
    ...(container.volumeMounts && { volumeMounts: container.volumeMounts }),
    ...(livenessProbe != null && { livenessProbe }),
    ...(readinessProbe != null && { readinessProbe }),
    ...(startupProbe != null && { startupProbe }),
    ...(container.securityContext && {
      securityContext: container.securityContext
    }),
    ...(container.terminationMessagePath && {
      terminationMessagePath: container.terminationMessagePath
    }),
    ...(container.terminationMessagePolicy && {
      terminationMessagePolicy: container.terminationMessagePolicy
    })
  }
}

export const convertTemplateContainers = (
  templateContainers: TemplateContainerLike[]
): Container[] => {
  return templateContainers.map(convertTemplateContainer)
}

export const convertTemplateInitContainers = (
  templateInitContainers: TemplateContainerLike[] | undefined
): Container[] | undefined => {
  if (templateInitContainers == null || templateInitContainers.length === 0) {
    return undefined
  }

  return templateInitContainers.map(convertTemplateContainer)
}
