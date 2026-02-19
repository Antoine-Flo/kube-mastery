# Your Practice Environment

## What You Have Access To

The terminal gives you two things: an emulated Kubernetes cluster and a virtual Linux filesystem. You can create files, write YAML manifests, and apply them to the cluster with `kubectl`, just like you would on a real machine.

Here are the commands available in your environment:

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

Not every Kubernetes feature is available here. Some advanced add-ons, storage drivers, or cloud-specific resources require infrastructure beyond a learning environment. When a lesson touches something unavailable, we'll say so explicitly. That said, everything you need for the KCNA, CKAD, and CKA certifications is fully accessible.

## Hands-On 

Let's try to create a file. Type (or paste) the following command in the terminal on the right and press Enter:
```bash
touch test.txt
```

Then list the files in the current directory:
```bash
ls
```

To modify the file, you can use the nano editor, you can write anything you want:
```bash
nano test.txt
```

Then save and exit the editor.
```bash
Ctrl + s
```

Finally, display the content of the file:
```bash
cat test.txt
```

Next time you don't event have to use `touch` to create a file, you can use `nano` to create and edit in one command. Ready to go ! In the next lesson, we'll look at the Kubernetes certifications so you understand where this Common Core fits into the bigger picture.
