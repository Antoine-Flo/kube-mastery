---
title: Recover Cluster DNS After CoreDNS Drift
isDraft: true
description: Track a DNS outage to CoreDNS health or Corefile config and restore name resolution.
tag: troubleshooting
environment: minimal
ckaTargetMinutes: 8
---

## Create a temporary test pod for DNS checks

### Solution

```bash
kubectl run dns-check -n default --image=busybox:1.36 --restart=Never -- sleep 3600
```

A throwaway pod gives a reliable in-cluster point to test DNS behavior.

## Test DNS resolution for both service short and FQDN names

### Solution

```bash
kubectl exec -n default dns-check -- sh -c 'nslookup kubernetes.default && nslookup kubernetes.default.svc.cluster.local'
```

Testing both forms catches search-domain and fully-qualified resolution issues.

## Check CoreDNS deployment readiness

### Solution

```bash
kubectl get deployment coredns -n kube-system -o jsonpath='{.status.readyReplicas}/{.status.replicas}'
```

Readiness ratio gives a direct, scorable DNS control-plane health signal.

## Inspect CoreDNS Corefile content

### Solution

```bash
kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}'
```

Focus directly on active Corefile text to spot accidental edits quickly.

## Restart CoreDNS deployment after config correction

### Solution

```bash
kubectl rollout restart deployment/coredns -n kube-system
kubectl rollout status deployment/coredns -n kube-system
```

Restart plus rollout status ensures new config is loaded and pods are healthy.

## Re-run DNS checks and clean up debug pod

### Solution

```bash
kubectl exec -n default dns-check -- sh -c 'nslookup kubernetes.default && nslookup kubernetes.default.svc.cluster.local'
kubectl delete pod dns-check -n default
```

Final validation confirms name resolution is restored, cleanup keeps cluster tidy.
