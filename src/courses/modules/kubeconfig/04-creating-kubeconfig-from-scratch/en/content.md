---
seoTitle: 'Create Kubeconfig from Scratch, kubectl config set-cluster set-credentials set-context'
seoDescription: 'Learn how to build a kubeconfig file entry by entry using kubectl config set-cluster, set-credentials, set-context, and use-context commands.'
---

# Creating a Kubeconfig from Scratch

A new cluster admin hands you three files: a CA certificate, a client certificate, and a private key. They tell you the API server address. Your task is to configure kubectl so you can start running commands. There is no wizard, no GUI. You build the kubeconfig entry by entry using four `kubectl config set-*` commands.

The workflow has a fixed order. Each step registers one piece of the kubeconfig, and they accumulate until the full configuration is in place.

@@@
sequenceDiagram
  participant You
  participant kubeconfig as ~/.kube/config
  You->>kubeconfig: set-cluster (server URL + CA cert)
  You->>kubeconfig: set-credentials (client cert + key)
  You->>kubeconfig: set-context (bind cluster + user)
  You->>kubeconfig: use-context (activate it)
@@@

## Step 1: Register the cluster

The first command tells kubectl where the cluster lives and how to trust its TLS certificate:

```bash
kubectl config set-cluster my-cluster --server=https://192.168.1.100:6443 --certificate-authority=/etc/kubernetes/pki/ca.crt
```

This writes a new entry into the `clusters` section of `~/.kube/config`. The `--server` flag sets the API server URL. The `--certificate-authority` flag points to the CA certificate file that kubectl will use to verify the server's TLS certificate. Without it, kubectl either rejects the connection or falls back to an insecure mode.

:::info
In the simulator, the kubeconfig is pre-configured and the certificate files shown in these examples do not exist on disk. These commands are shown as a conceptual reference for what you would run against a real cluster. In the simulator, run `kubectl config view` to see the kubeconfig that is already in place.
:::

You can confirm the cluster was registered:

```bash
kubectl config get-clusters
```

The new cluster name `my-cluster` should appear in the list.

## Step 2: Register the user credentials

The second command registers your identity, the client certificate and the corresponding private key:

```bash
kubectl config set-credentials my-user --client-certificate=/etc/kubernetes/pki/admin.crt --client-key=/etc/kubernetes/pki/admin.key
```

This writes a new entry into the `users` section. The `--client-certificate` file contains your certificate (the one signed by the cluster's CA), and `--client-key` is the private key that proves you hold that certificate. The API server uses your certificate's common name (CN) to look up your identity in its access control system.

:::quiz
You run `kubectl config set-credentials my-user --client-certificate=...` but later realize you want to rename the user label from `my-user` to `admin`. Does this change your permissions in the cluster?

**Answer:** No. The label in kubeconfig is local bookkeeping. The API server reads the certificate itself to determine your identity, specifically the CN field in the certificate. Renaming the kubeconfig label has no effect on what you are allowed to do. Permissions belong to RBAC, which is a separate module.
:::

## Step 3: Bind cluster and user into a context

With a cluster entry and a user entry registered, the third command creates a context that connects them:

```bash
kubectl config set-context my-context --cluster=my-cluster --user=my-user
```

This writes a new entry into the `contexts` section. You can optionally add `--namespace=<ns>` to set a default namespace for this context. Without it, kubectl defaults to the `default` namespace whenever you do not specify `-n`.

A common mistake at this step is a typo: the `--cluster` and `--user` values must exactly match the names used in the previous two commands. If they do not match, the context is created but kubectl will fail to resolve the cluster or user entry when you try to use it.

:::warning
`kubectl config set-context` does not validate that the cluster and user names exist. You will get no error at creation time. The failure only appears when you try to run a command using that context and kubectl cannot resolve the references.
:::

## Step 4: Activate the context

The fourth command sets the new context as active:

```bash
kubectl config use-context my-context
```

Output:

```
Switched to context "my-context".
```

Now every kubectl command targets `my-cluster` using the `my-user` credentials, until you switch context again.

## Verifying the result

After all four steps, confirm the full configuration:

```bash
kubectl config view
```

You should see your new `clusters`, `users`, and `contexts` entries, and `current-context` set to `my-context`. If anything is missing or misspelled, re-run the relevant `set-*` command with the corrected values. Subsequent runs overwrite the existing entry, they do not create duplicates.

@@@
graph TB
  SC["set-cluster\nmy-cluster"]
  SCRED["set-credentials\nmy-user"]
  SCTX["set-context\nmy-context\n(cluster=my-cluster, user=my-user)"]
  UC["use-context\nmy-context"]
  VIEW["kubectl config view\n(confirm result)"]
  SC --> SCTX
  SCRED --> SCTX
  SCTX --> UC
  UC --> VIEW
@@@

## The KUBECONFIG environment variable

By default kubectl reads a single file at `~/.kube/config`. The `KUBECONFIG` environment variable lets you point kubectl at a different file or at multiple files at once. When you list multiple paths separated by colons, kubectl merges them in memory and treats them as one unified kubeconfig.

```bash
kubectl config view
```

In a shell where `KUBECONFIG=/home/alice/.kube/config:/home/alice/.kube/work-config`, this command shows the merged result of both files. This pattern is useful when different tools or clusters manage their own kubeconfig files separately. It is an advanced topic and the simulator does not require it, but you will encounter it in real multi-cluster setups.

You now know how to configure kubectl from scratch, from a CA certificate and a set of credentials down to a working context. The building blocks, `set-cluster`, `set-credentials`, `set-context`, and `use-context`, are also what tools like `kubeadm` call internally when they set up a cluster for the first time. The TLS certificates module covers the certificate files themselves: how they are generated, signed, and why the CA relationship matters.
