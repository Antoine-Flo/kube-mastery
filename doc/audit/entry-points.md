# État des lieux pour l’audit

Document préparatoire à l’audit : entry points, surfaces sensibles, références.

## Entry points applicatifs

### Application (SolidStart / Vinxi)

| Fichier | Rôle |
|---------|------|
| `src/app.tsx` | Racine de l’application SolidJS |
| `src/entry-client.tsx` | Point d’entrée navigateur (hydratation, Sentry client) |
| `src/entry-server.tsx` | Point d’entrée serveur (SSR) |
| `src/middleware.ts` | Middleware Vinxi (Sentry beforeResponse) |
| `src/instrument.server.ts` | Initialisation Sentry côté serveur |

### Routes API (serveur)

| Chemin | Fichier | Rôle |
|--------|---------|------|
| `GET /api/seeds/[name]` | `src/routes/api/seeds/[name].ts` | Charge un scénario (cluster + fs) par nom |
| `POST /api/suggestions/submit` | `src/routes/api/suggestions/submit.ts` | Enregistre une suggestion de contenu (Supabase) |
| `POST /api/survey/submit` | `src/routes/api/survey/submit.ts` | Envoi de réponses enquête |
| `POST /api/ab-test/track` | `src/routes/api/ab-test/track.ts` | Tracking A/B test |

### Base de données et backend

| Chemin | Rôle |
|--------|------|
| `src/db/index.ts` | Client Drizzle/Postgres (serveur, `DATABASE_URL`) |
| `src/db/supabase.ts` | Client Supabase (auth, API, `VITE_SUPABASE_*`) |
| `src/db/schema.ts` | Schéma Drizzle |
| `supabase/functions/create-subscription/` | Edge function Supabase |
| `supabase/functions/delete-account/` | Edge function Supabase |

## Surfaces sensibles (priorité pour l’audit)

- **Auth / compte** : `src/account/`, `src/db/supabase.ts`, routes `auth`, `profile`, edge functions create-subscription, delete-account.
- **Env / secrets** : Toute lecture de `process.env` / `import.meta.env` (voir `doc/audit/security-inventory.md`).
- **API publiques** : Les 4 routes API ci-dessus (entrées utilisateur, validation, usage Supabase/DB).
- **Contenu utilisateur / markdown** : Composants quiz, lesson content (XSS / sanitization).

## Alignement doc / code

- **doc/context/architecture.md** : La section « Module Structure » mentionne un dossier `src/lib/` (utilities). Ce dossier n’existe pas dans l’arborescence actuelle ; les utilitaires sont répartis à la racine de `src/` (`theme.tsx`, `config.ts`), dans `src/account/`, `src/types/`, `src/learnable/`, etc. Le reste de l’architecture (core, cluster, terminal, routes) est aligné.
- **doc/context/spec.md**, **conventions.md**, **roadmap.md** : Références à utiliser telles quelles pour le périmètre et les règles de code.

## Références

- [doc/context/architecture.md](../context/architecture.md) — Structure technique, patterns, modules.
- [doc/context/spec.md](../context/spec.md) — Fonctionnalités et comportements attendus.
- [doc/context/conventions.md](../context/conventions.md) — Standards de code.
- [doc/audit/scan-points.md](scan-points.md) — Zones et types d’analyse pour le scan.
- [doc/audit/security-inventory.md](security-inventory.md) — Inventaire env, API, Supabase.
