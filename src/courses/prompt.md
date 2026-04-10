## Structure

- 500 words minimum. 1000 words maximum.
- Tone: friendly, professional, no jokes. No  — signs, use analogies for complex concepts.
- Use prose over bullet points. Short paragraphs.
- End with a 2-3 sentence wrap-up only. No summary list.

## Concrete-Abstract-Concrete

- Open with a concrete scenario or real problem the user already understands.
- Introduce the Kubernetes concept as the solution to that problem.
- After the abstract explanation, return to the concrete: run a command, see the effect.
- Never start a section with a definition. Start with the problem.

## Dual Coding (diagram + text together)

- Place the Mermaid diagram (@@@ block) BEFORE or DURING the textual explanation, never after.
- The user reads the diagram first, then the text anchors each node. Both channels encode simultaneously.
- **Subgraphs:** do not use a subgraph id as an edge target (`IP --> containers` / `containers --> VOL`). `beautiful-mermaid` duplicates the group box. Keep the subgraph for layout only; connect **leaf nodes** (`IP --> C1`, `C1 --> VOL`, etc.).
- 1-2 diagrams per lesson minimum.
- Use :::info and :::warning for non-obvious asides only, not to repeat the main text.

## Cognitive Load Theory

- Introduce one concept at a time. Do not combine multiple new ideas in one paragraph.
- Build YAML manifests incrementally: show one field, explain it, then add the next field.
- For illustrative YAML (not meant to be applied), add a comment # illustrative only.
- When a full applicable manifest is shown, always precede it with the exact command to create the file: `nano <filename.yaml>`. Never write "Create a file named..." — write the command.
- Follow the manifest immediately with the kubectl apply command.
- Avoid showing a full complex manifest upfront without prior field-by-field buildup.

## Terminal Engagement (practice-first)

This platform's core value is hands-on experimentation. Prioritize terminal interaction over prose. Every lesson must include at least 3 commands distributed throughout (not just at the end). No purely theoretical section: after any concept, give a command that makes it visible. Read-only commands count. Break things, observe failures, reset and retry, that is the learning model.

## Interleaving and Testing Effect

- No separate Hands-On section. Distribute terminal commands inline, immediately after the concept they illustrate.
- After each major concept, add one :::quiz block to trigger active retrieval before moving on.
- **Never group all quizzes at the end of the lesson.** Each :::quiz must appear immediately after the section it tests, while that concept is still active in the reader's working memory. A quiz placed 500 words after its concept is useless for retrieval practice.
- Revisit the lesson's hardest concept a second time later in a different form (interleaving). Do not explain it identically, use a new angle or a new command that reveals the same truth.
- Choose the quiz type based on the context (see :::quiz formats below).

## Worked Example Effect

- For novices, showing a complete worked example is more effective than asking them to solve from scratch.
- Always show the full command or manifest before asking the user to run it. Never leave them to construct it alone without prior scaffolding.
- Show at least one failure or broken case per lesson: what goes wrong, what the output looks like, and why. Failure cases build sharper concept boundaries than success cases alone.
- When showing a failure case, use a :::warning callout to frame it explicitly.

## Desirable Difficulty

- Occasionally give the goal without the exact command. Let the user construct it using what they just learned. Only do this after the concept has been demonstrated once.
- Example: "Now get only the Pods from this Deployment. You have what you need." (after teaching -l label selectors).
- Never apply desirable difficulty on a concept introduced in the same paragraph. Only on concepts already exercised.

## Elaborative Interrogation

- After introducing a behavior, ask "why does Kubernetes do it this way?" in the prose and answer it immediately.
- This links the new concept to prior knowledge and builds a causal mental model, not just a procedural one.
- One elaborative "why" per major section is enough.

## What the simulator is

KubeMastery is NOT a real Kubernetes cluster. It is an in-browser simulation: an `ApiServerFacade` fronts an in-memory store (`EtcdLikeStore`) holding typed cluster state (Pods, Deployments, Services, etc.), with reconciliation controllers (control-plane, kubelet, network, volumes) running over an event bus. The terminal (xterm) dispatches input through `ShellCommandHandler` then `KubectlCommandHandler`, which routes to per-verb handlers under `src/core/kubectl/commands/handlers/`. The virtual filesystem is separate from the cluster state.

When describing the environment in lessons, always use the words "simulated", "simulator", "emulated", or "in-memory cluster". Never say "real cluster", "live cluster", or imply the terminal connects to actual Kubernetes infrastructure.

## Simulator shell (not POSIX Bash)

The in-lesson terminal is **not** a real shell. Do **not** put unsupported patterns in Pod manifests (`command` / `args`), Job or initContainer examples, `kubectl exec` snippets, or `:::quiz` **Try it** lines.

**Avoid:** pipes (`|`), `||`, semicolons chaining commands (`;`), loops, line continuation with `\`, here-documents, and command substitution (backticks or `$(...)`). The runtime supports a fixed command set and a constrained script model.

**Prefer:** `kubectl` plus the built-ins that exist in the product (file ops: `pwd`, `cd`, `ls`, `cat`, `nano`, `touch`, `mkdir`, `rm`, `echo` with `>` or `>>`), `&&` for simple chaining, `help`, `env`, `clear`, `sleep`, `nslookup`, and **simplified** `curl` (in-cluster HTTP GET style simulation, not full curl flags or scripting).

Authoritative reference (keep examples aligned with this page): [Supported, English](/en/supported).

## :::quiz formats

Three types. Pick based on context. Never use all three in the same section.

**Type 1 - MCQ**
Use when: two or more concepts in the lesson are easily confused (liveness vs readiness, requests vs limits, AND vs OR selectors). MCQ forces discrimination between close alternatives, which is where the learning happens. Options must be real misconceptions, never obviously wrong. This is the weakest form of retrieval - only use it for discrimination tasks.

:::quiz
[Question]

- Plausible wrong answer (common misconception)
- Correct answer
- Plausible wrong answer (common misconception)

**Answer:** [Correct option] - [why the others are wrong in one sentence]
:::

**Type 2 - Terminal**
Use when: the answer is observable by running a command. This is the strongest quiz format in this context: it combines free recall (no options) with real action in the terminal. Use after introducing a behavior whose output can be read and interpreted.

:::quiz
[Question that can be answered by running a command]

**Try it:** `[command]`

**Answer:** [What to look for in the output and why]
:::

**Type 3 - Reveal**
Use when: the question is causal or conceptual (why does Kubernetes do X, what is the consequence of Y). No options. The user thinks first, then reveals. Stronger than MCQ for building causal mental models.

:::quiz
[Why / what / explain question]

**Answer:** [Explanation]
:::
