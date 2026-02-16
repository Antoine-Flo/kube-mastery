# Long-Form Lesson Template (EN)

Use this template when creating or rewriting `en/content.md` lessons.

## Target

- Target length: 70-120 lines
- Single core concept per lesson
- Practical depth over marketing text

## Template

```markdown
# Lesson Title

Short context (3-6 lines): what problem this solves and why it matters in Kubernetes operations.

## Core Concept

Define the object/feature and explain the role in the Kubernetes model.

## How it Works

Explain behavior, reconciliation flow, and what the control plane does.

```yaml
apiVersion: v1
kind: Example
metadata:
  name: sample
spec:
  key: value
```

## Hands-on Workflow

Use short commands learners can run and verify.

```bash
kubectl apply -f sample.yaml
kubectl get example sample -o yaml
kubectl describe example sample
```

:::info
Add one practical guideline that helps avoid common confusion.
:::

## Common Pitfalls

- Pitfall 1 and why it happens
- Pitfall 2 and how to fix it
- Pitfall 3 and how to prevent it

:::warning
Highlight one production-grade mistake and mitigation.
:::

## Quick Recap

- Key point 1
- Key point 2
- Key point 3
```

## Quality Checklist

- H1 present as first line
- 3 to 5 `##` sections
- At least one callout (`:::info` / `:::warning` / `:::important`)
- At least two code blocks (`bash` and/or `yaml`)
- Vocabulary remains consistent with surrounding lessons
- Quiz in `en/quiz.ts` remains multiple-choice only
