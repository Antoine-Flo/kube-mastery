import { createService, type Service } from '../../cluster/ressources/Service'
import type { SimDeploymentWorkloadSpec } from '../../cluster/systemWorkloads/SimWorkloadSpecs'
import {
  ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY,
  ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE,
  ENVOY_GATEWAY_CONTROL_PLANE_SERVICE_NAME,
  ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME,
  ENVOY_GATEWAY_DEPLOYMENT_NAME,
  ENVOY_GATEWAY_NAMESPACE,
  ENVOY_GATEWAY_VERSION
} from './constants'

export const ENVOY_GATEWAY_SYSTEM_NAMESPACES = [ENVOY_GATEWAY_NAMESPACE] as const

export const createEnvoyGatewaySystemServices = (
  creationTimestamp: string
): Service[] => {
  return [
    createService({
      name: ENVOY_GATEWAY_CONTROL_PLANE_SERVICE_NAME,
      namespace: ENVOY_GATEWAY_NAMESPACE,
      creationTimestamp,
      clusterIP: '10.96.200.10',
      selector: {
        'app.kubernetes.io/name': ENVOY_GATEWAY_DEPLOYMENT_NAME,
        'app.kubernetes.io/component': 'control-plane',
        [ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY]:
          ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE
      },
      ports: [
        {
          name: 'grpc',
          port: 18000,
          protocol: 'TCP',
          targetPort: 18000
        },
        {
          name: 'ratelimit',
          port: 18001,
          protocol: 'TCP',
          targetPort: 18001
        },
        {
          name: 'xds',
          port: 18002,
          protocol: 'TCP',
          targetPort: 18002
        },
        {
          name: 'metrics',
          port: 19001,
          protocol: 'TCP',
          targetPort: 19001
        },
        {
          name: 'webhook',
          port: 9443,
          protocol: 'TCP',
          targetPort: 9443
        }
      ]
    }),
    createService({
      name: ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME,
      namespace: ENVOY_GATEWAY_NAMESPACE,
      creationTimestamp,
      type: 'LoadBalancer',
      clusterIP: '10.96.200.11',
      selector: {
        'gateway.envoyproxy.io/owning-gateway-namespace': 'default',
        'gateway.envoyproxy.io/owning-gateway-name': 'eg'
      },
      ports: [
        {
          name: 'http',
          port: 80,
          protocol: 'TCP',
          targetPort: 10080,
          nodePort: 30080
        }
      ]
    })
  ]
}

export const createEnvoyGatewayDeploymentSpecs = (
  controlPlaneNodeName: string
): SimDeploymentWorkloadSpec[] => {
  return [
    {
      kind: 'deployment',
      name: ENVOY_GATEWAY_DEPLOYMENT_NAME,
      namespace: ENVOY_GATEWAY_NAMESPACE,
      containerName: ENVOY_GATEWAY_DEPLOYMENT_NAME,
      labels: {
        'app.kubernetes.io/name': ENVOY_GATEWAY_DEPLOYMENT_NAME,
        'app.kubernetes.io/component': 'control-plane',
        'app.kubernetes.io/part-of': 'envoy-gateway',
        'app.kubernetes.io/version': ENVOY_GATEWAY_VERSION,
        [ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY]:
          ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE
      },
      selectorLabels: {
        'app.kubernetes.io/name': ENVOY_GATEWAY_DEPLOYMENT_NAME,
        'app.kubernetes.io/component': 'control-plane',
        [ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY]:
          ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE
      },
      replicas: 1,
      nodeSelector: {
        'kubernetes.io/os': 'linux'
      },
      tolerations: [
        {
          key: 'node-role.kubernetes.io/control-plane',
          operator: 'Exists',
          effect: 'NoSchedule'
        }
      ],
      annotations: {
        'sim.kubernetes.io/preferred-node': controlPlaneNodeName
      }
    }
  ]
}
