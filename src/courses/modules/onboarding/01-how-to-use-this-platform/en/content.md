---
seoTitle: KubeMastery, Navigate the Terminal and Cluster Interface
seoDescription: Learn how to use the KubeMastery platform, including the terminal panel, cluster visualizer, reset button, and how to navigate course lessons.
---

# Welcome 👋

<!-- <img class="meme" src="https://i.imgflip.com/amuq3d.jpg" title="made at imgflip.com"/> -->

Welcome and thank you for using KubeMastery. If anything doesn't work as expected, please let us know.

:::info
On mobile, not every keyboard works well with the terminal. <a href="https://play.google.com/store/apps/details?id=com.google.android.inputmethod.latin&hl=en" target="_blank">**Gboard**</a> works reliably if you need to practice on the go.
:::

## Hands-On Practice

Every lesson on KubeMastery follows the same structure: theory first, then a hands-on practice section where you apply what you just learned in the terminal. Before diving into the theory, here's a quick demo of what that looks like in practice. You'll write a Deployment manifest, apply it, and watch the Pods appear live in the cluster visualizer.

**1. Copy and paste the command below into the terminal:**

```bash
nano deployment.yaml
```

**2. Copy and paste the following manifest into the editor:**

```yaml
#deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
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
```

Press **Ctrl+S** to save and close the editor.

**3. Type the apply command, then open the visualizer before pressing Enter:**

```bash
kubectl apply -f deployment.yaml
```

Click the telescope icon below the terminal to open the visualizer, then come back to the terminal and press **Enter**. Watch the three nginx Pods appear and transition to `Running` in real time. Hover any Pod to inspect its details.

You should see in the terminal: `deployment.apps/nginx created`.

**4. Reset the cluster:**

Click the reload icon below the terminal to wipe everything and start fresh.

You're ready to begin the course.
