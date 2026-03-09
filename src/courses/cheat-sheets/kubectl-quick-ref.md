# kubectl quick Reference

This cheat sheet is adapted from the official Kubernetes quick reference and focused on hands-on practice in the simulator.

Practicing these commands repeatedly in the terminal helps build muscle memory for real troubleshooting and exam-like workflows.

Source: [Kubernetes kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/)

> Note: this quick reference is based on Kubernetes `v1.35`.

## Kubectl context and configuration

```bash
kubectl config view # Show merged kubeconfig settings.

# use multiple kubeconfig files at the same time and view merged config
KUBECONFIG=~/.kube/config:~/.kube/kubconfig2
kubectl config view

# show merged kubeconfig settings and raw certificate data and exposed secrets
kubectl config view --raw

# get the password for the e2e user
kubectl config view -o jsonpath='{.users[?(@.name == "e2e")].user.password}'

# get the certificate for the e2e user
kubectl config view --raw -o jsonpath='{.users[?(.name == "e2e")].user.client-certificate-data}' | base64 -d

kubectl config view -o jsonpath='{.users[].name}'    # display the first user
kubectl config view -o jsonpath='{.users[*].name}'   # get a list of users
kubectl config get-contexts                           # display list of contexts
kubectl config get-contexts -o name                   # get all context names
kubectl config current-context                        # display the current-context
kubectl config use-context my-cluster-name            # set the default context to my-cluster-name
kubectl config set-cluster my-cluster-name            # set a cluster entry in kubeconfig
kubectl config set-cluster my-cluster-name --proxy-url=my-proxy-url
kubectl config set-credentials kubeuser/foo.kubernetes.com --username=kubeuser --password=kubepassword
kubectl config set-context --current --namespace=ggckad-s2
kubectl config set-context gce --user=cluster-admin --namespace=foo && kubectl config use-context gce
kubectl config unset users.foo
```

## Kubectl apply

`apply` creates or updates resources from files. It is the recommended workflow for declarative resource management.

## Creating objects

```bash
kubectl apply -f ./my-manifest.yaml
kubectl apply -f ./my1.yaml -f ./my2.yaml
kubectl apply -f ./dir
kubectl apply -f https://example.com/manifest.yaml
kubectl create deployment nginx --image=nginx
kubectl create job hello --image=busybox:1.28 -- echo "Hello World"
kubectl create cronjob hello --image=busybox:1.28 --schedule="*/1 * * * *" -- echo "Hello World"
kubectl explain pods
```

Create multiple objects from stdin:

```yaml
# busybox-sleep-pods.yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox-sleep
spec:
  containers:
    - name: busybox
      image: busybox:1.28
      args:
        - sleep
        - '1000000'
---
apiVersion: v1
kind: Pod
metadata:
  name: busybox-sleep-less
spec:
  containers:
    - name: busybox
      image: busybox:1.28
      args:
        - sleep
        - '1000'
```

```bash
kubectl apply -f busybox-sleep-pods.yaml
```

Create a secret from stdin:

```yaml
# mysecret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mysecret
type: Opaque
data:
  password: $(echo -n "s33msi4" | base64 -w0)
  username: $(echo -n "jane" | base64 -w0)
```

```bash
kubectl apply -f mysecret.yaml
```

## Viewing and finding resources

```bash
kubectl get services
kubectl get pods --all-namespaces
kubectl get pods -o wide
kubectl get deployment my-dep
kubectl get pods
kubectl get pod my-pod -o yaml
kubectl describe nodes my-node
kubectl describe pods my-pod
kubectl get services --sort-by=.metadata.name
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'
kubectl get pv --sort-by=.spec.capacity.storage
kubectl get pods --selector=app=cassandra -o jsonpath='{.items[*].metadata.labels.version}'
kubectl get configmap myconfig -o jsonpath='{.data.ca\.crt}'
kubectl get secret my-secret --template='{{index .data "key-name-with-dashes"}}'
kubectl get node --selector='!node-role.kubernetes.io/control-plane'
kubectl get pods --field-selector=status.phase=Running
kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="ExternalIP")].address}'
kubectl get pods --show-labels
```

More advanced checks:

```bash
JSONPATH='{range .items[*]}{@.metadata.name}:{range @.status.conditions[*]}{@.type}={@.status};{end}{end}' && kubectl get nodes -o jsonpath="$JSONPATH" | grep "Ready=True"
kubectl get node -o custom-columns='NODE_NAME:.metadata.name,STATUS:.status.conditions[?(@.type=="Ready")].status'
kubectl get secret my-secret -o go-template='{{range $k,$v := .data}}{{"### "}}{{$k}}{{"\n"}}{{$v|base64decode}}{{"\n\n"}}{{end}}'
kubectl get pods -o json | jq '.items[].spec.containers[].env[]?.valueFrom.secretKeyRef.name' | grep -v null | sort | uniq
kubectl get pods --all-namespaces -o jsonpath='{range .items[*].status.initContainerStatuses[*]}{.containerID}{"\n"}{end}' | cut -d/ -f3
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl events --types=Warning
kubectl diff -f ./my-manifest.yaml
kubectl get nodes -o json | jq -c 'paths|join(".")'
kubectl get pods -o json | jq -c 'paths|join(".")'
for pod in $(kubectl get po --output=jsonpath={.items..metadata.name}); do echo $pod && kubectl exec -it $pod -- env; done
kubectl get deployment nginx-deployment --subresource=status
```

## Updating resources

```bash
kubectl set image deployment/frontend www=image:v2
kubectl rollout history deployment/frontend
kubectl rollout undo deployment/frontend
kubectl rollout undo deployment/frontend --to-revision=2
kubectl rollout status -w deployment/frontend
kubectl rollout restart deployment/frontend
cat pod.json | kubectl replace -f -
kubectl replace --force -f ./pod.json
kubectl expose rc nginx --port=80 --target-port=8000
kubectl get pod mypod -o yaml | sed 's/\(image: myimage\):.*$/\1:v4/' | kubectl replace -f -
kubectl label pods my-pod new-label=awesome
kubectl label pods my-pod new-label-
kubectl label pods my-pod new-label=new-value --overwrite
kubectl annotate pods my-pod icon-url=http://goo.gl/XXBTWq
kubectl annotate pods my-pod icon-url-
kubectl autoscale deployment foo --min=2 --max=10
```

## Patching resources

```bash
kubectl patch node k8s-node-1 -p '{"spec":{"unschedulable":true}}'
kubectl patch pod valid-pod -p '{"spec":{"containers":[{"name":"kubernetes-serve-hostname","image":"new image"}]}}'
kubectl patch pod valid-pod --type='json' -p='[{"op":"replace","path":"/spec/containers/0/image","value":"new image"}]'
kubectl patch deployment valid-deployment --type json -p='[{"op":"remove","path":"/spec/template/spec/containers/0/livenessProbe"}]'
kubectl patch sa default --type='json' -p='[{"op":"add","path":"/secrets/1","value":{"name":"whatever"}}]'
kubectl patch deployment nginx-deployment --subresource='scale' --type='merge' -p '{"spec":{"replicas":2}}'
```

## Editing resources

```bash
kubectl edit svc/docker-registry
KUBE_EDITOR="nano" kubectl edit svc/docker-registry
```

## Scaling resources

```bash
kubectl scale --replicas=3 rs/foo
kubectl scale --replicas=3 -f foo.yaml
kubectl scale --current-replicas=2 --replicas=3 deployment/mysql
kubectl scale --replicas=5 rc/foo rc/bar rc/baz
```

## Deleting resources

```bash
kubectl delete -f ./pod.json
kubectl delete pod unwanted --now
kubectl delete pod,service baz foo
kubectl delete pods,services -l name=myLabel
kubectl -n my-ns delete pod,svc --all
kubectl get pods -n mynamespace --no-headers=true | awk '/pattern1|pattern2/{print $1}' | xargs kubectl delete -n mynamespace pod
```

## Interacting with running pods

```bash
kubectl logs my-pod
kubectl logs -l name=myLabel
kubectl logs my-pod --previous
kubectl logs my-pod -c my-container
kubectl logs -l name=myLabel -c my-container
kubectl logs my-pod -c my-container --previous
kubectl logs -f my-pod
kubectl logs -f my-pod -c my-container
kubectl logs -f -l name=myLabel --all-containers
kubectl run -i --tty busybox --image=busybox:1.28 -- sh
kubectl run nginx --image=nginx -n mynamespace
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
kubectl attach my-pod -i
kubectl port-forward my-pod 5000:6000
kubectl exec my-pod -- ls /
kubectl exec --stdin --tty my-pod -- /bin/sh
kubectl exec my-pod -c my-container -- ls /
kubectl debug my-pod -it --image=busybox:1.28
kubectl debug node/my-node -it --image=busybox:1.28
kubectl top pod
kubectl top pod POD_NAME --containers
kubectl top pod POD_NAME --sort-by=cpu
```

## Copying files and directories to and from containers

```bash
kubectl cp /tmp/foo_dir my-pod:/tmp/bar_dir
kubectl cp /tmp/foo my-pod:/tmp/bar -c my-container
kubectl cp /tmp/foo my-namespace/my-pod:/tmp/bar
kubectl cp my-namespace/my-pod:/tmp/foo /tmp/bar
```

If `tar` is not present in the container image:

```bash
tar cf - /tmp/foo | kubectl exec -i -n my-namespace my-pod -- tar xf - -C /tmp/bar
kubectl exec -n my-namespace my-pod -- tar cf - /tmp/foo | tar xf - -C /tmp/bar
```

## Interacting with deployments and services

```bash
kubectl logs deploy/my-deployment
kubectl logs deploy/my-deployment -c my-container
kubectl port-forward svc/my-service 5000
kubectl port-forward svc/my-service 5000:my-service-port
kubectl port-forward deploy/my-deployment 5000:6000
kubectl exec deploy/my-deployment -- ls
```

## Interacting with nodes and cluster

```bash
kubectl cordon my-node
kubectl drain my-node
kubectl uncordon my-node
kubectl top node
kubectl top node my-node
kubectl cluster-info
kubectl cluster-info dump
kubectl cluster-info dump --output-directory=/path/to/cluster-state
kubectl get nodes -o='custom-columns=NodeName:.metadata.name,TaintKey:.spec.taints[*].key,TaintValue:.spec.taints[*].value,TaintEffect:.spec.taints[*].effect'
kubectl taint nodes foo dedicated=special-user:NoSchedule
```

### Resource types

```bash
kubectl api-resources
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
kubectl api-resources -o name
kubectl api-resources -o wide
kubectl api-resources --verbs=list,get
kubectl api-resources --api-group=extensions
```

### Formatting output

| Output format                       | Description                            |
| ----------------------------------- | -------------------------------------- |
| `-o=custom-columns=<spec>`          | Print table using custom columns       |
| `-o=custom-columns-file=<filename>` | Print table from custom columns file   |
| `-o=go-template=<template>`         | Print fields from golang template      |
| `-o=go-template-file=<filename>`    | Print fields from golang template file |
| `-o=json`                           | Output JSON API object                 |
| `-o=jsonpath=<template>`            | Print fields from jsonpath expression  |
| `-o=jsonpath-file=<filename>`       | Print fields from jsonpath file        |
| `-o=kyaml`                          | Output KYAML API object                |
| `-o=name`                           | Print resource name only               |
| `-o=wide`                           | Output in extended table format        |
| `-o=yaml`                           | Output YAML API object                 |

Examples:

```bash
kubectl get pods -A -o=custom-columns='DATA:spec.containers[*].image'
kubectl get pods --namespace default --output=custom-columns="NAME:.metadata.name,IMAGE:.spec.containers[*].image"
kubectl get pods -A -o=custom-columns='DATA:spec.containers[?(@.image!="registry.k8s.io/coredns:1.6.2")].image'
kubectl get pods -A -o=custom-columns='DATA:metadata.*'
```

### Kubectl output verbosity and debugging

| Verbosity | Description                          |
| --------- | ------------------------------------ |
| `--v=0`   | Always-visible operator information  |
| `--v=1`   | Reasonable default log level         |
| `--v=2`   | Recommended default for most systems |
| `--v=3`   | Extended information about changes   |
| `--v=4`   | Debug level verbosity                |
| `--v=5`   | Trace level verbosity                |
| `--v=6`   | Display requested resources          |
| `--v=7`   | Display HTTP request headers         |
| `--v=8`   | Display HTTP request contents        |
| `--v=9`   | Display full HTTP request contents   |
