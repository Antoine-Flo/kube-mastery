# KubeMastery

**An in-browser Kubernetes simulator for people who learn by doing.**

[kubemastery.com](https://kubemastery.com) - free during early access.

---

## What is this?

KubeMastery is a lightweight JavaScript implementation of core Kubernetes behavior, running entirely in your browser. No setup, no cloud costs. You get a real terminal, a visual cluster view, and short structured lessons.

Think of it as a flight simulator for Kubernetes: practice `kubectl` commands, work through CKA-style drills, and build intuition before touching a real cluster.

**The platform:** [kubemastery.com](https://kubemastery.com)

> This repository is **source-available**: the code is public to read and learn from. Contributions to course content and drills are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [LICENSE](./LICENSE) for details.

---

## Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | [Astro 5](https://astro.build/) |
| Deployment | [Cloudflare Workers](https://workers.cloudflare.com/) via [Wrangler](https://developers.cloudflare.com/workers/wrangler/) |
| Auth & progress | [Supabase](https://supabase.com/) |
| Terminal UI | [jQuery Terminal](https://terminal.jcubic.pl/) + [xterm.js](https://xtermjs.org/) |
| Tests | [Vitest](https://vitest.dev/) |

---

## Running Locally

> Running the full platform locally requires Supabase and Cloudflare credentials. The simulation core can be explored and tested without them.

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```sh
npm install
```

### Environment Variables

Copy the example and fill in your values:

```sh
cp .env.example .env
```

Required variables are documented in `.env.example`.

### Dev Server

```sh
npm run dev
```

Opens at `http://localhost:4321`.

### Tests

```sh
npm run test
```

Run the conformance suite (requires a running kind cluster):

```sh
npm run conformance
```

---

## Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run unit and integration tests |
| `npm run coverage` | Run tests with coverage |
| `npm run conformance` | Run kubectl conformance suite |
| `npm run check` | Run Astro type checks |
| `npm run format` | Format all files with Prettier |

---

## Deployment

Both staging and production deployments run a quality gate (`ci`, `check`, `test`, `build`) before deploying to Cloudflare Workers.

```sh
# Staging
npm run deploy:staging

# Production
npm run deploy:production
```

Required environment variables for deployment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

---

## License

Source-available. See [LICENSE](./LICENSE).

The simulation code is not licensed for commercial use or self-hosting as a service.
Course content and drills contributions are welcome under the same terms.
