import { beforeEach, describe, expect, it } from 'vitest'
import { handleLabel } from '../../../../../src/core/kubectl/commands/handlers/label'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createEventBus, type EventBus } from '../../../../../src/core/cluster/events/EventBus'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl label handler', () => {
    let eventBus: EventBus

    beforeEach(() => {
        eventBus = createEventBus()
    })

    const createState = (pods: ReturnType<typeof createPod>[] = []) => 
        createClusterStateData({ pods })

    const createParsedCommand = (overrides: Partial<ParsedCommand> = {}): ParsedCommand => ({
        action: 'label',
        resource: 'pods',
        flags: {},
        ...overrides
    })

    it('should add label to pod', () => {
        const pod = createPod({
            name: 'my-pod',
            namespace: 'default',
            containers: [{ name: 'main', image: 'nginx:latest' }]
        })
        const state = createState([pod])
        const parsed = createParsedCommand({
            name: 'my-pod',
            labelChanges: { app: 'web' }
        })

        const result = handleLabel(state, parsed, eventBus)

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.value).toContain('labeled')
        }
    })

    it('should return error when name is missing', () => {
        const state = createState()
        const parsed = createParsedCommand({
            labelChanges: { app: 'test' }
        })

        const result = handleLabel(state, parsed, eventBus)

        expect(result.ok).toBe(false)
    })

    it('should return error when no label changes provided', () => {
        const state = createState()
        const parsed = createParsedCommand({
            name: 'my-pod'
        })

        const result = handleLabel(state, parsed, eventBus)

        expect(result.ok).toBe(false)
    })
})
