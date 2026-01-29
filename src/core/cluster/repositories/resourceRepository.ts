// ═══════════════════════════════════════════════════════════════════════════
// GENERIC RESOURCE REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════
// Generic CRUD operations for any Kubernetes resource type

import { error, success, type Result } from '../../shared/result'
import type { KubernetesResource, ResourceCollection } from './types'

// Create empty collection (internal use only)
const createEmptyCollection = <T extends KubernetesResource>(): ResourceCollection<T> => ({
    items: [],
})

// Add resource to collection (internal use only)
const add = <T extends KubernetesResource>(
    collection: ResourceCollection<T>,
    resource: T
): ResourceCollection<T> => ({
    items: [...collection.items, resource],
})

// Get all resources (optionally filtered by namespace) (internal use only)
const getAll = <T extends KubernetesResource>(
    collection: ResourceCollection<T>,
    namespace?: string
): T[] => {
    if (!namespace) {
        return [...collection.items]
    }
    return collection.items.filter((item) => item.metadata.namespace === namespace)
}

// Find single resource by name and namespace (internal use only)
const find = <T extends KubernetesResource>(
    collection: ResourceCollection<T>,
    name: string,
    namespace: string,
    kind: string
): Result<T> => {
    const item = collection.items.find(
        (r) => r.metadata.name === name && r.metadata.namespace === namespace
    )

    if (!item) {
        return error(`Error from server (NotFound): ${kind.toLowerCase()}s "${name}" not found`)
    }

    return success(item)
}

// Remove resource by name and namespace (internal use only)
const remove = <T extends KubernetesResource>(
    collection: ResourceCollection<T>,
    name: string,
    namespace: string,
    kind: string
): Result<T> & { collection?: ResourceCollection<T> } => {
    const index = collection.items.findIndex(
        (r) => r.metadata.name === name && r.metadata.namespace === namespace
    )

    if (index === -1) {
        return error(`Error from server (NotFound): ${kind.toLowerCase()}s "${name}" not found`)
    }

    const deleted = collection.items[index]
    const newItems = [...collection.items.slice(0, index), ...collection.items.slice(index + 1)]

    return {
        ok: true,
        value: deleted,
        collection: { items: newItems },
    }
}

// Update resource by name and namespace (internal use only)
const update = <T extends KubernetesResource>(
    collection: ResourceCollection<T>,
    name: string,
    namespace: string,
    updateFn: (resource: T) => T,
    kind: string
): Result<T> & { collection?: ResourceCollection<T> } => {
    const index = collection.items.findIndex(
        (r) => r.metadata.name === name && r.metadata.namespace === namespace
    )

    if (index === -1) {
        return error(`Error from server (NotFound): ${kind.toLowerCase()}s "${name}" not found`)
    }

    const updated = updateFn(collection.items[index])
    const newItems = [
        ...collection.items.slice(0, index),
        updated,
        ...collection.items.slice(index + 1),
    ]

    return {
        ok: true,
        value: updated,
        collection: { items: newItems },
    }
}

// Create resource-specific repository with bound kind
export const createResourceRepository = <T extends KubernetesResource>(kind: string) => {
    return {
        createEmpty: () => createEmptyCollection<T>(),
        add: (collection: ResourceCollection<T>, resource: T) => add(collection, resource),
        getAll: (collection: ResourceCollection<T>, namespace?: string) =>
            getAll(collection, namespace),
        find: (collection: ResourceCollection<T>, name: string, namespace: string) =>
            find(collection, name, namespace, kind),
        remove: (collection: ResourceCollection<T>, name: string, namespace: string) =>
            remove(collection, name, namespace, kind),
        update: (
            collection: ResourceCollection<T>,
            name: string,
            namespace: string,
            updateFn: (resource: T) => T
        ) => update(collection, name, namespace, updateFn, kind),
    }
}

