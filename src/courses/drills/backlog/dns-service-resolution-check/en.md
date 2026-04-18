---
title: Debug Service Name Resolution From a Client Pod
isDraft: true
description: Trace DNS and service wiring from a client pod until backend access works by name.
tag: services_networking
environment: minimal
ckaTargetMinutes: 6
---

## Create a temporary test pod for DNS checks

### Solution

```bash
kubectl run dns-debug -n app --image=busybox:1.36 --restart=Never -- sleep 3600
```

A disposable debug pod lets you test DNS resolution from inside the cluster network.

## Resolve short and namespace-qualified backend names

### Solution

```bash
kubectl exec -n app dns-debug -- sh -c 'nslookup backend && nslookup backend.app.svc.cluster.local'
```

Dual lookup distinguishes search-domain issues from service record issues.

## List the target service and endpoints

### Solution

```bash
kubectl get svc,endpoints backend -n app
```

If name resolves but endpoints are empty, the service selector or ports are likely wrong.

## Inspect the service definition

### Solution

```bash
kubectl describe svc backend -n app
```

Use this to verify selector, port, and targetPort values match the backend pods.

## Validate TCP reachability and HTTP response after fixes

### Solution

```bash
kubectl exec -n app dns-debug -- sh -c 'nc -zvw3 backend 80 && wget -qO- http://backend:80'
```

Confirms both network path and application response via service name.

## Clean up the debug pod

### Solution

```bash
kubectl delete pod dns-debug -n app
```

Removes temporary troubleshooting resources after validation.
