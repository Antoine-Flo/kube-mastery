// ═══════════════════════════════════════════════════════════════════════════
// DEMO SEED
// ═══════════════════════════════════════════════════════════════════════════
// Static seed for terminal filesystem.
// Import directly: import { fsConfig } from '../courses/seeds/demo';

import type { FsConfig } from '../../core/filesystem/debianFileSystem'

export const fsConfig: FsConfig = {
  files: {
    '/home/kube/server.yaml': `apiVersion: v1
kind: Pod
metadata:
  name: nginx-demo
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.25
      ports:
        - containerPort: 80
`
  }
}
