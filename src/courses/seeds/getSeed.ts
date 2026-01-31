// ═══════════════════════════════════════════════════════════════════════════
// SEED REGISTRY
// ═══════════════════════════════════════════════════════════════════════════
// Resolves seed name (from chapter.json environment) to cluster + fs data.
// No barrel: direct imports per seed file.

import type { ClusterStateData } from '../../core/cluster/ClusterState';
import type { FsConfig } from '../../core/filesystem/debianFileSystem';
import { clusterStateData as demoClusterStateData, fsConfig as demoFsConfig } from './demo';
import { clusterStateData as minimalClusterStateData, fsConfig as minimalFsConfig } from './minimal';

export interface SeedData {
	clusterStateData: ClusterStateData;
	fsConfig: FsConfig;
}

/**
 * Get seed data by name. Used for lesson pages (chapter.environment).
 * Unknown or empty → "minimal".
 */
export function getSeed(seedName: string): SeedData {
	const name = (seedName || '').trim().toLowerCase();
	if (name === 'empty' || name === '') {
		return { clusterStateData: minimalClusterStateData, fsConfig: minimalFsConfig };
	}
	if (name === 'demo') {
		return { clusterStateData: demoClusterStateData, fsConfig: demoFsConfig };
	}
	// default: minimal
	return { clusterStateData: minimalClusterStateData, fsConfig: minimalFsConfig };
}
