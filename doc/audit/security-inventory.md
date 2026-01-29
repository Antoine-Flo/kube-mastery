# Inventaire sécurité (préparation audit)

Inventaire des variables d’environnement, des routes API et de Supabase pour guider l’analyse sécurité. Pas de correctifs dans ce document.

---

## Variables d’environnement

| Variable | Fichier(s) où lue | Sensible | Ne doit pas être en repo |
|----------|-------------------|----------|---------------------------|
| `VITE_SUPABASE_URL` | `src/db/supabase.ts`, `src/account/context.tsx` | Non (URL publique) | Optionnel (souvent en .env.example) |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `src/db/supabase.ts`, `src/account/context.tsx` | Oui (clé anon, exposée côté client) | Oui (ne pas committer en dur) |
| `VITE_SENTRY_DSN` | `src/entry-client.tsx`, `src/instrument.server.ts` | Oui (DSN peut exposer projet) | Oui |
| `DATABASE_URL` | `src/db/index.ts` | Oui (secret connexion Postgres) | Oui |

**Lecture** : `process.env` côté serveur (`instrument.server.ts`, `db/index.ts`) ; `import.meta.env` ou `process.env` côté client (`entry-client.tsx`, `supabase.ts`, `account/context.tsx`). Vérifier qu’aucune valeur sensible n’est hardcodée et que `.env` est dans `.gitignore`.

---

## Routes API (résumé pour l’audit)

| Route | Méthode | Paramètres / body | Usage DB / Supabase | Rate-limit / auth |
|-------|---------|-------------------|----------------------|-------------------|
| `/api/seeds/[name]` | GET | `name` (path) | Aucun (charge scénario depuis `seeds/scenarios`) | Aucun |
| `/api/suggestions/submit` | POST | `text`, `lessonId`, `userId?`, `visitorId?` | Supabase `suggestions` (insert) | Aucun |
| `/api/survey/submit` | POST | `name`, `responses`, `userId?`, `visitorId?`, `metadata?` | Supabase `survey` (insert) | Oui : 1 réponse par (visitorId ou userId) par `name` (429 si doublon) |
| `/api/ab-test/track` | POST | `testName`, `variant`, `eventType`, `visitorId`, `userId?`, `metadata?`, `timestamp?` | Supabase `ab_test_events`, `ab_test_assignments` (insert/upsert) | Aucun (retourne toujours 200 pour ne pas bloquer l’UI) |

**Points à analyser** : validation des entrées (taille, type, injection), exposition d’erreurs (messages 500), usage du client Supabase (anon key côté serveur pour insert), éventuel rate-limit global (suggestions, ab-test).

---

## Supabase : tables et RLS (résumé)

- **user_progress** : RLS — authenticated uniquement, accès limité à sa propre ligne (`userId = auth.uid()`). Select, insert, update, delete.
- **user_preferences** : idem (authenticated, propre ligne).
- **ab_test_events** : RLS — `anon` peut **insert** uniquement. Pas de select/update/delete pour anon.
- **ab_test_assignments** : RLS — `anon` peut **select**, **insert**, **update**. Pas de delete pour anon.
- **subscription_plans** : RLS — `anon` et `authenticated` peuvent **select** uniquement.
- **subscriptions** : RLS — `authenticated` uniquement, accès limité à sa propre ligne.
- **courses, modules, chapters, lessons, course_chapters** : RLS — `anon` et `authenticated` peuvent **select**. `service_role` peut tout faire.
- **survey** : RLS — `anon` et `authenticated` peuvent **insert**. `authenticated` peut **select** sur ses propres lignes. `service_role` peut tout faire.
- **suggestions** : RLS — `anon` et `authenticated` peuvent **insert** uniquement. Pas de select/update/delete pour anon/auth (lecture réservée au backend / service_role).

Détail des policies dans `src/db/schema.ts` (pgPolicy). Vérifier en base que les policies déployées (migrations Supabase) correspondent à ce schéma.

---

## Edge functions Supabase

| Function | Rôle | Auth |
|----------|------|------|
| `create-subscription` | Création / gestion d’abonnement utilisateur | Header `Authorization` requis (401 si absent). Client créé avec le token utilisateur. |
| `delete-account` | Suppression de compte utilisateur | Idem (Authorization requise). |

Les deux utilisent `Deno.env.get('SUPABASE_URL')` et `Deno.env.get('SUPABASE_ANON_KEY')` (configurés côté Supabase, pas dans le repo). À vérifier : pas de log d’identifiants, pas d’exposition de données d’autres utilisateurs.

---

## Références

- [entry-points.md](entry-points.md) — Entry points et surfaces sensibles.
- [scan-points.md](scan-points.md) — Zones à scanner.
- [artifacts.md](artifacts.md) — Commandes et rapports pour l’audit.
