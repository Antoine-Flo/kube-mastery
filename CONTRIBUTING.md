# Contributing to KubeMastery

Thanks for taking the time to read this. Contributions are welcome in a specific, focused area described below.

---

## What you can contribute

**Course content and drills** are open to contributions. This includes:

- Lesson content files: `src/courses/modules/**/en/content.md` (and `fr/`)
- Drill content files: `src/courses/drills/**/en.md`
- Cheat sheet content: `src/courses/cheat-sheets/`
- Fixes to factual errors, outdated kubectl output, or unclear phrasing in existing lessons

**Everything else** (simulation engine, UI, infrastructure, tooling) is **not open to pull requests for now**. PRs touching those areas will be closed without review.

This is intentional - the project is in active development and the core codebase needs to stay tightly controlled. This may change later.

**Issues are always welcome**, though. If you spot a gap between the simulator and a real cluster, a wrong error message, a missing command behavior, or any other parity problem, open an issue. That kind of feedback is genuinely useful and helps prioritize what gets fixed next. Please include:

- The command you ran in the simulator
- The output you got
- The output from a real cluster (kind, minikube, or any other), if you have it

---

## Before you start

Open an issue first if you plan to:

- Add a new lesson or drill
- Significantly rework an existing lesson
- Propose a new module or learning path

For small fixes (typos, factual corrections, broken code blocks), you can go straight to a pull request.

---

## Pull request checklist

- [ ] Content targets an existing module or drill (or an issue has been opened for a new one)
- [ ] Commands and outputs have been verified against a real cluster
- [ ] No new files outside `src/courses/`
- [ ] No changes to simulation code, UI, or tooling
- [ ] Markdown renders cleanly (headers, code blocks, quiz blocks)

---

## License of contributions

By submitting a pull request, you agree that your contribution is licensed under the same terms as this project (see [LICENSE](./LICENSE)). You keep authorship credit but grant the project the right to include and modify your content.

---

## Questions

Open an issue or reach out via the platform at [kubemastery.com](https://kubemastery.com).
