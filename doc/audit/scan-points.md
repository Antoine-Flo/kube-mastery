# Points de scan pour l’audit

Définition des zones à parcourir et des types d’analyse, sans exécuter l’audit.

| Zone | Fichiers / chemins | Ce qu’on peut analyser |
|------|--------------------|------------------------|
| **Env & secrets** | Tout `process.env`, `import.meta.env`, `.env*` | Fuites de secrets, DSN, URLs DB, clés Supabase |
| **API routes** | `src/routes/api/**/*.ts` | Validation des entrées, erreurs exposées, usage Supabase |
| **Auth / compte** | `src/account/`, `src/db/supabase.ts` | Flux auth, RLS, exposition de données utilisateur |
| **DB / serveur** | `src/db/index.ts`, `drizzle.config.ts`, `supabase/migrations/` | Connexions, schéma, migrations |
| **Front / XSS** | Composants qui affichent du contenu utilisateur ou markdown (quiz, lessons) | Échappement, sanitization |
| **Dépendances** | `package.json`, lockfile | Vulnérabilités connues (npm audit), licences |
| **Conventions** | `src/**/*.ts`, `src/**/*.tsx` | Respect conventions (conventions.md), indentation, Result types, pas de throw |

## Chemins détaillés

- **Env & secrets** : `src/db/index.ts`, `src/db/supabase.ts`, `src/account/context.tsx`, `src/entry-client.tsx`, `src/instrument.server.ts`, tout fichier utilisant `process.env` ou `import.meta.env`.
- **API routes** : `src/routes/api/seeds/[name].ts`, `src/routes/api/suggestions/submit.ts`, `src/routes/api/survey/submit.ts`, `src/routes/api/ab-test/track.ts`.
- **Auth / compte** : `src/account/*.ts`, `src/account/*.tsx`, `src/db/supabase.ts`, routes `[[lang]]/auth.tsx`, `[[lang]]/profile.tsx`.
- **DB / serveur** : `src/db/index.ts`, `src/db/schema.ts`, `drizzle.config.ts`, `supabase/migrations/*.sql`.
- **Front / XSS** : `src/components/quiz/`, `src/components/lesson-content.tsx`, tout rendu de markdown ou contenu de leçon.
- **Conventions** : `doc/context/conventions.md` pour les règles (max indentation, Result types, pas d’exceptions, etc.).
