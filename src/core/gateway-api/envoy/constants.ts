export const ENVOY_GATEWAY_VERSION = 'v1.7.1'

export const ENVOY_GATEWAY_NAMESPACE = 'envoy-gateway-system'
export const ENVOY_GATEWAY_DEPLOYMENT_NAME = 'envoy-gateway'
export const ENVOY_GATEWAY_CONTROL_PLANE_SERVICE_NAME =
  ENVOY_GATEWAY_DEPLOYMENT_NAME
export const ENVOY_GATEWAY_DATA_PLANE_SERVICE_BASENAME = 'envoy-default-eg'

export const ENVOY_GATEWAY_GATEWAY_CLASS_NAME = 'eg'
export const ENVOY_GATEWAY_GATEWAY_NAME = 'eg'
export const ENVOY_GATEWAY_HTTP_ROUTE_NAME = 'backend'
export const ENVOY_GATEWAY_HTTP_ROUTE_HOSTNAME = 'www.example.com'
export const ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_NAME = 'backend'
export const ENVOY_GATEWAY_HTTP_ROUTE_BACKEND_SERVICE_PORT = 3000

export const ENVOY_GATEWAY_CONTROLLER_NAME =
  'gateway.envoyproxy.io/gatewayclass-controller'

export const ENVOY_GATEWAY_CONTROL_PLANE_LABEL_KEY = 'control-plane'
export const ENVOY_GATEWAY_CONTROL_PLANE_LABEL_VALUE = 'envoy-gateway'

export const ENVOY_GATEWAY_INSTALL_MANIFEST_URL =
  `https://github.com/envoyproxy/gateway/releases/download/${ENVOY_GATEWAY_VERSION}/install.yaml`

export const ENVOY_GATEWAY_QUICKSTART_MANIFEST_URL =
  `https://github.com/envoyproxy/gateway/releases/download/${ENVOY_GATEWAY_VERSION}/quickstart.yaml`
