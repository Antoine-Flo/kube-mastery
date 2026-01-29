// ═══════════════════════════════════════════════════════════════════════════
// SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

export { scenario, type Scenario, type ScenarioInput } from './types'

// New scenarios with clear naming convention
export { default as minimal } from './minimal'
export { default as podsOnly } from './pods-only'
export { default as deploymentSimple } from './deployment-simple'
export { default as deploymentWithService } from './deployment-with-service'
export { default as deploymentWithSecret } from './deployment-with-secret'
export { default as deploymentWithConfigmap } from './deployment-with-configmap'
export { default as fullStack } from './full-stack'
export { default as multiNamespace } from './multiNamespace'
export { default as podsErrors } from './pods-errors'
export { default as multiNode } from './multi-node'
