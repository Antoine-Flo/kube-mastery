import type { FileSystemState } from './FileSystem'
import type { DirectoryNode } from './models'
import { createDirectory, createFile } from './models'

// ═══════════════════════════════════════════════════════════════════════════
// DEBIAN FILESYSTEM TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════
// Composable filesystem factory for client-side use.
// Use createDebianFileSystem() as base, then addFiles() to customize.

// ─── Types ─────────────────────────────────────────────────────────────────

type FileSystemConfig = {
  [path: string]: string | FileSystemConfig
}

// ─── Base Configuration ────────────────────────────────────────────────────

const DEBIAN_FILESYSTEM_CONFIG: FileSystemConfig = {
  bin: {
    sh: '#!/bin/sh\n# Simulated shell binary',
    bash: '#!/bin/bash\n# Simulated bash binary',
    ls: '#!/bin/sh\n# Simulated ls binary',
    cat: '#!/bin/sh\n# Simulated cat binary',
    grep: '#!/bin/sh\n# Simulated grep binary',
    ps: '#!/bin/sh\n# Simulated ps binary',
    env: '#!/bin/sh\n# Simulated env binary',
    mkdir: '#!/bin/sh\n# Simulated mkdir binary',
    rmdir: '#!/bin/sh\n# Simulated rmdir binary',
    cp: '#!/bin/sh\n# Simulated cp binary',
    mv: '#!/bin/sh\n# Simulated mv binary',
    rm: '#!/bin/sh\n# Simulated rm binary',
    echo: '#!/bin/sh\n# Simulated echo binary',
    pwd: '#!/bin/sh\n# Simulated pwd binary',
    cd: '#!/bin/sh\n# Simulated cd binary'
  },
  etc: {
    hostname: 'container-hostname',
    hosts: '127.0.0.1\tlocalhost\n::1\t\tlocalhost ip6-localhost ip6-loopback',
    passwd:
      'root:x:0:0:root:/root:/bin/bash\nkube:x:1000:1000:kube:/home/kube:/bin/bash',
    group: 'root:x:0:\nkube:x:1000:',
    'resolv.conf': 'nameserver 8.8.8.8\nnameserver 8.8.4.4',
    'os-release':
      'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nVERSION="12 (bookworm)"\nID=debian',
    fstab: '# /etc/fstab: static file system information.',
    issue: 'Debian GNU/Linux 12 \\n \\l',
    motd: 'Welcome to Debian GNU/Linux 12 (bookworm)'
  },
  home: {
    kube: {}
  },
  root: {
    '.bashrc':
      '# root .bashrc\n# Source global definitions\nif [ -f /etc/bash.bashrc ]; then\n  . /etc/bash.bashrc\nfi',
    '.profile': '# root .profile'
  },
  tmp: {},
  var: {
    log: {
      syslog: '# System log file',
      messages: '# System messages'
    },
    run: {},
    cache: {},
    lib: {},
    spool: {}
  },
  usr: {
    bin: {},
    local: {
      bin: {},
      lib: {}
    },
    lib: {},
    share: {
      man: {},
      doc: {}
    },
    sbin: {}
  },
  opt: {},
  srv: {},
  sbin: {},
  boot: {},
  dev: {},
  proc: {},
  sys: {},
  mnt: {},
  media: {}
}

/**
 * Files to add: path -> content
 */
export type FilesPreset = Record<string, string>

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Create filesystem tree from configuration object
 */
const createFileSystemFromConfig = (
  config: FileSystemConfig,
  basePath: string = ''
): Map<string, any> => {
  const children = new Map()

  for (const [name, content] of Object.entries(config)) {
    const fullPath = basePath === '' ? `/${name}` : `${basePath}/${name}`

    if (typeof content === 'string') {
      children.set(name, createFile(name, fullPath, content))
    } else {
      const dir = createDirectory(name, fullPath)
      const subChildren = createFileSystemFromConfig(content, fullPath)
      subChildren.forEach((value, key) => {
        dir.children.set(key, value)
      })
      children.set(name, dir)
    }
  }

  return children
}

/**
 * Ensure a directory exists, creating parents as needed
 */
const ensureDirectory = (root: DirectoryNode, path: string): DirectoryNode => {
  if (path === '/') {
    return root
  }

  const parts = path.split('/').filter((p) => p.length > 0)
  let current = root
  let currentPath = ''

  for (const part of parts) {
    currentPath += '/' + part

    if (!current.children.has(part)) {
      const dir = createDirectory(part, currentPath)
      current.children.set(part, dir)
    }
    current = current.children.get(part) as DirectoryNode
  }

  return current
}

// ─── File Presets ──────────────────────────────────────────────────────────

/**
 * Example YAML files for learning
 */
export const EXAMPLE_FILES: FilesPreset = {
  '/home/kube/examples/pod-example.yaml': `apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx:latest
    ports:
    - containerPort: 80`,

  '/home/kube/examples/deployment-example.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.28
        ports:
        - containerPort: 80`,

  '/home/kube/examples/service-example.json': `{
  "apiVersion": "v1",
  "kind": "Service",
  "metadata": {
    "name": "nginx-service",
    "namespace": "default"
  },
  "spec": {
    "selector": {
      "app": "nginx"
    },
    "ports": [
      {
        "protocol": "TCP",
        "port": 80,
        "targetPort": 80
      }
    ],
    "type": "ClusterIP"
  }
}`
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Create a new Debian-like filesystem instance
 * Returns a minimal filesystem without any extras
 */
export const createDebianFileSystem = (): FileSystemState => {
  const root = createDirectory('root', '/')
  const children = createFileSystemFromConfig(DEBIAN_FILESYSTEM_CONFIG)

  children.forEach((value, key) => {
    root.children.set(key, value)
  })

  return {
    currentPath: '/home/kube',
    tree: root
  }
}

/**
 * Add files to an existing filesystem
 * Creates parent directories automatically
 */
const addFiles = (state: FileSystemState, files: FilesPreset): void => {
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/').filter((p) => p.length > 0)
    const fileName = parts.pop()!
    const dirPath = '/' + parts.join('/')

    const dir = ensureDirectory(state.tree, dirPath)
    const file = createFile(fileName, path, content)
    dir.children.set(fileName, file)
  }
}

/**
 * Create host filesystem with kube user and examples
 * Convenience function for the most common use case
 */
export const createHostFileSystem = (): FileSystemState => {
  const state = createDebianFileSystem()
  addFiles(state, EXAMPLE_FILES)
  state.currentPath = '/home/kube'
  return state
}

/**
 * Filesystem config from scenario
 */
export interface FsConfig {
  files?: FilesPreset
}

/**
 * Create filesystem from scenario config
 * Always uses /home/kube as current path (kube user is always present in base filesystem)
 */
export const createFilesystemFromConfig = (
  config?: FsConfig
): FileSystemState => {
  const state = createDebianFileSystem()

  // Always set current path to /home/kube (kube user is in base filesystem)
  state.currentPath = '/home/kube'

  // Add additional files if specified
  if (config?.files) {
    addFiles(state, config.files)
  }

  return state
}
