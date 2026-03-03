# Your Practice Environment

## What You Have Access To

The practice environment gives you two main tools:

1. **A virtual filesystem** where you can create directories, write files, and navigate just like on a Linux machine.
2. **A Kubernetes cluster** that accepts standard `kubectl` commands and behaves like a minimal production cluster.

Here are the everyday commands available in the terminal:

| Category        | Commands                         |
| --------------- | -------------------------------- |
| Navigation      | `cd`, `ls`, `pwd`, `mkdir`       |
| File operations | `cat`, `touch`, `rm`, `nano`     |
| Terminal        | `clear`, history with arrow keys |
| Kubernetes      | `kubectl` and its subcommands    |

:::info
Since this is a browser-based simulation, some advanced features might behave slightly differently than on a full Linux machine. If you notice an issue in the course, click the **pen icon** at the bottom right of the window to suggest a correction.
:::

## Starting Fresh

Here is one of the biggest advantages of a simulated environment: mistakes are completely free. If you ever want to reset everything, the filesystem, the cluster state, all of it, simply **reload the browser page**.

:::warning
Even though we try to cover the most common features, not every Kubernetes API or addon is present. If you notice something unexpected or something missing, please let us know.
:::
