# Welcome 👋

<!-- <img class="meme" src="https://i.imgflip.com/amuq3d.jpg" title="made at imgflip.com"/> -->

Welcome and thank you so much for using KubeMastery. If anything is not working as expected, please let us know. You don't have to create an account to use the platform, but you can do so to if you want to track your progress.

## Navigating the Interface

The screen is split into two panels. The **central panel** is where you are right now, displaying lessons in order and the course outline, on the bottom left of your screen you'll find a button to collapse the outline.

The **right panel** is a terminal connected to a simulated Kubernetes cluster. Below the terminal you'll find a few icons:

- The **telescope icon** opens the cluster visualizer, a live diagram that shows your nodes, Pods, and containers updating in real time. It's a great way to see the effect of your commands visually, for example watching three Pods appear the moment you create a Deployment. You can hover the visualizer to see the details of the objects.
- The **reload icon** resets the terminal and the cluster to their initial state: it clears the terminal output and recreates the environment from scratch. Use it when you want to start over or when something gets stuck.
- The **speech bubble icon** lets you send feedback or report anything that seems off in a lesson.

:::info
On mobile, not every keyboard works well with the terminal. <a href="https://play.google.com/store/apps/details?id=com.google.android.inputmethod.latin&hl=en" target="_blank">**Gboard**</a> works reliably if you need to practice on the go.
:::

## Hands-On Practice

Let's confirm your terminal is working. Run:

```bash
kubectl version
```

You should see the client and server versions of Kubernetes. If both are displayed, your environment is healthy and you're ready to start.
