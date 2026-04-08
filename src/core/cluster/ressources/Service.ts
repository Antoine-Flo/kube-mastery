import { z } from 'zod'
import type { components } from '../../openapi/generated/openapi-types.generated'
import type {
  K8sService,
  K8sServiceMetadata,
  K8sServiceSpec,
  K8sServiceStatus
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

// ─── Types ───────────────────────────────────────────────────────────────

type ServiceMetadata = Pick<
  K8sServiceMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
>

type IoSchemas = components['schemas']

export type ServicePort = IoSchemas['io.k8s.api.core.v1.ServicePort'] & {
  protocol?: 'TCP' | 'UDP' | 'SCTP'
}

/** Simulator keeps at least one port; OpenAPI leaves ports optional. */
export type ServiceSpec = K8sServiceSpec & {
  ports: NonNullable<K8sServiceSpec['ports']>
}

export type ServiceStatus = K8sServiceStatus

export type Service = Omit<K8sService, 'metadata' | 'spec' | 'status'> & {
  metadata: ServiceMetadata
  spec: ServiceSpec
  status?: ServiceStatus
}

// ─── Factory ─────────────────────────────────────────────────────────────

interface ServiceConfig extends NamespacedFactoryConfigBase {
  ports: Array<{
    name?: string
    protocol?: 'TCP' | 'UDP' | 'SCTP'
    port: number
    targetPort?: number | string
    nodePort?: number
  }>
  type?: K8sServiceSpec['type']
  selector?: Record<string, string>
  clusterIP?: string
  externalIPs?: string[]
  externalName?: string
  sessionAffinity?: K8sServiceSpec['sessionAffinity']
  status?: ServiceStatus
}

export const createService = (config: ServiceConfig): Service => {
  const service: Service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: {
      type: config.type || 'ClusterIP',
      ports: config.ports.map((port) => ({
        protocol: port.protocol || 'TCP',
        port: port.port,
        ...(port.name && { name: port.name }),
        ...(port.targetPort !== undefined && { targetPort: port.targetPort }),
        ...(port.nodePort !== undefined && { nodePort: port.nodePort })
      })),
      ...(config.selector && { selector: config.selector }),
      ...(config.clusterIP !== undefined && { clusterIP: config.clusterIP }),
      ...(config.externalIPs && { externalIPs: config.externalIPs }),
      ...(config.externalName && { externalName: config.externalName }),
      ...(config.sessionAffinity && { sessionAffinity: config.sessionAffinity })
    },
    ...(config.status != null && {
      status: {
        loadBalancer: config.status.loadBalancer ?? {},
        ...(config.status.conditions != null && {
          conditions: config.status.conditions
        })
      }
    })
  }

  return deepFreeze(service)
}

// ─── Zod Schema for YAML Validation ───────────────────────────────────────

const ServicePortSchema = z.object({
  name: z.string().optional(),
  protocol: z.enum(['TCP', 'UDP', 'SCTP']).default('TCP'),
  port: z.number().int().positive(),
  targetPort: z.union([z.number().int().positive(), z.string()]).optional(),
  nodePort: z.number().int().positive().optional()
})

const ServiceSpecSchema = z.object({
  type: z
    .enum(['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'])
    .default('ClusterIP'),
  selector: z.record(z.string(), z.string()).optional(),
  ports: z.array(ServicePortSchema).min(1, 'At least one port is required'),
  clusterIP: z.string().optional(),
  externalIPs: z.array(z.string()).optional(),
  externalName: z.string().optional(),
  sessionAffinity: z.enum(['ClientIP', 'None']).optional()
})

const ServiceManifestSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('Service'),
  metadata: z.object({
    name: z.string().min(1, 'Service name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: ServiceSpecSchema,
  status: z
    .object({
      loadBalancer: z
        .object({
          ingress: z
            .array(
              z.object({
                ip: z.string().optional(),
                hostname: z.string().optional()
              })
            )
            .optional()
        })
        .optional()
    })
    .optional()
})

/**
 * Parse and validate Service manifest from YAML
 */
export const parseServiceManifest = (data: unknown): Result<Service> => {
  const result = ServiceManifestSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Service manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data

  const service: Service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
      creationTimestamp:
        manifest.metadata.creationTimestamp || new Date().toISOString(),
      ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
      ...(manifest.metadata.annotations && {
        annotations: manifest.metadata.annotations
      })
    },
    spec: {
      type: manifest.spec.type,
      ports: manifest.spec.ports.map((port) => ({
        protocol: port.protocol,
        port: port.port,
        ...(port.name && { name: port.name }),
        ...(port.targetPort !== undefined && { targetPort: port.targetPort }),
        ...(port.nodePort !== undefined && { nodePort: port.nodePort })
      })),
      ...(manifest.spec.selector && { selector: manifest.spec.selector }),
      ...(manifest.spec.clusterIP !== undefined && {
        clusterIP: manifest.spec.clusterIP
      }),
      ...(manifest.spec.externalIPs && {
        externalIPs: manifest.spec.externalIPs
      }),
      ...(manifest.spec.externalName && {
        externalName: manifest.spec.externalName
      }),
      ...(manifest.spec.sessionAffinity && {
        sessionAffinity: manifest.spec.sessionAffinity
      })
    },
    ...(manifest.status != null && {
      status: {
        loadBalancer: manifest.status.loadBalancer ?? {}
      }
    })
  }

  return success(deepFreeze(service))
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Get service type for display (defaults to ClusterIP)
 */
export const getServiceType = (service: Service): string => {
  return service.spec.type || 'ClusterIP'
}
