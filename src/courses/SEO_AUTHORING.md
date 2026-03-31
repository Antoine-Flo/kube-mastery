# Lesson SEO authoring

Use optional frontmatter fields at the top of each lesson `content.md` file:

```yaml
---
seoTitle: Create a Kubernetes ReplicaSet, manifest, selector, and verification
seoDescription: Learn how to create a ReplicaSet in Kubernetes, validate selector and template labels, and verify desired, current, and ready pods with kubectl.
ogImage: /og/lessons/replicaset-create.png
twitterImage: /og/lessons/replicaset-create.png
---
```

## Writing guidelines

- `seoTitle`: keep it specific to the lesson topic and search intent.
- `seoDescription`: target clear value in one sentence, ideally 140-160 characters.
- `ogImage`: optional, use a page specific image when available.
- `twitterImage`: optional, defaults to `ogImage` when omitted.

If a field is missing, runtime fallback values are applied automatically.
