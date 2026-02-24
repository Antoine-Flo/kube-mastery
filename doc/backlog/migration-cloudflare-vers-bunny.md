# Migration Cloudflare vers bunny.net

Objectif: préparer une migration d'hébergement en gardant le SSR Astro et les endpoints API.

## Contexte actuel

- Déploiement Cloudflare Workers avec `@astrojs/cloudflare`.
- Projet Astro en `output: "server"`.
- Endpoints API présents dans `src/pages/api/*`.
- Variables d'environnement lues via `locals.runtime.env` (pattern runtime adapter).

## Pourquoi migrer

- Hébergement européen.
- Réduction de dépendance à Cloudflare.

## Contraintes

- Ne pas casser les endpoints API existants.
- Préserver la gestion des cookies/session Supabase.
- Garder un chemin de rollback simple vers Cloudflare.

## Options techniques

### Option A: 100% bunny.net

- Utiliser un adaptateur Astro compatible bunny et SSR.
- Vérifier la maturité de l'adaptateur (maintenance, compatibilité Astro v5, support middleware/API).
- Adapter l'accès aux variables d'environnement si `locals.runtime.env` n'est plus disponible.

### Option B: Bunny pour le statique + backend SSR/API séparé

- Bunny sert les assets statiques.
- SSR/API déployés sur un runtime Node/Edge européen (autre fournisseur).
- Plus robuste si l'adaptateur bunny n'est pas mature.

## Plan de migration (proposé)

1. Faire un spike technique sur un environnement de test.
2. Valider le support des endpoints API (`GET`, `POST`, cookies, redirects).
3. Extraire la lecture d'environnement dans un helper unique multi-runtime.
4. Mettre en place la config de déploiement bunny (build + publish + routes).
5. Déployer en préproduction.
6. Vérifier SEO, perf, logs et observabilité.
7. Basculer le trafic progressivement.
8. Prévoir rollback documenté.

## Checklist de validation

- [ ] Toutes les routes SSR répondent correctement.
- [ ] Tous les endpoints `src/pages/api/*` passent.
- [ ] Auth Supabase fonctionne (signin, callback, signout, confirm).
- [ ] Cookies de session persistants.
- [ ] Variables d'environnement chargées sans régression.
- [ ] Sitemap et redirects conformes.
- [ ] Monitoring et alerting actifs.
- [ ] Procédure de rollback testée.

## Risques

- Incompatibilité partielle d'un adaptateur bunny avec Astro SSR.
- Différences de runtime sur `Request`, `Response`, headers et cookies.
- Régression silencieuse sur les endpoints auth.

## Mitigations

- Commencer par un POC minimal (1 page SSR + 1 endpoint API).
- Ajouter des tests de smoke end-to-end sur les flows auth.
- Garder Cloudflare prêt en fallback pendant la phase de migration.

## Définition de terminé (DoD)

- Build et déploiement bunny reproductibles.
- Tests smoke SSR/API verts.
- Aucune régression auth/cookies constatée.
- Documentation opérationnelle + rollback validés.
