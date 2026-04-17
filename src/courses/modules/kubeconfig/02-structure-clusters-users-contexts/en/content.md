---
seoTitle: 'Kubeconfig Structure, Clusters Users Contexts, kubectl Configuration Sections'
seoDescription: 'Understand the three sections of a kubeconfig file: clusters, users, and contexts, and how a context binds them into a single named configuration.'
---

# Clusters, Users, and Contexts

A kubeconfig file is not a flat list of key-value pairs. It has three independent sections, and none of them mean anything on their own. A `clusters` entry without a matching `contexts` entry is an unused address. A `users` entry without a context pointing to it is a forgotten credential. The **context** is the glue: it binds one cluster and one user together under a single name, and that is the name kubectl uses.

Start by looking at the full file in the simulator:

```bash
kubectl config view
```

You will see a YAML document. Read through it with the following three sections in mind.

## The clusters section

The `clusters` section is a list. Each entry has a `name` and a `cluster` block. The `cluster` block holds two things: the API server address (`server`) and the certificate authority data (`certificate-authority-data`).

```yaml
# illustrative only
clusters:
  - name: production
    cluster:
      server: https://k8s.example.com:6443
      certificate-authority-data: <base64-ca>
```

The `server` field is the URL kubectl sends API requests to. The `certificate-authority-data` is a base64-encoded CA certificate. kubectl uses it to verify that the server it is talking to is actually the cluster it claims to be, not an impostor. This is standard TLS verification. The details of how that certificate is issued belong to the TLS module, but the important point here is: without a valid CA cert, kubectl refuses to connect.

```bash
kubectl config get-clusters
```

This command lists only the cluster names registered in your kubeconfig, one per line. It is a fast way to confirm which clusters kubectl knows about.

## The users section

The `users` section is also a list. Each entry has a `name` and a `user` block that holds credentials. The credential format depends on the authentication method: client certificate and key, a bearer token, or an OIDC configuration. The details of authentication methods belong to the authentication module. For now, the important idea is that the `user` block answers the question "who are you?" when kubectl reaches the API server.

```yaml
# illustrative only
users:
  - name: alice
    user:
      client-certificate-data: <base64-cert>
      client-key-data: <base64-key>
```

@@@
graph TB
  subgraph kubeconfig ["kubeconfig file"]
    CL["clusters\n[ production, staging ]"]
    US["users\n[ alice, ci-bot ]"]
    CT["contexts\n[ prod-alice, staging-ci ]"]
  end
  CT -->|"references"| CL
  CT -->|"references"| US
  AC["current-context: prod-alice"]
  AC --> CT
@@@

The user entry name (`alice` in the example) is just a label. It does not have to match a real username in the cluster. The API server uses the credential itself (the certificate common name or the token subject) to identify you, not the label in the kubeconfig. This is a common source of confusion: renaming the user entry in kubeconfig does not change your identity in the cluster.

:::quiz
A colleague says "I renamed my user entry from `alice` to `developer` in kubeconfig. Now I have fewer permissions." Is that possible?

**Answer:** No. Renaming the kubeconfig label has no effect on cluster permissions. The API server reads the credential itself (the certificate CN or the token's subject claim) to determine identity. The label in kubeconfig is local bookkeeping only. Permissions are controlled by RBAC, which is covered in the RBAC module.
:::

## The contexts section

The `contexts` section is the binding layer. Each entry has a `name` and a `context` block that references a cluster by name and a user by name. It can optionally include a `namespace` field.

```yaml
# illustrative only
contexts:
  - name: prod-alice
    context:
      cluster: production
      user: alice
      namespace: payments
```

When `namespace` is set, every kubectl command that does not specify `-n` will query that namespace by default. Without it, kubectl defaults to the `default` namespace.

The `current-context` field at the top level of the kubeconfig file holds the name of the active context. It is a single string, not a list.

```bash
kubectl config get-contexts
```

This prints a table of all contexts. The row with an asterisk (`*`) in the leftmost column is the active context. The columns show the context name, the cluster it points to, the user it uses, and the default namespace (if any).

:::info
A kubeconfig can list dozens of contexts but only one is active at any moment. Switching contexts changes only the `current-context` field in the file. Everything else stays untouched.
:::

:::quiz
What are the three things a context entry contains?

- A list of namespaces, a list of roles, and a cluster address
- A cluster reference, a user reference, and an optional default namespace
- A server URL, a token, and a context name

**Answer:** A cluster reference, a user reference, and an optional default namespace. The cluster and user entries hold the actual addresses and credentials. The context just names the combination and optionally pins a default namespace.
:::

## Putting it together

The three sections form a deliberate separation of concerns. Cluster addresses are defined once and can be referenced by multiple contexts. User credentials are defined once and can be reused across contexts. A context is lightweight: it is just two names and an optional namespace string. This means you can define one `alice` user entry and create five contexts that all use it, each pointing to a different cluster, without duplicating the credential.

Verify what the simulator's current context sees by combining two commands:

```bash
kubectl config current-context
```

Then inspect the full detail of the active configuration:

```bash
kubectl config view
```

Now that you understand what each section does, the next lesson shows how to switch between contexts and manage the active namespace, which is the day-to-day workflow when working with multiple simulated clusters.
