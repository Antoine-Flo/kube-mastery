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
- 1-2 diagrams per lesson minimum.
- Use :::info and :::warning for non-obvious asides only, not to repeat the main text.

## Cognitive Load Theory

- Introduce one concept at a time. Do not combine multiple new ideas in one paragraph.
- Build YAML manifests incrementally: show one field, explain it, then add the next field.
- For illustrative YAML (not meant to be applied), add a comment # illustrative only.
- When a full applicable manifest is shown, always precede it with the exact command to create the file: `nano <filename.yaml>`. Never write "Create a file named..." — write the command.
- Follow the manifest immediately with the kubectl apply command.
- Avoid showing a full complex manifest upfront without prior field-by-field buildup.

## Interleaving and Testing Effect

- No separate Hands-On section. Distribute terminal commands inline, immediately after the concept they illustrate.
- After each major concept, add one :::quiz block to trigger active retrieval before moving on.
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

## Visualizer

The lesson has an embedded cluster visualizer (telescope icon) visible below the terminal.

What the visualizer renders:
  - Compute layer: Nodes, Pods (grouped by node), containers (status badges)
  - Network layer: Services, ClusterIPs, ports, endpoint Pods
  - Workload tooltip on Pods: Deployment / DaemonSet / ReplicaSet ownership

What it does NOT render (do not reference these visually):
  - PersistentVolumes, PersistentVolumeClaims
  - NetworkPolicies
  - ConfigMaps, Secrets
  - Deployment / ReplicaSet as standalone nodes

Use :::visualizer callout at the exact moment a meaningful state change is visible
(Pod going Running, Service appearing, rolling update in progress). One per major step, not one per command.

:::visualizer
Watch the cluster visualizer — [what to look for].
:::

Put it before the command not after.

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
