# What is a ConfigMap?

A ConfigMap is an API object that lets you store configuration for other objects to use.

## Motivation

Use a ConfigMap for setting configuration data separately from application code. For example, you might have an application that looks for a `DATABASE_HOST` environment variable. Locally, you set it to `localhost`. In the cloud, you set it to refer to a Kubernetes Service.

This lets you use the same container image in different environments by changing the configuration, not the code.

## ConfigMap Structure

Unlike most Kubernetes objects that have a `spec`, a ConfigMap has `data` and `binaryData` fields. These fields accept key-value pairs:
- **data**: Designed to contain UTF-8 strings
- **binaryData**: Designed to contain binary data as base64-encoded strings

## Important Note

ConfigMap does not provide secrecy or encryption. If the data you want to store are confidential, use a Secret rather than a ConfigMap.

:::warning
ConfigMaps are not encrypted and should not contain sensitive data like passwords, API keys, or tokens. Use Secrets for confidential information instead.
:::
