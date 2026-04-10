---
seoTitle: Kubernetes Certifications, KCNA, CKAD, and CKA Overview
seoDescription: Understand the KCNA, CKAD, and CKA Kubernetes certifications, their format and focus, and how the Common Core course builds the foundation for all three.
---

# Overview of Kubernetes Certifications

Picture two engineers applying for the same platform role. One lists three years of Kubernetes experience on their resume. The other holds a CKA certificate dated last month. The hiring manager can verify the second claim in seconds. Certifications give employers and engineers a shared, verifiable benchmark, and in the Kubernetes ecosystem, the CNCF certifications are the ones that matter.

This lesson introduces the three most relevant: KCNA, CKAD, and CKA, and shows how the Common Core course builds the foundation for all three.

## KCNA: Kubernetes and Cloud Native Associate

The KCNA is the entry point. Unlike the other two certifications, it is a multiple-choice exam, not a hands-on one. It tests conceptual understanding: what things are, why they exist, and how they fit together in the cloud-native ecosystem. Topics include container fundamentals, Kubernetes architecture, the CNCF landscape, and core objects like Pods, Deployments, and Services. The exam runs 90 minutes and contains around 60 questions.

It is a good first step if you are new to Kubernetes and want a confidence anchor before tackling the hands-on exams.

:::quiz
A colleague says the KCNA is easier than CKAD because you can look things up during the exam. Is that accurate?

**Answer:** No. The KCNA is a closed-book multiple-choice exam. CKAD and CKA are the open-book ones, though time pressure makes that advantage smaller than it sounds.
:::

## CKAD: Certified Kubernetes Application Developer

The CKAD shifts from theory to practice. You spend two hours on a real cluster completing tasks from an application developer's perspective: writing Pod specs, configuring Deployments, exposing applications with Services, wiring environment variables from ConfigMaps and Secrets, and running batch Jobs. There are no multiple-choice questions, only tasks with a pass or fail outcome.

If your work involves deploying or maintaining software on Kubernetes, the CKAD is the most directly relevant certification. Fluency with `kubectl` is the main bottleneck for most candidates, which is exactly why this course focuses on hands-on terminal practice.

## CKA: Certified Kubernetes Administrator

The CKA has the same format as the CKAD (two hours, real cluster, task-based), but focuses on the infrastructure layer rather than the application layer. You work on cluster-level concerns: managing nodes, configuring network policies and RBAC, backing up etcd, troubleshooting cluster failures, and setting up persistent storage. It targets platform engineers and SREs responsible for keeping clusters healthy in production, not just deploying applications onto them.

The CKA is widely considered one of the more demanding certifications in the cloud-native space, both because of the topic breadth and the time pressure.

:::warning
CKAD and CKA are open-book: you can access the official Kubernetes documentation during the exam. That helps, but finding the right page under time pressure requires practice. Knowing the documentation layout matters as much as knowing the content.
:::

:::quiz
You are a backend developer who wants to validate Kubernetes skills for deploying containerized applications. Which certification fits best?

- KCNA, because it covers container fundamentals and Kubernetes architecture
- CKA, because it is the most recognized certification in the ecosystem
- CKAD, because it tests hands-on application deployment tasks directly

**Answer:** CKAD. Its tasks map directly to application developer work: Pods, Deployments, Services, ConfigMaps. KCNA tests conceptual knowledge only. CKA focuses on cluster administration, not application deployment.
:::

## How This Common Core Fits In

All three certifications share a foundation. You need to understand what Kubernetes is, how its architecture works, and what problems it solves. That foundation is what this Common Core course covers.

@@@
graph TD
    CC["Common Core Course<br/>(this course)"]
    CC --> KCNA["KCNA<br/>Multiple choice, Theory, Entry level"]
    CC --> CKAD["CKAD<br/>Hands-on, 2h, App-focused"]
    CC --> CKA["CKA<br/>Hands-on, 2h, Cluster-focused"]
@@@

Whatever certification you are aiming for, the concepts you build here apply directly. Next, the substance begins: what Kubernetes is and the problem it was built to solve.
