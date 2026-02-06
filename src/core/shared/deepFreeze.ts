// ═══════════════════════════════════════════════════════════════════════════
// DEEP FREEZE UTILITY
// ═══════════════════════════════════════════════════════════════════════════
// Recursively freezes an object and all its nested properties.
// Used to ensure immutability of Kubernetes resources.

/**
 * Recursively freezes an object and all its nested properties
 * @param obj - The object to freeze
 * @returns The frozen object (same reference)
 */
export const deepFreeze = <T>(obj: T): T => {
  // Handle null, undefined, and primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  // Already frozen
  if (Object.isFrozen(obj)) {
    return obj
  }

  // Freeze arrays
  if (Array.isArray(obj)) {
    obj.forEach((item) => deepFreeze(item))
    return Object.freeze(obj)
  }

  // Freeze object properties recursively
  Object.keys(obj).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key]
    if (value !== null && typeof value === 'object') {
      deepFreeze(value)
    }
  })

  return Object.freeze(obj)
}
