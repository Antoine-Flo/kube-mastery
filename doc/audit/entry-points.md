# État des lieux pour l’audit

Document préparatoire à l’audit : entry points, surfaces sensibles, références.

## Entry points applicatifs

### Application (Astro)

| Fichier / chemin | Rôle |
|------------------|------|
| `src/layouts/Layout.astro` | Layout commun (structure HTML, Navbar, main, Footer) |
| `src/pages/[lang]/` | Pages i18n : index, courses, auth, pricing, privacy-policy, terms-of-service |
| `src/pages/[lang]/[type]/[id]/` | Overview cours/module ; `[type]/[id]/[lessonId]` = page leçon |
| `src/pages/api/` | Endpoints API (auth, progress) |

Pas de `entry-client.tsx` / `entry-server.tsx` Vinxi. Middleware Astro : redirections (ex. `/` → `/en`) dans `astro.config.mjs` (redirects).

### Routes API (serveur)

| Chemin | Fichier | Rôle |
|--------|---------|------|
| Auth callback | `src/pages/api/auth/callback.ts` | OAuth / session |
| Auth register | `src/pages/api/auth/register.ts` | Inscription |
| Auth signin | `src/pages/api/auth/signin.ts` | Connexion |
| Auth signout | `src/pages/api/auth/signout.ts` | Déconnexion |
| Progress complete | `src/pages/api/progress/complete.ts` | Marquer leçon complétée (Supabase user_progress) |

### Base de données et backend

| Chemin | Rôle |
|--------|------|
| `src/lib/supabase.ts` | Client Supabase (browser + server, @supabase/ssr, PKCE) |
| `src/lib/progress/` | Progress (domain, server.ts, supabase-adapter), getProgressContext |
| **À migrer (prévu)** | Drizzle, `src/db/` (schéma, client Postgres, `DATABASE_URL`) |
| **À migrer (prévu)** | Edge functions Supabase (create-subscription, delete-account) |

## Surfaces sensibles (priorité pour l’audit)

- **Auth** : `src/pages/[lang]/auth/index.astro`, `src/lib/supabase.ts`, `src/pages/api/auth/*`.
- **Env / secrets** : Toute lecture de `process.env` / `import.meta.env` (voir `doc/audit/security-inventory.md`).
- **API publiques** : Routes auth et progress/complete (entrées utilisateur, validation, Supabase).
- **Contenu / markdown** : Composants lesson (contenu leçon, quiz), rendu markdown (XSS / sanitization).

## Alignement doc / code

- **doc/context/architecture.md** : Structure à jour (Astro, pages, content, lib, core). Référence à `src/db/` et tests comme « à migrer ».
- **doc/context/spec.md**, **conventions.md**, **roadmap.md** : Références pour périmètre et règles de code.

## Références

- [doc/context/architecture.md](../context/architecture.md) — Structure technique, patterns, modules.
- [doc/context/spec.md](../context/spec.md) — Fonctionnalités et comportements attendus.
- [doc/context/conventions.md](../context/conventions.md) — Standards de code.
- [doc/audit/scan-points.md](scan-points.md) — Zones et types d’analyse pour le scan.
- [doc/audit/security-inventory.md](security-inventory.md) — Inventaire env, API, Supabase.
