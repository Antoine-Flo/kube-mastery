/**
 * kubectl version text / JSON / YAML shaping.
 * Upstream: refs/k8s/kubectl/pkg/cmd/version/version.go
 */
import { stringify as yamlStringify } from 'yaml'

export interface VersionInfo {
  major: string
  minor: string
  gitVersion: string
  gitCommit: string
  gitTreeState: string
  buildDate: string
  goVersion: string
  compiler: string
  platform: string
}

export interface ServerVersionInfo extends VersionInfo {
  emulationMajor?: string
  emulationMinor?: string
  minCompatibilityMajor?: string
  minCompatibilityMinor?: string
}

export interface VersionPayload {
  clientVersion: VersionInfo
  kustomizeVersion: string
  serverVersion?: ServerVersionInfo
}

const CLIENT_VERSION: VersionInfo = {
  major: '1',
  minor: '35',
  gitVersion: 'v1.35.0',
  gitCommit: '66452049f3d692768c39c797b21b793dce80314e',
  gitTreeState: 'clean',
  buildDate: '<timestamp>',
  goVersion: 'go1.25.5',
  compiler: 'gc',
  platform: 'linux/amd64'
}

const SERVER_VERSION: ServerVersionInfo = {
  major: '1',
  minor: '35',
  gitVersion: 'v1.35.0',
  gitCommit: '66452049f3d692768c39c797b21b793dce80314e',
  gitTreeState: 'clean',
  buildDate: '<timestamp>',
  goVersion: 'go1.25.5',
  compiler: 'gc',
  platform: 'linux/amd64',
  emulationMajor: '1',
  emulationMinor: '35',
  minCompatibilityMajor: '1',
  minCompatibilityMinor: '34'
}

const KUSTOMIZE_VERSION = 'v5.7.1'

export const buildSimulatedVersionPayload = (options: {
  clientOnly: boolean
}): VersionPayload => {
  const payload: VersionPayload = {
    clientVersion: CLIENT_VERSION,
    kustomizeVersion: KUSTOMIZE_VERSION
  }
  if (options.clientOnly === false) {
    payload.serverVersion = SERVER_VERSION
  }
  return payload
}

export const formatVersionSimpleText = (version: VersionPayload): string => {
  const lines: string[] = []
  lines.push(`Client Version: ${version.clientVersion.gitVersion}`)
  lines.push(`Kustomize Version: ${version.kustomizeVersion}`)
  if (version.serverVersion) {
    lines.push(`Server Version: ${version.serverVersion.gitVersion}`)
  }
  return lines.join('\n')
}

export const formatVersionJson = (version: VersionPayload): string => {
  return JSON.stringify(version, null, 2)
}

export const formatVersionYaml = (version: VersionPayload): string => {
  return yamlStringify(version)
}
