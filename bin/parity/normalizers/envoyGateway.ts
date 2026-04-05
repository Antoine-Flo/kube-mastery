import {
  ENVOY_GATEWAY_CONTROL_PLANE_SERVICE_NAME,
  ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME,
  ENVOY_GATEWAY_DEPLOYMENT_NAME
} from '../../../src/core/gateway-api/envoy/constants'

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ENVOY_GATEWAY_POD_PREFIX_REGEX = new RegExp(
  `${escapeRegex(ENVOY_GATEWAY_DEPLOYMENT_NAME)}-[a-z0-9-]+`,
  'g'
)
const ENVOY_GATEWAY_DATA_PLANE_SERVICE_WITH_HASH_REGEX = new RegExp(
  `${escapeRegex(ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME)}-[a-z0-9]+`,
  'g'
)
const ENVOY_GATEWAY_DATA_PLANE_SERVICE_WITH_HASH_TEST_REGEX = new RegExp(
  `${escapeRegex(ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME)}-[a-z0-9]+`
)
const ENVOY_GATEWAY_DATA_PLANE_SERVICE_EXACT_REGEX = new RegExp(
  `\\b${escapeRegex(ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME)}\\b`,
  'g'
)

export const normalizeEnvoyServiceNameTokensForParity = (value: string): string => {
  return value
    .replace(
      ENVOY_GATEWAY_DATA_PLANE_SERVICE_WITH_HASH_REGEX,
      `${ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME}-<hash>`
    )
    .replace(
      ENVOY_GATEWAY_DATA_PLANE_SERVICE_EXACT_REGEX,
      `${ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME}-<hash>`
    )
}

export const normalizeEnvoyGatewayPodsStdoutForParity = (value: string): string => {
  const lines = value.split('\n').filter((line) => {
    return line.trim().length > 0
  })
  if (lines.length === 0) {
    return value
  }
  const normalizedRows = lines.slice(1).map((line) => {
    return line
      .trim()
      .replace(
        ENVOY_GATEWAY_POD_PREFIX_REGEX,
        `${ENVOY_GATEWAY_DEPLOYMENT_NAME}-<pod>`
      )
      .replace(/\s+/g, ' ')
  })
  return normalizedRows.sort().join('\n')
}

export const normalizeEnvoyGatewayServicesStdoutForParity = (
  value: string
): string => {
  const compact = value
    .split('\n')
    .map((line) => {
      return line.trim()
    })
    .join('\n')
  const hasControlService = compact.includes(ENVOY_GATEWAY_CONTROL_PLANE_SERVICE_NAME)
  const hasDataPlaneService =
    compact.includes(ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME) ||
    ENVOY_GATEWAY_DATA_PLANE_SERVICE_WITH_HASH_TEST_REGEX.test(compact)
  if (hasControlService && hasDataPlaneService) {
    return '<envoy-gateway-services-present>'
  }
  return compact
}

export const normalizeDescribeGatewayClassStdoutForParity = (
  value: string
): string => {
  return normalizeDescribeBodyStrictForParity(value)
}

export const normalizeDescribeGatewayStdoutForParity = (value: string): string => {
  return normalizeDescribeBodyStrictForParity(value)
}

export const normalizeDescribeHttpRouteStdoutForParity = (
  value: string
): string => {
  return normalizeDescribeBodyStrictForParity(value)
}

const normalizeDescribeBodyStrictForParity = (value: string): string => {
  return value
    .replace(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
      '<timestamp>'
    )
    .replace(/(Resource Version:\s+)\d+/g, '$1<resource-version>')
    .replace(
      /(UID:\s+)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '$1<uid>'
    )
    .split('\n')
    .map((line) => {
      return line.trimEnd()
    })
    .filter((line) => {
      return line.length > 0
    })
    .join('\n')
}
