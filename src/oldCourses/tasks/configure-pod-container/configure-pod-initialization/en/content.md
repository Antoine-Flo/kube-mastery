---
description: 'Use an Init Container to prepare a Pod before the main container runs.'
---

# Configure Pod Initialization

This page shows how to use an **Init Container** to initialize a Pod before the main application container runs.

## Before you begin

You need a Kubernetes cluster and `kubectl` configured. In this environment, use the terminal on the right.

## Create a Pod with an Init Container

Create a Pod that has one application container (nginx) and one **init container**. The init container runs to completion before the application container starts.

### Step 1: Create the manifest file

Create a directory and a file for the Pod manifest:

```bash
mkdir -p ~/workdir
touch ~/workdir/init-demo.yaml
```

### Step 2: Write the Pod manifest

Open the file with `nano` or `vim` and paste the following YAML. The Pod uses a shared **volume** (`workdir`). The init container mounts it at `/work-dir` and writes `index.html`; the nginx container mounts the same volume at `/usr/share/nginx/html`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-demo
spec:
  containers:
    - name: nginx
      image: nginx
      ports:
        - containerPort: 80
      volumeMounts:
        - name: workdir
          mountPath: /usr/share/nginx/html
  initContainers:
    - name: install
      image: busybox:1.28
      command:
        - wget
        - '-O'
        - '/work-dir/index.html'
        - http://info.cern.ch
      volumeMounts:
        - name: workdir
          mountPath: '/work-dir'
  volumes:
    - name: workdir
      emptyDir: {}
```

### Step 3: Apply the manifest

From the directory containing `init-demo.yaml`:

```bash
kubectl apply -f init-demo.yaml
```

You should see: `pod/init-demo created`.

### Step 4: Verify the Pod

Check that the Pod is running:

```bash
kubectl get pod init-demo
```

Once the status is `Running`, the init container has completed and nginx is serving.

## What's next

- Learn more about Init Containers and Pod lifecycle.
- Try other tasks in this group.
