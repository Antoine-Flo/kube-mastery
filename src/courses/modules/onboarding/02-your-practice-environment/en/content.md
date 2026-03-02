# Your Practice Environment

## What You Have Access To

The terminal gives you two things: an emulated Kubernetes cluster and a virtual Linux filesystem. You can create files, write YAML manifests, and apply them to the cluster with `kubectl`, just like you would on a real machine.

Here are the commands available:

| Category | Commands |
|---|---|
| Navigation | `pwd`, `ls`, `cd`, `mkdir` |
| File operations | `cat`, `touch`, `rm`, `nano` |
| Kubernetes | `kubectl` and all its subcommands |

`kubectl` is your main tool throughout this course. Think of it as the remote control for your cluster.

## Mistakes Are Free

If you break something or want to start fresh, just reload the page. The cluster resets to its initial state in a few seconds. Use that freedom deliberately: change values, apply broken manifests, delete things and watch what happens. Every failure is feedback, and nothing here has consequences.

:::warning
Reloading discards any files you created in the terminal. If you wrote a manifest you want to keep, copy it somewhere before reloading.
:::

## Limitations

Not every Kubernetes feature is available here. You can find the available features in the [supported features page](https://kubemastery.com/en/supported). When a lesson touches something unavailable, we'll say so explicitly.

## Hands-On

Let's try the filesystem. Run these commands one by one:

```bash
touch test.txt
ls
nano test.txt
```

Write anything in the editor, then save and exit with `Ctrl + S`. Finally, display the content:

```bash
cat test.txt
```

Note that `nano` can create and edit a file in one step, no need for `touch` first. Ready to go! In the next lesson, we'll look at the Kubernetes certifications so you understand where this Common Core fits into the bigger picture.
