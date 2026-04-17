---
seoTitle: 'Kubernetes Authentication Methods, Certificates, Tokens, OIDC'
seoDescription: 'Understand how Kubernetes authenticates identities: X.509 client certificates, bearer tokens, OIDC, and why Kubernetes has no built-in user management.'
---

# How Kubernetes Authenticates Identities

You type `kubectl get pods` and the API server responds. But before it returns anything, it has already asked a question you never see: who are you? Your `kubectl` client sent credentials alongside the request. The API server verified them. Only then did it evaluate whether your identity is allowed to list Pods.

How exactly does that verification work? Kubernetes supports several authentication methods, and understanding them is essential to troubleshoot access problems and reason about cluster security.

## kubeconfig carries your identity

Start by looking at what your client is actually sending:

```bash
kubectl config view
```

```bash
kubectl config current-context
```

The `current-context` links a cluster, a user, and a namespace together. The `users` section of the kubeconfig holds the credentials your client presents on every request. Those credentials may be a certificate, a token, or a pointer to an external authenticator.

:::info
The kubeconfig file structure, including how contexts, clusters, and users are composed and how to merge multiple files, is covered in the kubeconfig module. Here the focus is on what credentials types exist and what the API server does with them.
:::

## X.509 client certificates

The primary authentication method in Kubernetes is mutual TLS using X.509 client certificates. When you run `kubectl`, the client presents a certificate. The API server verifies that certificate against its own Certificate Authority (CA). If the cert was signed by a trusted CA and has not expired, the identity embedded in it is accepted.

@@@
graph LR
    Kubectl["kubectl\n(client cert)"]
    APIServer["kube-apiserver"]
    CA["Cluster CA\n(trusted anchor)"]

    Kubectl -- "TLS: presents cert" --> APIServer
    APIServer -- "verifies against" --> CA
    CA -- "signed by" --> Kubectl
@@@

The identity comes from the certificate fields. The `CN` (Common Name) field becomes the username. The `O` (Organization) fields become the groups. If your cert has `CN=jane` and `O=dev-team`, the API server treats you as user `jane` in group `dev-team`. That username and group are what RBAC evaluates.

:::quiz
What does the API server use to determine the username from an X.509 client certificate?

- The filename of the certificate
- The Common Name (CN) field of the certificate
- The Subject Alternative Name (SAN) of the certificate

**Answer:** The Common Name (CN) field. The `O` (Organization) fields map to groups. RBAC then uses these values to evaluate permissions. There is no other place where the username lives inside a certificate.
:::

## Bearer tokens: ServiceAccount JWTs

Pods authenticate to the API server using bearer tokens, not certificates. That token is a signed JWT (JSON Web Token) bound to a ServiceAccount. The API server verifies the signature and extracts the ServiceAccount identity from the token's claims.

This is how in-cluster automation works. Any workload that needs to call the Kubernetes API, a controller, a monitoring agent, a custom operator, authenticates as a ServiceAccount using this mechanism. The token is automatically available to the Pod at runtime. How exactly Kubernetes injects that token and how to control that behavior is covered in the service-accounts module.

:::quiz
A developer is setting up `kubectl` access for a new team member. A monitoring controller running in a Pod needs to call the API. Which authentication method is appropriate for each?

- Developer: X.509 client certificate. Controller: X.509 client certificate.
- Developer: X.509 client certificate. Controller: ServiceAccount JWT bearer token.
- Developer: ServiceAccount JWT bearer token. Controller: ServiceAccount JWT bearer token.

**Answer:** Developer: X.509 client certificate (or OIDC). Controller: ServiceAccount JWT bearer token. Certificates are the right mechanism for humans connecting with `kubectl`. ServiceAccount tokens are for workloads running inside the cluster. The two mechanisms exist separately because their lifecycle management requirements are entirely different.
:::

## OIDC tokens: external identity providers

OpenID Connect (OIDC) lets you connect an external identity provider, such as Google Workspace, GitHub, or Okta, to the Kubernetes API server. The user authenticates with the external provider, receives a JWT, and presents that token to the API server. The API server validates the token against the provider's public keys.

@@@
graph LR
    User["User"]
    IdP["External IdP\n(Google / GitHub / Okta)"]
    APIServer["kube-apiserver"]

    User -- "login" --> IdP
    IdP -- "OIDC JWT" --> User
    User -- "presents token" --> APIServer
    APIServer -- "validates JWT" --> IdP
@@@

OIDC is the right choice for large teams where identities already live in a corporate directory. The API server is configured with the issuer URL and the API server fetches public keys to verify tokens. This is external infrastructure, so the simulator does not simulate OIDC flows. Understanding the model is enough for the exam.

## Static token files: legacy, avoid

The API server can be started with a `--token-auth-file` flag pointing to a CSV file of tokens. This method is static, has no expiry mechanism, and requires an API server restart to update. It is considered a legacy approach and is never recommended for new clusters. Know it exists for the exam, but do not use it in practice.

## Kubernetes has no built-in user management

This is one of the most important facts about Kubernetes authentication: there is no `kubectl create user` command. Users do not exist as Kubernetes objects. You cannot list them. You cannot store them in etcd. They exist only as identities embedded in external credentials, inside a cert's CN field, inside a JWT claim, or inside an IdP's directory.

:::warning
If you try to run `kubectl create user jane`, you get an error. Kubernetes has no User resource. A "user" in Kubernetes is just a name the API server extracts from a valid credential. When the credential expires or is revoked, the user effectively disappears. This is intentional: Kubernetes delegates identity management to external systems.
:::

Why did Kubernetes take this approach? Managing user identities is a solved problem. X.509 PKI, OIDC, and LDAP are mature, auditable systems. Building a parallel user store inside Kubernetes would duplicate that complexity and create a new attack surface. Instead, Kubernetes trusts the identity claim from a verified credential and focuses on what it does best: evaluating permissions and scheduling workloads.

:::quiz
Your cluster uses X.509 client certificates for authentication. A user reports that `kubectl get pods` suddenly returns `401 Unauthorized` after working fine for months. What is the most likely cause?

**Answer:** The client certificate has expired. X.509 certificates have a `Not After` date. Once that date passes, the API server rejects the certificate even though it was issued by a trusted CA. The fix is to issue a new certificate and update the kubeconfig. This is one of the main operational reasons to monitor certificate expiry proactively.
:::

## What a failed authentication looks like

Try to understand what happens when credentials are invalid. In a real cluster, if your certificate is expired or signed by an untrusted CA, the API server returns:

```
Error from server (Forbidden): the server does not allow this method on the requested resource
```

or more precisely, a `401 Unauthorized` at the HTTP level. The `kubectl` client may surface this as a connection refused or a TLS handshake error depending on whether the cert fails at the transport layer or the application layer.

In the simulator, authentication is abstracted: the simulated API server trusts the configured session context. But the model is the same: the gate either passes or rejects, and a `401` means the identity could not be established.

The next lesson covers the distinction between human users and ServiceAccounts in depth, including how ServiceAccounts are created, how they are bound to Pods, and what the `default` ServiceAccount implies for workloads you deploy without thinking about security.
