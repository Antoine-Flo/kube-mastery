---
title: Create PV/PVC and Mount in a Pod
isFree: true
description: Provision static storage from scratch, write PV and PVC manifests, bind them, and mount the volume inside a running pod.
tag: storage
environment: minimal
ckaTargetMinutes: 10
---

## Create a namespace named `storage-lab`

### Solution

```bash
kubectl create namespace storage-lab
```

PVC and workload resources live in this namespace. The PV itself is cluster-scoped and does not belong to a namespace.

## Write a PersistentVolume manifest to `pv.yaml` with specs `data-pv`, hostPath `/mnt/data`, capacity `1Gi`, accessMode `ReadWriteOnce`, storageClassName `manual`, reclaimPolicy `Retain`, then apply it

### Solution

```bash
cat > pv.yaml << 'EOF'
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
EOF
```

```bash
kubectl apply -f pv.yaml
kubectl get pv data-pv
```

PV is cluster-scoped, no `-n` flag needed. After apply, the PV should appear in `Available` state.

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

## Write a PersistentVolumeClaim manifest to `pvc.yaml` in namespace `storage-lab` with specs `data-pvc`, storageClassName `manual`, accessMode `ReadWriteOnce`, requested storage `500Mi`, then apply it

### Solution

```bash
cat > pvc.yaml << 'EOF'
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
EOF
```

```bash
kubectl apply -f pvc.yaml
kubectl get pvc -n storage-lab
```

The storageClassName and accessMode must match the PV for binding to succeed.

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
```

## Verify that both `data-pv` and `data-pvc` are in `Bound` state

### Solution

```bash
kubectl get pv data-pv
kubectl get pvc data-pvc -n storage-lab
```

A PVC binds to a PV when storageClassName, accessMode, and capacity all match.

### Validation

```yaml
- type: clusterFieldEquals
  kind: PersistentVolumeClaim
  namespace: storage-lab
  name: data-pvc
  path: '{.status.phase}'
  value: 'Bound'
  onFail: "La PVC `data-pvc` n'est pas en état Bound. Vérifiez que storageClassName et accessMode correspondent exactement au PV."
```

## Generate a pod manifest for `storage-pod` in namespace `storage-lab`, image `busybox:1.36`, command `sleep 3600`, then add a PVC volume mount at `/data` and apply it

### Solution

```bash
kubectl run storage-pod -n storage-lab --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > pod.yaml
```

Add the PVC volume and mount in `pod.yaml`.

```yaml
spec:
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data-pvc
  containers:
    - name: storage-pod
      volumeMounts:
        - name: data
          mountPath: /data
```

```bash
kubectl apply -f pod.yaml -n storage-lab
```

The volume name must match between `volumes` and `volumeMounts`.

## Wait for `storage-pod` to be Ready

### Solution

```bash
kubectl wait --for=condition=Ready pod/storage-pod -n storage-lab --timeout=60s
```

If the pod stays Pending, inspect describe output for mount errors.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: storage-lab
  name: storage-pod
  path: '{.spec.containers[0].volumeMounts[0].mountPath}'
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

## Write a file inside the pod to confirm the volume is writable, then read it back

### Solution

```bash
kubectl exec -n storage-lab storage-pod -- sh -c 'echo cka-ok > /data/probe.txt && cat /data/probe.txt'
```

If the mount is correct, write and read both succeed.
