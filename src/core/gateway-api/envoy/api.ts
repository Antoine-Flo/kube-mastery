import type { ClusterStateData } from '../../cluster/ClusterState'
import {
  ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY,
  ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE,
  ENVOY_GATEWAY_CONTROLLER_NAME,
  ENVOY_GATEWAY_DEPLOYMENT_NAME,
  ENVOY_GATEWAY_GATEWAY_CLASS_NAME,
  ENVOY_GATEWAY_GATEWAY_NAME,
  ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_NAME,
  ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_PORT,
  ENVOY_GATEWAY_HTTP_ROUTE_HOSTNAME,
  ENVOY_GATEWAY_HTTP_ROUTE_NAME,
  ENVOY_GATEWAY_NAMESPACE
} from './constants'

export interface GatewayClassSyntheticResource {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  spec: {
    controllerName: string
  }
}

export interface GatewaySyntheticResource {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  spec: {
    gatewayClassName: string
  }
  status: {
    address: string
    programmed: string
  }
}

export interface HTTPRouteSyntheticResource {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  spec: {
    hostnames: string[]
  }
}

export type EnvoyGatewayStateSlice = Pick<
  ClusterStateData,
  'deployments' | 'pods' | 'services'
>

export interface EnvoyGatewayApiSurface {
  hasController(state: EnvoyGatewayStateSlice): boolean
  listGatewayClassesForGet(
    state: EnvoyGatewayStateSlice
  ): GatewayClassSyntheticResource[]
  listGatewaysForGet(state: EnvoyGatewayStateSlice): GatewaySyntheticResource[]
  listHttpRoutesForGet(
    state: EnvoyGatewayStateSlice
  ): HTTPRouteSyntheticResource[]
  getGatewayClassDescribeOutput(
    state: EnvoyGatewayStateSlice,
    name: string
  ): string | null
  getGatewayDescribeOutput(
    state: EnvoyGatewayStateSlice,
    name: string
  ): string | null
  getHttpRouteDescribeOutput(
    state: EnvoyGatewayStateSlice,
    name: string
  ): string | null
}

const buildStableUnsignedHash = (seed: string): number => {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const buildStableHex = (seed: string, length: number): string => {
  let output = ''
  let salt = 0
  while (output.length < length) {
    const chunkSeed = `${seed}:${salt}`
    const chunk = buildStableUnsignedHash(chunkSeed)
      .toString(16)
      .padStart(8, '0')
    output += chunk
    salt += 1
  }
  return output.slice(0, length)
}

const toUuidFromHex = (hex: string): string => {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-')
}

const buildSyntheticMetadataIdentity = (
  state: EnvoyGatewayStateSlice,
  resourceName: string
): { resourceVersion: string; uid: string } => {
  const controllerPod = state.pods.items.find((pod) => {
    return (
      pod.metadata.namespace === ENVOY_GATEWAY_NAMESPACE &&
      (pod.metadata.labels?.[ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY] ===
        ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE ||
        pod.metadata.name.startsWith(`${ENVOY_GATEWAY_DEPLOYMENT_NAME}-`))
    )
  })
  const seed = [
    ENVOY_GATEWAY_NAMESPACE,
    ENVOY_GATEWAY_DEPLOYMENT_NAME,
    controllerPod?.metadata.name ?? '<no-pod>',
    controllerPod?.metadata.creationTimestamp ?? '<no-ts>',
    resourceName
  ].join('|')
  const resourceVersion = String(
    (buildStableUnsignedHash(seed) % 90000) + 10000
  )
  const uid = toUuidFromHex(buildStableHex(seed, 32))
  return {
    resourceVersion,
    uid
  }
}

export const hasEnvoyGatewayController = (
  state: EnvoyGatewayStateSlice
): boolean => {
  const deploymentExists = state.deployments.items.some((deployment) => {
    return (
      deployment.metadata.namespace === ENVOY_GATEWAY_NAMESPACE &&
      deployment.metadata.name === ENVOY_GATEWAY_DEPLOYMENT_NAME
    )
  })
  if (deploymentExists) {
    return true
  }
  return state.pods.items.some((pod) => {
    return (
      pod.metadata.namespace === ENVOY_GATEWAY_NAMESPACE &&
      (pod.metadata.labels?.[ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY] ===
        ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE ||
        pod.metadata.name.startsWith(`${ENVOY_GATEWAY_DEPLOYMENT_NAME}-`))
    )
  })
}

export const listGatewayClassesForGet = (
  state: EnvoyGatewayStateSlice
): GatewayClassSyntheticResource[] => {
  if (!hasEnvoyGatewayController(state)) {
    return []
  }
  return [
    {
      metadata: {
        name: ENVOY_GATEWAY_GATEWAY_CLASS_NAME,
        namespace: '',
        creationTimestamp: new Date().toISOString()
      },
      spec: {
        controllerName: ENVOY_GATEWAY_CONTROLLER_NAME
      }
    }
  ]
}

export const listGatewaysForGet = (
  state: EnvoyGatewayStateSlice
): GatewaySyntheticResource[] => {
  if (!hasEnvoyGatewayController(state)) {
    return []
  }
  return [
    {
      metadata: {
        name: ENVOY_GATEWAY_GATEWAY_NAME,
        namespace: 'default',
        creationTimestamp: new Date().toISOString()
      },
      spec: {
        gatewayClassName: ENVOY_GATEWAY_GATEWAY_CLASS_NAME
      },
      status: {
        address: '',
        programmed: 'False'
      }
    }
  ]
}

export const listHttpRoutesForGet = (
  state: EnvoyGatewayStateSlice
): HTTPRouteSyntheticResource[] => {
  if (!hasEnvoyGatewayController(state)) {
    return []
  }
  return [
    {
      metadata: {
        name: ENVOY_GATEWAY_HTTP_ROUTE_NAME,
        namespace: 'default',
        creationTimestamp: new Date().toISOString()
      },
      spec: {
        hostnames: [`["${ENVOY_GATEWAY_HTTP_ROUTE_HOSTNAME}"]`]
      }
    }
  ]
}

export const getGatewayClassDescribeOutput = (
  state: EnvoyGatewayStateSlice,
  name: string
): string | null => {
  if (!hasEnvoyGatewayController(state)) {
    return null
  }
  if (name !== ENVOY_GATEWAY_GATEWAY_CLASS_NAME) {
    return null
  }
  const nowIso = new Date().toISOString()
  const metadataIdentity = buildSyntheticMetadataIdentity(
    state,
    ENVOY_GATEWAY_GATEWAY_CLASS_NAME
  )
  return [
    `Name:         ${ENVOY_GATEWAY_GATEWAY_CLASS_NAME}`,
    'Namespace:    ',
    'Labels:       <none>',
    'Annotations:  <none>',
    'API Version:  gateway.networking.k8s.io/v1',
    'Kind:         GatewayClass',
    'Metadata:',
    `  Creation Timestamp:  ${nowIso}`,
    '  Finalizers:',
    '    gateway-exists-finalizer.gateway.networking.k8s.io',
    '  Generation:        1',
    `  Resource Version:  ${metadataIdentity.resourceVersion}`,
    `  UID:               ${metadataIdentity.uid}`,
    'Spec:',
    `  Controller Name:  ${ENVOY_GATEWAY_CONTROLLER_NAME}`,
    'Status:',
    '  Conditions:',
    `    Last Transition Time:  ${nowIso}`,
    '    Message:               Valid GatewayClass',
    '    Observed Generation:   1',
    '    Reason:                Accepted',
    '    Status:                True',
    '    Type:                  Accepted',
    'Events:                    <none>'
  ].join('\n')
}

export const getGatewayDescribeOutput = (
  state: EnvoyGatewayStateSlice,
  name: string
): string | null => {
  if (!hasEnvoyGatewayController(state)) {
    return null
  }
  if (name !== ENVOY_GATEWAY_GATEWAY_NAME) {
    return null
  }
  const nowIso = new Date().toISOString()
  const metadataIdentity = buildSyntheticMetadataIdentity(
    state,
    ENVOY_GATEWAY_GATEWAY_NAME
  )
  return [
    `Name:         ${ENVOY_GATEWAY_GATEWAY_NAME}`,
    'Namespace:    default',
    'Labels:       <none>',
    'Annotations:  <none>',
    'API Version:  gateway.networking.k8s.io/v1',
    'Kind:         Gateway',
    'Metadata:',
    `  Creation Timestamp:  ${nowIso}`,
    '  Generation:          1',
    `  Resource Version:    ${metadataIdentity.resourceVersion}`,
    `  UID:                 ${metadataIdentity.uid}`,
    'Spec:',
    `  Gateway Class Name:  ${ENVOY_GATEWAY_GATEWAY_CLASS_NAME}`,
    '  Listeners:',
    '    Allowed Routes:',
    '      Namespaces:',
    '        From:  Same',
    '    Name:      http',
    '    Port:      80',
    '    Protocol:  HTTP',
    'Status:',
    '  Conditions:',
    `    Last Transition Time:  ${nowIso}`,
    '    Message:               The Gateway has been scheduled by Envoy Gateway',
    '    Observed Generation:   1',
    '    Reason:                Accepted',
    '    Status:                True',
    '    Type:                  Accepted',
    `    Last Transition Time:  ${nowIso}`,
    '    Message:               No addresses have been assigned to the Gateway',
    '    Observed Generation:   1',
    '    Reason:                AddressNotAssigned',
    '    Status:                False',
    '    Type:                  Programmed',
    '  Listeners:',
    '    Attached Routes:  1',
    '    Conditions:',
    `      Last Transition Time:  ${nowIso}`,
    '      Message:               Sending translated listener configuration to the data plane',
    '      Observed Generation:   1',
    '      Reason:                Programmed',
    '      Status:                True',
    '      Type:                  Programmed',
    `      Last Transition Time:  ${nowIso}`,
    '      Message:               Listener has been successfully translated',
    '      Observed Generation:   1',
    '      Reason:                Accepted',
    '      Status:                True',
    '      Type:                  Accepted',
    `      Last Transition Time:  ${nowIso}`,
    '      Message:               Listener references have been resolved',
    '      Observed Generation:   1',
    '      Reason:                ResolvedRefs',
    '      Status:                True',
    '      Type:                  ResolvedRefs',
    '    Name:                    http',
    '    Supported Kinds:',
    '      Group:  gateway.networking.k8s.io',
    '      Kind:   HTTPRoute',
    '      Group:  gateway.networking.k8s.io',
    '      Kind:   GRPCRoute',
    'Events:       <none>'
  ].join('\n')
}

export const getHttpRouteDescribeOutput = (
  state: EnvoyGatewayStateSlice,
  name: string
): string | null => {
  if (!hasEnvoyGatewayController(state)) {
    return null
  }
  if (name !== ENVOY_GATEWAY_HTTP_ROUTE_NAME) {
    return null
  }
  const backendServiceExists = state.services.items.some((service) => {
    return (
      service.metadata.namespace === 'default' &&
      service.metadata.name === ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_NAME
    )
  })
  const nowIso = new Date().toISOString()
  const metadataIdentity = buildSyntheticMetadataIdentity(
    state,
    ENVOY_GATEWAY_HTTP_ROUTE_NAME
  )
  const resolvedRefsStatus = backendServiceExists ? 'True' : 'False'
  const resolvedRefsReason = backendServiceExists
    ? 'ResolvedRefs'
    : 'BackendNotFound'
  const resolvedRefsMessage = backendServiceExists
    ? 'All backend references are resolved'
    : `Failed to process route rule 0 backendRef 0: service default/${ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_NAME} not found.`
  return [
    `Name:         ${ENVOY_GATEWAY_HTTP_ROUTE_NAME}`,
    'Namespace:    default',
    'Labels:       <none>',
    'Annotations:  <none>',
    'API Version:  gateway.networking.k8s.io/v1',
    'Kind:         HTTPRoute',
    'Metadata:',
    `  Creation Timestamp:  ${nowIso}`,
    '  Generation:          1',
    `  Resource Version:    ${metadataIdentity.resourceVersion}`,
    `  UID:                 ${metadataIdentity.uid}`,
    'Spec:',
    '  Hostnames:',
    `    ${ENVOY_GATEWAY_HTTP_ROUTE_HOSTNAME}`,
    '  Parent Refs:',
    '    Group:  gateway.networking.k8s.io',
    '    Kind:   Gateway',
    `    Name:   ${ENVOY_GATEWAY_GATEWAY_NAME}`,
    '  Rules:',
    '    Backend Refs:',
    '      Group:   ',
    '      Kind:    Service',
    `      Name:    ${ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_NAME}`,
    `      Port:    ${ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_PORT}`,
    '      Weight:  1',
    '    Matches:',
    '      Path:',
    '        Type:   PathPrefix',
    '        Value:  /',
    'Status:',
    '  Parents:',
    '    Conditions:',
    `      Last Transition Time:  ${nowIso}`,
    '      Message:               Route is accepted',
    '      Observed Generation:   1',
    '      Reason:                Accepted',
    '      Status:                True',
    '      Type:                  Accepted',
    `      Last Transition Time:  ${nowIso}`,
    `      Message:               ${resolvedRefsMessage}`,
    '      Observed Generation:   1',
    `      Reason:                ${resolvedRefsReason}`,
    `      Status:                ${resolvedRefsStatus}`,
    '      Type:                  ResolvedRefs',
    `    Controller Name:         ${ENVOY_GATEWAY_CONTROLLER_NAME}`,
    '    Parent Ref:',
    '      Group:  gateway.networking.k8s.io',
    '      Kind:   Gateway',
    `      Name:   ${ENVOY_GATEWAY_GATEWAY_NAME}`,
    'Events:       <none>'
  ].join('\n')
}

export const ENVOY_GATEWAY_API: EnvoyGatewayApiSurface = Object.freeze({
  hasController: hasEnvoyGatewayController,
  listGatewayClassesForGet,
  listGatewaysForGet,
  listHttpRoutesForGet,
  getGatewayClassDescribeOutput,
  getGatewayDescribeOutput,
  getHttpRouteDescribeOutput
})
