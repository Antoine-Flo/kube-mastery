# Indexation Google (SEO)

## Ce qui est en place

- **Sitemap** : `@astrojs/sitemap` génère `/sitemap-index.xml` à chaque build. Les URLs sont absolues grâce à l’option `site` dans `astro.config.mjs`.
- **robots.txt** : Fichier statique `public/robots.txt` ; il autorise tous les robots et pointe vers le sitemap.

## Configuration de l’URL du site

Pour que le sitemap contienne les bonnes URLs en production, définis la variable d’environnement **`SITE`** à l’URL de ton site (sans slash final) :

- **Cloudflare Pages** : _Settings → Environment variables_ → `SITE` = `https://kubemastery.com` (ou ton domaine personnalisé).
- **En local** : dans un fichier `.env` à la racine : `SITE=https://kubemastery.com`.

Si `SITE` n’est pas défini, la config utilise par défaut `https://kubemastery.com`.

## Soumettre le site à Google

1. Va sur [Google Search Console](https://search.google.com/search-console).
2. **Ajouter une propriété** : choisis « Préfixe d’URL » et saisis l’URL exacte de ton site (ex. `https://kubemastery.com`).
3. **Vérifier la propriété** : utilise la méthode « Balise HTML » (ajoute la meta dans le layout si besoin) ou « Fichier HTML » (téléverse le fichier demandé dans `public/`), ou toute autre méthode proposée.
4. Une fois vérifié : **Sitemaps** (menu de gauche) → « Ajouter un sitemap » → saisis `sitemap-index.xml` → Envoyer.

Google va alors crawler le sitemap et indexer les pages. L’indexation peut prendre quelques jours.

## Optionnel (SEO)

- **Meta description** : ajouter une balise `<meta name="description" content="...">` dans le layout (et la surcharger par page si besoin).
- **Titre par page** : le layout utilise actuellement un titre global « Kube Mastery » ; tu peux exposer un prop `title` pour adapter le titre par page.
