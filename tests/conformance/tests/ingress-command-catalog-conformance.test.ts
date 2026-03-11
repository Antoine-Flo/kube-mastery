import { describe, expect, it } from 'vitest'
import { conformanceTests } from '../../../conformance/tests'

describe('Ingress Conformance Catalog', () => {
  it('should include a scenario with ingress output-oriented checks', () => {
    const allScenarios = Object.values(conformanceTests)
    const ingressScenario = allScenarios.find((scenario) => {
      return scenario.cmds.includes('kubectl describe ingress demo-ingress')
    })

    expect(ingressScenario).toBeDefined()
    if (ingressScenario == null) {
      return
    }

    expect(ingressScenario.cmds).toContain('kubectl get ingress')
    expect(ingressScenario.cmds).toContain('kubectl describe ingress demo-ingress')
    expect(ingressScenario.cmds).toContain('kubectl get ingressclass')
    expect(ingressScenario.cleanup).toContain('kubectl delete ingress demo-ingress')
  })

  it('should include openapi/networking raw commands in at least one scenario', () => {
    const allScenarios = Object.values(conformanceTests)
    const scenarioWithRawOpenApi = allScenarios.find((scenario) => {
      return (
        scenario.cmds.includes('kubectl get --raw /openapi/v3') &&
        scenario.cmds.includes('kubectl get --raw /apis/networking.k8s.io/v1') &&
        scenario.cmds.includes('kubectl get --raw /openapi/v3/apis/networking.k8s.io/v1')
      )
    })

    expect(scenarioWithRawOpenApi).toBeDefined()
  })
})
