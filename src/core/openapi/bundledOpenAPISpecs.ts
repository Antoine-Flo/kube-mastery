/**
 * OpenAPI documents shipped with the simulator (same set as loader.ts RAW_SPECS).
 * Used for manifest validation and conformance checks.
 */
import type { OpenAPISpec } from './loader'
import apiV1Spec from './specs/api__v1_openapi.json'
import appsV1Spec from './specs/apis__apps__v1_openapi.json'
import coordinationV1Spec from './specs/apis__coordination.k8s.io__v1_openapi.json'
import discoveryV1Spec from './specs/apis__discovery.k8s.io__v1_openapi.json'
import networkingV1Spec from './specs/apis__networking.k8s.io__v1_openapi.json'
import storageV1Spec from './specs/apis__storage.k8s.io__v1_openapi.json'

export const BUNDLED_OPENAPI_SPEC_FILES = [
  'api__v1_openapi.json',
  'apis__apps__v1_openapi.json',
  'apis__coordination.k8s.io__v1_openapi.json',
  'apis__discovery.k8s.io__v1_openapi.json',
  'apis__networking.k8s.io__v1_openapi.json',
  'apis__storage.k8s.io__v1_openapi.json'
] as const

export const BUNDLED_OPENAPI_SPECS: OpenAPISpec[] = [
  apiV1Spec as OpenAPISpec,
  appsV1Spec as OpenAPISpec,
  coordinationV1Spec as OpenAPISpec,
  discoveryV1Spec as OpenAPISpec,
  networkingV1Spec as OpenAPISpec,
  storageV1Spec as OpenAPISpec
]
