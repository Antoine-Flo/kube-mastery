---
seoTitle: KubeMastery Practice Environment, Terminal and Filesystem
seoDescription: Explore your simulated Kubernetes practice environment, available kubectl commands, virtual filesystem, reset behavior, and supported feature scope.
---

# What Runs Here

@@@
graph TD
Terminal["Terminal<br/>kubectl, ls, cd, nano, cat, ..."]
FS["Virtual Filesystem<br/>YAML files, directories"]
Cluster["Simulated Cluster<br/>Pods, Deployments, Services, ..."]
Terminal --> FS
Terminal --> Cluster
@@@

The terminal gives you access to two separate things at once. On the filesystem side, you can navigate directories, create files, and write YAML manifests just as you would on a real Linux machine. On the cluster side, `kubectl` connects to an in-memory Kubernetes cluster where those manifests take effect.

Some supported commands:

| Category        | Commands                          |
| --------------- | --------------------------------- |
| Navigation      | `pwd`, `ls`, `cd`, `mkdir`        |
| File operations | `cat`, `touch`, `rm`, `nano`      |
| Kubernetes      | `kubectl` and all its subcommands |

Try the filesystem now. Run the following command to open a new file in the editor:

```bash
nano test.txt
```

Type anything, then save with **Ctrl+S**. Now display what you wrote:

```bash
cat test.txt
```

Note that `nano` creates the file if it does not exist, so you never need `touch` first when editing. `touch` is useful only when you want an empty placeholder without opening an editor.

:::quiz
You created `test.txt` with `nano` and confirmed its content with `cat`. If you now click the reload icon below the terminal, will `test.txt` still be there?

**Try it:** Click the reload icon, then run `ls`.

**Answer:** No. Resetting wipes both the cluster state and the virtual filesystem. Only your course progress tracked by the platform is preserved, not local files.
:::

## Mistakes Are Free

Breaking things here has no consequences. The **reload icon** below the terminal (or a page reload) resets both the cluster and the filesystem to their initial state. Use that deliberately: apply a broken manifest, delete a resource and observe what happens, change a value and check whether the behavior matches your expectation. Every failed attempt teaches more than reading about it.

## Scope and Limitations

Not every Kubernetes feature is available in the simulator. The full list of supported commands and behaviors is on the <a href="/en/supported" target="_blank">supported features page</a>. When a lesson uses something outside that scope, it says so explicitly. If you try a command or flag not covered in a lesson, the output may not match what a real cluster would produce.

For deeper exploration on your own machine, <a href="https://kind.sigs.k8s.io/" target="_blank">kind</a> (Kubernetes in Docker) is the closest equivalent. The simulator outputs are aligned with kind, so what you observe here matches what you would get locally.

In the next lesson, you will see how this course maps to the three main Kubernetes certifications: KCNA, CKAD, and CKA.
