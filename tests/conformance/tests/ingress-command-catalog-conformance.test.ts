import { describe, expect, it } from 'vitest'
import { createCommandCatalogSegments } from '../../../bin/config/conformance/command-catalog'

describe('Ingress Command Catalog Conformance', () => {
  it('should include ingress-basics segment with output-oriented checks', () => {
    const segments = createCommandCatalogSegments()
    const ingressSegment = segments.find((segment) => {
      return segment.idPrefix === 'ingress-basics'
    })

    expect(ingressSegment).toBeDefined()
    if (ingressSegment == null) {
      return
    }

    const commands = ingressSegment.commands.map((commandText) => {
      return commandText
    })

    expect(commands).toContain('kubectl get ingress')
    expect(commands).toContain('kubectl describe ingress demo-ingress')
    expect(commands).toContain('kubectl get ingressclass')
    expect(commands).toContain('kubectl delete ingress demo-ingress')
  })

  it('should include openapi/networking raw commands in platform segment', () => {
    const segments = createCommandCatalogSegments()
    const platformSegment = segments.find((segment) => {
      return segment.idPrefix === 'platform'
    })

    expect(platformSegment).toBeDefined()
    if (platformSegment == null) {
      return
    }

    const commands = platformSegment.commands.map((commandText) => {
      return commandText
    })

    expect(commands).toContain('kubectl get --raw /openapi/v3')
    expect(commands).toContain('kubectl get --raw /apis/networking.k8s.io/v1')
    expect(commands).toContain(
      'kubectl get --raw /openapi/v3/apis/networking.k8s.io/v1'
    )
  })
})
