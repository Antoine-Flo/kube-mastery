---
seoTitle: 'Kubernetes Kubeconfig File, kubectl Configuration, Clusters and Contexts'
seoDescription: 'Learn what a kubeconfig file is, how kubectl reads it to find your cluster and credentials, and why it is the entry point for every kubectl command.'
---

# What Is a Kubeconfig File

You open a terminal, type `kubectl get pods`, and it works. The simulator responds with a list of running pods. But think about what just happened: kubectl had to know _where_ to send that request, and _who_ you are. It did not ask you. It already knew. The answer comes from a file called the **kubeconfig file**.

## The file kubectl reads before everything else

Before executing any command, kubectl reads a configuration file. By default that file is `~/.kube/config`. It is a plain YAML file that answers three questions: which cluster to connect to, who you are, and which context is currently active.

Run this command in the simulator to see the full content of the kubeconfig:

```bash
kubectl config view
```

The output looks like a YAML document with three top-level sections. Do not worry about parsing all of it yet. The important thing is that every `kubectl` command you run, from `kubectl get pods` to `kubectl delete deployment`, begins by reading this file.

@@@
graph LR
  KF["~/.kube/config\n(kubeconfig)"]
  CL["clusters\n(server URLs)"]
  US["users\n(credentials)"]
  CT["contexts\n(named bindings)"]
  KC["kubectl command"]
  KF --> CL
  KF --> US
  KF --> CT
  CT --> KC
@@@

The three sections work together. The `clusters` section holds server addresses. The `users` section holds credentials. The `contexts` section ties one cluster to one user under a single name. When you run a `kubectl` command, it reads the active context, picks the matching cluster and user from the other two sections, and builds the API request.

## One file, three responsibilities

Think of kubeconfig as an address book combined with an ID wallet. The address book tells kubectl where the cluster lives (a URL, a port, a TLS certificate). The ID wallet tells kubectl who you are (a client certificate, a token, or an OIDC config). The context is the bookmark that says "right now, use this address and this identity."

You can check which context is currently active with a shorter command:

```bash
kubectl config current-context
```

This prints a single name. That name is the context that kubectl will use for every subsequent command unless you tell it otherwise.

:::info
The default kubeconfig path `~/.kube/config` can be overridden with the `KUBECONFIG` environment variable. You can also pass `--kubeconfig=/path/to/file` on any individual command. The simulator uses a pre-configured kubeconfig so you can run commands immediately.
:::

## What happens without a kubeconfig

If the kubeconfig file is missing, corrupted, or points to a cluster that does not exist, every kubectl command fails before it even tries to reach a server. The error looks like this:

```bash
kubectl get pods
```

Output if the config is broken:

```
The connection to the server localhost:8080 was refused - did you specify the right host or port?
```

That error almost always means kubectl fell back to a default of `localhost:8080` because it could not find a valid cluster entry. It is one of the most common errors beginners encounter. The fix is always the same: check the kubeconfig.

:::warning
A kubeconfig file contains credentials: private keys, tokens, or certificate data. These are secrets. Never commit a kubeconfig file to a git repository. If you do, rotate the credentials immediately. Treat kubeconfig files with the same care as passwords.
:::

:::quiz
When you run `kubectl get pods` and get a connection refused error pointing to `localhost:8080`, what is the most likely cause?

**Answer:** kubectl could not find a valid cluster entry in the kubeconfig. It fell back to the default of `localhost:8080`. The fix is to verify the kubeconfig file exists at `~/.kube/config` and contains a valid cluster entry, or to set the `KUBECONFIG` environment variable to the correct file path.
:::

## The kubeconfig is not a lock-in

One of the elegant things about this design is that the kubeconfig is just a file. You can have multiple kubeconfig files, you can merge them, you can switch between them. Adding a new cluster does not require reinstalling kubectl or changing anything in the cluster itself. You update one YAML file on your local machine and you are done.

The next lesson breaks down the exact structure of each of the three sections, so you understand precisely what `kubectl config view` is showing you.
