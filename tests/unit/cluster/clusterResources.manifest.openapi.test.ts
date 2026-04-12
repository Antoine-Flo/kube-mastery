import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { BUNDLED_OPENAPI_SPECS } from '../../../src/core/openapi/bundledOpenAPISpecs'
import {
  validateClusterResourcesManifest,
  validateManifestEntryAgainstSpecs,
  type ClusterResourcesManifest
} from '../../../src/core/cluster/validateClusterResourcesManifest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.join(
  __dirname,
  '../../../src/core/cluster/clusterResources.manifest.yaml'
)

describe('clusterResources.manifest.yaml', () => {
  it('passes structural and bundled OpenAPI validation', () => {
    const raw = fs.readFileSync(manifestPath, 'utf8')
    const manifest = YAML.parse(raw) as ClusterResourcesManifest
    const result = validateClusterResourcesManifest(manifest)
    if (!result.ok) {
      expect(result.errors).toEqual([])
    }
    expect(result.ok).toBe(true)
  })

  it('each entry resolves against bundled specs helper', () => {
    const raw = fs.readFileSync(manifestPath, 'utf8')
    const manifest = YAML.parse(raw) as ClusterResourcesManifest
    for (const entry of manifest.resources) {
      if (entry.openapiSource === 'external-crd') {
        continue
      }
      const one = validateManifestEntryAgainstSpecs(
        entry,
        BUNDLED_OPENAPI_SPECS
      )
      expect(one.ok).toBe(true)
    }
  })
})
