import type { Container } from '../ressources/Pod'

type TemplateContainerLike = {
  name: string
  image: string
  command?: string[]
  args?: string[]
  ports?: Array<{
    containerPort: number
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
  livenessProbe?: Container['livenessProbe']
  readinessProbe?: Container['readinessProbe']
  startupProbe?: Container['startupProbe']
}

const convertTemplateContainer = (
  container: TemplateContainerLike
): Container => {
  return {
    name: container.name,
    image: container.image,
    ...(container.command && { command: container.command }),
    ...(container.args && { args: container.args }),
    ...(container.ports && { ports: container.ports }),
    ...(container.resources && { resources: container.resources }),
    ...(container.env && { env: container.env }),
    ...(container.volumeMounts && { volumeMounts: container.volumeMounts }),
    ...(container.livenessProbe && { livenessProbe: container.livenessProbe }),
    ...(container.readinessProbe && { readinessProbe: container.readinessProbe }),
    ...(container.startupProbe && { startupProbe: container.startupProbe })
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
