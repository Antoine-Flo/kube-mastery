// ═══════════════════════════════════════════════════════════════════════════
// LAZY LOADING WRAPPER FOR EMULATED ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════
// Permet de charger le code de l'EmulatedEnvironment uniquement quand nécessaire
// Cela évite d'inclure tout le code dans le bundle principal

import type { CreateEmulatedEnvironmentOptions, EmulatedEnvironment } from './EmulatedEnvironment';

// Lazy load du module EmulatedEnvironmentManager
let emulatedEnvironmentModule: {
  createEmulatedEnvironment: (options?: CreateEmulatedEnvironmentOptions) => EmulatedEnvironment;
  destroyEmulatedEnvironment: (env: EmulatedEnvironment) => void;
} | null = null;

async function loadEmulatedEnvironmentModule() {
  if (!emulatedEnvironmentModule) {
    emulatedEnvironmentModule = await import('./EmulatedEnvironmentManager');
  }
  return emulatedEnvironmentModule;
}

/**
 * Create a new emulated environment (lazy-loaded)
 */
export async function createEmulatedEnvironmentLazy(
  options?: CreateEmulatedEnvironmentOptions
): Promise<EmulatedEnvironment> {
  const module = await loadEmulatedEnvironmentModule();
  return module.createEmulatedEnvironment(options);
}

/**
 * Destroy an emulated environment (lazy-loaded)
 */
export async function destroyEmulatedEnvironmentLazy(env: EmulatedEnvironment): Promise<void> {
  const module = await loadEmulatedEnvironmentModule();
  return module.destroyEmulatedEnvironment(env);
}

// Export types for convenience
export type { CreateEmulatedEnvironmentOptions, EmulatedEnvironment } from './EmulatedEnvironment';

