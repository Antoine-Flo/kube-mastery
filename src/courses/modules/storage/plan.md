# Plan du Module Storage

## Chapitres

### 01-volumes-intro
Introduction aux volumes : pourquoi les volumes, emptyDir, partage entre containers.

### 02-volumes-types
Types de volumes : hostPath, configMap, secret, downwardAPI, autres types intégrés.

### 03-persistent-volumes-intro
Introduction au stockage persistant : concept PV/PVC, création manuelle, binding basique.

### 04-persistent-volumes-avance
PV/PVC avancés : access modes, reclaim policies, volume modes (Filesystem vs Block), binding modes.

### 05-storage-classes-intro
Introduction aux StorageClass : concept, provisioning dynamique basique, default class.

### 06-storage-classes-avance
StorageClass avancées : paramètres, volume binding modes, allowed topologies.

### 07-ephemeral-volumes
Volumes éphémères : generic ephemeral volumes, CSI ephemeral volumes, cas d'usage.

### 08-projected-volumes
Volumes projetés : combinaison de sources multiples (secrets, configmaps, downward API, serviceAccountToken).

### 09-volume-snapshots
Snapshots de volumes : VolumeSnapshot, VolumeSnapshotClass, restauration, clonage.

### 10-volume-cloning
Clonage de PVC : dataSource, cas d'usage, limitations.

### 11-storage-capacity
Gestion de la capacité : CSIStorageCapacity, scheduling basé sur la capacité, reporting.

### 12-storage-limits
Limites de stockage : quotas par namespace, limites par node, ephemeral storage limits.

### 13-volume-health
Monitoring des volumes : health monitoring, détection des problèmes, alerting.

### 14-csi
Container Storage Interface : architecture CSI, drivers, migration depuis in-tree plugins.
