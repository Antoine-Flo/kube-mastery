# Inventaire sécurité (préparation audit)

Inventaire des variables d’environnement, des routes API et de Supabase pour guider l’analyse sécurité. Pas de correctifs dans ce document.

---

## Variables d’environnement

| Variable | Fichier(s) où lue | Sensible | Ne doit pas être en repo |
|----------|-------------------|----------|---------------------------|
| `PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts` (browser client) | Non (URL publique) | Optionnel (souvent en .env.example) |
| `PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (ou `PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | `src/lib/supabase.ts` (browser client) | Oui (clé anon, exposée côté client) | Oui (ne pas committer en dur) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Runtime Cloudflare (server, `locals.runtime.env`) ; utilisés dans `src/lib/supabase.ts` (getSupabaseServer) | Oui (côté serveur) | Oui |
| **À migrer (prévu)** `DATABASE_URL` | `src/db/index.ts` (Drizzle, quand migré) | Oui (secret connexion Postgres) | Oui |

**Lecture** : `import.meta.env` côté client (browser Supabase) ; `locals.runtime.env` côté serveur (Cloudflare). Vérifier qu’aucune valeur sensible n’est hardcodée et que `.env` est dans `.gitignore`.

---

## Routes API (résumé pour l’audit)

| Route | Méthode | Paramètres / body | Usage Supabase | Auth |
|-------|---------|-------------------|----------------|------|
| `/api/auth/callback` | GET | Query (code, etc.) | Session OAuth | - |
| `/api/auth/register` | POST | Body (email, password, etc.) | Inscription | - |
| `/api/auth/signin` | POST | Body | Connexion | - |
| `/api/auth/signout` | POST | - | Déconnexion | - |
| `/api/progress/complete` | GET | Query `lessonId`, `redirect` | user_progress (insert/update) | Session (cookies) |

**Points à analyser** : validation des entrées, exposition d’erreurs (500), usage du client Supabase (anon key / server client).

---

## Supabase : tables et RLS (résumé)

- **user_progress** : RLS — authenticated uniquement, accès limité à sa propre ligne (`userId = auth.uid()`). Select, insert, update, delete.
- **À migrer / à définir** : user_preferences, ab_test_events, ab_test_assignments, subscription_plans, subscriptions, survey, suggestions, tables cours (courses, modules, chapters, lessons, course_chapters) — garder dans la doc avec mention « à migrer » ou selon schéma réel déployé.

Détail des policies : à vérifier dans le schéma Supabase (migrations) ou `src/db/schema.ts` quand Drizzle sera migré.

---

## Edge functions Supabase

**À migrer (prévu)** : create-subscription, delete-account. Quand en place : vérifier auth (Authorization), pas de log d’identifiants, pas d’exposition de données d’autres utilisateurs.

---

## Références

- [entry-points.md](entry-points.md) — Entry points et surfaces sensibles.
- [scan-points.md](scan-points.md) — Zones à scanner.
- [artifacts.md](artifacts.md) — Commandes et rapports pour l’audit.
