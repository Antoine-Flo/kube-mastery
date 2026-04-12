import {
  ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY,
  ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE,
  ENVOY_GATEWAY_NAMESPACE
} from '../../../src/core/gateway-api/envoy/constants'
import {
  normalizeDescribeGatewayClassStdoutForParity,
  normalizeDescribeGatewayStdoutForParity,
  normalizeDescribeHttpRouteStdoutForParity,
  normalizeEnvoyGatewayPodsStdoutForParity,
  normalizeEnvoyGatewayServicesStdoutForParity,
  normalizeEnvoyServiceNameTokensForParity
} from '../normalizers/envoyGateway'

const ENVOY_GATEWAY_GET_SERVICES_COMMAND = `kubectl get svc -n ${ENVOY_GATEWAY_NAMESPACE}`
const ENVOY_GATEWAY_GET_PODS_COMMAND =
  `kubectl get pods -n ${ENVOY_GATEWAY_NAMESPACE} ` +
  `-l ${ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY}=${ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE}`
const ENVOY_GATEWAY_LOGS_COMMAND =
  `kubectl logs -n ${ENVOY_GATEWAY_NAMESPACE} ` +
  `-l ${ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY}=${ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE} --tail=30`

const isDescribeGatewayClassCommand = (command: string): boolean => {
  return command.trim().startsWith('kubectl describe gatewayclass ')
}

const isDescribeGatewayCommand = (command: string): boolean => {
  return command.trim().startsWith('kubectl describe gateway ')
}

const isDescribeHttpRouteCommand = (command: string): boolean => {
  return command.trim().startsWith('kubectl describe httproute ')
}

const normalizeGatewayDescribeStdoutForParity = (
  command: string,
  stdout: string
): string | null => {
  if (isDescribeGatewayClassCommand(command)) {
    return normalizeDescribeGatewayClassStdoutForParity(stdout)
  }
  if (isDescribeGatewayCommand(command)) {
    return normalizeDescribeGatewayStdoutForParity(stdout)
  }
  if (isDescribeHttpRouteCommand(command)) {
    return normalizeDescribeHttpRouteStdoutForParity(stdout)
  }
  return null
}

const normalizeKnownEnvoyCommandStdoutForParity = (
  command: string,
  stdout: string
): string | null => {
  if (command.trim() === ENVOY_GATEWAY_GET_SERVICES_COMMAND) {
    return normalizeEnvoyGatewayServicesStdoutForParity(stdout)
  }
  if (command.trim() === ENVOY_GATEWAY_GET_PODS_COMMAND) {
    return normalizeEnvoyGatewayPodsStdoutForParity(stdout)
  }
  return normalizeGatewayDescribeStdoutForParity(command, stdout)
}

export const normalizeEnvoyAwareServiceStdoutForParity = (
  stdout: string
): string => {
  return normalizeEnvoyServiceNameTokensForParity(stdout)
}

export const normalizeEnvoyCommandStdoutForParity = (
  command: string,
  stdout: string
): string | null => {
  return normalizeKnownEnvoyCommandStdoutForParity(command, stdout)
}

export const isEnvoyLogsCommandForParity = (command: string): boolean => {
  return command.trim() === ENVOY_GATEWAY_LOGS_COMMAND
}
