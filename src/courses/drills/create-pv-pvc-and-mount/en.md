---
title: Create PV/PVC and Mount in a Pod
description: Provision static storage from scratch, bind a PVC to a PV, and mount the volume inside a running pod.
tag: storage
environment: minimal
ckaTargetMinutes: 10
---

## Create a namespace named `storage-lab`

### Solution

```bash
kubectl create namespace storage-lab
```

PVC and workload resources live in this namespace. The PV itself is cluster-scoped.

## Create a PersistentVolume named `data-pv` with hostPath `/mnt/data`, capacity `1Gi`, accessMode `ReadWriteOnce`, storageClassName `manual`, reclaimPolicy `Retain`

### Solution

No imperative command exists for PersistentVolume. In the exam, open the docs at Concepts > Storage > Persistent Volumes and copy the hostPath example.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: data-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/data
```

```bash
kubectl apply -f pv.yaml
```

PV is cluster-scoped, no `-n` flag needed.

### Validation

```yaml
- type: clusterResourceExists
  kind: PersistentVolume
  name: data-pv
  onFail: "Le PersistentVolume `data-pv` n'existe pas encore dans le cluster."
- type: clusterFieldEquals
  kind: PersistentVolume
  name: data-pv
  path: '{.spec.capacity.storage}'
  value: '1Gi'
  onFail: "La capacité de `data-pv` n'est pas `1Gi`."
- type: clusterFieldEquals
  kind: PersistentVolume
  name: data-pv
  path: '{.spec.storageClassName}'
  value: 'manual'
  onFail: "Le storageClassName de `data-pv` n'est pas `manual`."
```

## Create a PersistentVolumeClaim named `data-pvc` in namespace `storage-lab` with storageClassName `manual`, accessMode `ReadWriteOnce`, and requested storage `500Mi`

### Solution

No imperative command exists for PersistentVolumeClaim. In the exam, open the docs at Concepts > Storage > Persistent Volumes > PersistentVolumeClaims. Save the exemple in a file with nano and update it before applying it.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-pvc
  namespace: storage-lab
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

```bash
kubectl apply -f pvc.yaml
```

`storageClassName` and `accessModes` must match the PV exactly for binding to succeed.

### Validation

```yaml
- type: clusterResourceExists
  kind: PersistentVolumeClaim
  namespace: storage-lab
  name: data-pvc
  onFail: "La PersistentVolumeClaim `data-pvc` n'existe pas dans `storage-lab`."
- type: clusterFieldEquals
  kind: PersistentVolumeClaim
  namespace: storage-lab
  name: data-pvc
  path: '{.spec.storageClassName}'
  value: 'manual'
  onFail: "Le storageClassName de `data-pvc` n'est pas `manual`."
- type: clusterFieldEquals
  kind: PersistentVolumeClaim
  namespace: storage-lab
  name: data-pvc
  path: '{.status.phase}'
  value: 'Bound'
  onFail: "La PVC `data-pvc` n'est pas en état Bound. Vérifiez que storageClassName et accessMode correspondent exactement au PV."
```

## Create pod `storage-pod` in namespace `storage-lab`, image `busybox:1.36`, command `sleep 3600`, with a volume from PVC `data-pvc` mounted at `/data`

### Solution

Generate a base manifest quickly with kubectl:

```bash
kubectl run storage-pod -n storage-lab --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > pod.yaml
```

Then adapt it so `pod.yaml` matches this final manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: storage-pod
  namespace: storage-lab
spec:
  containers:
    - name: storage-pod
      image: busybox:1.36
      command: ["sleep", "3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data-pvc
```

```bash
kubectl apply -f pod.yaml
kubectl wait --for=condition=Ready pod/storage-pod -n storage-lab --timeout=60s
```

The `name` value must be identical in `volumes` and `volumeMounts`.

### Validation

```yaml
- type: clusterFieldContains
  kind: Pod
  namespace: storage-lab
  name: storage-pod
  path: '{.spec.containers[0].volumeMounts[*].mountPath}'
  value: '/data'
  onFail: "Le volume n'est pas monté à `/data` dans `storage-pod`. Vérifiez `volumeMounts` et `volumes` dans le manifest."
- type: clusterFieldEquals
  kind: Pod
  namespace: storage-lab
  name: storage-pod
  path: '{.status.phase}'
  value: 'Running'
  onFail: "Le pod `storage-pod` n'est pas Running."
```

## Write a file inside `storage-pod` to confirm the volume is writable, then read it back

### Solution

```bash
kubectl exec -n storage-lab storage-pod -- sh -c 'echo cka-ok > /data/probe.txt && cat /data/probe.txt'
```

If the mount is correct, write and read both succeed.
