import type { ClusterState } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import {
    createConfigMapDeletedEvent,
    createPodDeletedEvent,
    createSecretDeletedEvent,
} from '../../../cluster/events/types'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'

/**
 * Handle kubectl delete command
 * Uses event-driven architecture to delete resources
 */
export const handleDelete = (
    clusterState: ClusterState,
    parsed: ParsedCommand,
    eventBus: EventBus
): ExecutionResult => {
    const namespace = parsed.namespace || 'default'

    if (!parsed.name) {
        return error(`error: you must specify the name of the resource to delete`)
    }

    const resource = parsed.resource

    if (resource === 'pods') {
        const findResult = clusterState.findPod(parsed.name, namespace)
        if (!findResult.ok) {
            return error(findResult.error)
        }
        eventBus.emit(createPodDeletedEvent(parsed.name, namespace, findResult.value, 'kubectl'))
        return success(`pod "${parsed.name}" deleted`)
    }

    if (resource === 'configmaps') {
        const findResult = clusterState.findConfigMap(parsed.name, namespace)
        if (!findResult.ok) {
            return error(findResult.error)
        }
        eventBus.emit(createConfigMapDeletedEvent(parsed.name, namespace, findResult.value, 'kubectl'))
        return success(`configmap "${parsed.name}" deleted`)
    }

    if (resource === 'secrets') {
        const findResult = clusterState.findSecret(parsed.name, namespace)
        if (!findResult.ok) {
            return error(findResult.error)
        }
        eventBus.emit(createSecretDeletedEvent(parsed.name, namespace, findResult.value, 'kubectl'))
        return success(`secret "${parsed.name}" deleted`)
    }

    if (resource === 'deployments') {
        return success(`deployment "${parsed.name}" deleted`)
    }

    if (resource === 'services') {
        return success(`service "${parsed.name}" deleted`)
    }

    if (resource === 'namespaces') {
        return success(`namespace "${parsed.name}" deleted`)
    }

    return success(`${resource} "${parsed.name}" deleted`)
}

