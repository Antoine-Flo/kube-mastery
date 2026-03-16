# Points de scan pour l’audit

Définition des zones à parcourir et des types d’analyse, sans exécuter l’audit.

| Zone                        | Fichiers / chemins                                                      | Ce qu’on peut analyser                                           |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Env & secrets**           | Tout `process.env`, `import.meta.env`, `.env*`                          | Fuites de secrets, DSN, URLs, clés Supabase                      |
| **API routes**              | `src/pages/api/**/*.ts`                                                 | Validation des entrées, erreurs exposées, usage Supabase         |
| **Auth**                    | `src/lib/supabase.ts`, `src/pages/[lang]/auth/`, `src/pages/api/auth/`  | Flux auth, RLS, exposition de données utilisateur                |
| **DB / serveur** (à migrer) | `src/db/` (Drizzle, prévu), `drizzle.config.ts`, `supabase/migrations/` | Connexions, schéma, migrations                                   |
| **Front / XSS**             | `src/components/lesson/`, pages leçon (contenu markdown), quiz          | Échappement, sanitization                                        |
| **Dépendances**             | `package.json`, lockfile                                                | Vulnérabilités (npm audit), licences                             |
| **Conventions**             | `src/**/*.ts`, `src/**/*.astro`                                         | Respect conventions.md (indentation, Result types, pas de throw) |

## Chemins détaillés

- **Env & secrets** : `src/lib/supabase.ts`, `src/lib/progress/`, tout fichier utilisant `process.env` ou `import.meta.env`. **À migrer** : `src/db/` (DATABASE_URL, etc.).
- **API routes** : `src/pages/api/auth/callback.ts`, `register.ts`, `signin.ts`, `signout.ts`, `src/pages/api/progress/complete.ts`.
- **Auth** : `src/lib/supabase.ts`, `src/pages/[lang]/auth/index.astro`, `src/pages/api/auth/*`.
- **DB / serveur** : À migrer (Drizzle) — `src/db/index.ts`, `src/db/schema.ts`, `drizzle.config.ts`, `supabase/migrations/*.sql`.
- **Front / XSS** : `src/components/lesson/` (LessonQuizNav, contenu leçon), pages `[lang]/[type]/[id]/[lessonId]/index.astro`, rendu markdown.
- **Conventions** : `.cursor/rules/kubemastery-conventions.mdc` pour les règles (max indentation, Result types, pas d’exceptions, etc.).
