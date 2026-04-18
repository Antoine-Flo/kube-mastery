---
title: Create an etcd Snapshot Backup
isDraft: true
description: Back up etcd using etcdctl with control plane certificates.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 9
---

## Locate etcd certificate and key paths from static pod manifest

### Solution

```bash
grep -E 'cert-file|key-file|trusted-ca-file' /etc/kubernetes/manifests/etcd.yaml
```

Reading the manifest first avoids wrong TLS paths on customized control-plane setups.

## Create an etcd snapshot at `/opt/etcd-snapshot.db`

### Solution

```bash
ETCDCTL_API=3 etcdctl snapshot save /opt/etcd-snapshot.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
```

The snapshot command must use endpoint and TLS flags matching the running etcd instance.

## Verify snapshot metadata

### Solution

```bash
ETCDCTL_API=3 etcdctl snapshot status /opt/etcd-snapshot.db --write-table
```

A valid snapshot must return status output with revision and size.

### Validation

```yaml
- type: filesystemFileExists
  path: /opt/etcd-snapshot.db
  onFail: "Le snapshot n'est pas valide ou ne peut pas être lu par etcdctl."
```

## Confirm snapshot file exists and is non-empty

### Solution

```bash
test -s /opt/etcd-snapshot.db
ls -lh /opt/etcd-snapshot.db
```

This verifies the backup artifact exists and has content.

### Validation

```yaml
- type: filesystemFileNotEmpty
  path: /opt/etcd-snapshot.db
  onFail: 'Le fichier `/opt/etcd-snapshot.db` est absent ou vide.'
```
