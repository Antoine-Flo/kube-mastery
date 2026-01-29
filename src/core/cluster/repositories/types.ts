// ═══════════════════════════════════════════════════════════════════════════
// GENERIC REPOSITORY TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Common types for all Kubernetes resources to enable generic CRUD operations

// Base interface that all K8s resources must implement
// Using a more flexible metadata type to allow specific metadata interfaces
export interface KubernetesResource {
    kind: string
    metadata: {
        name: string
        namespace: string
    }
}

// Generic collection wrapper for any resource type
export interface ResourceCollection<T extends KubernetesResource> {
    items: T[]
}

